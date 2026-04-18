"""
TTS health-check router.

Endpoint added in Plan 15-01:
  GET /api/health/tts — performs a cheap authenticated probe to the ElevenLabs
                        /v1/user endpoint and returns a stable success/failure
                        shape suitable for a frontend TTS badge (Phase 15-02)
                        and setup-screen gate.

Key invariants:
  * HTTP status is ALWAYS 200. Endpoint health != upstream health.
    Clients discriminate on the `ok` boolean in the body.
  * TTS_PROVIDER=fake short-circuits BEFORE any cache or network logic —
    returns {ok: true, latencyMs: 0} immediately. This avoids constant amber
    false-alarm on dev/test environments that use FakeTTSProvider.
  * Per-request httpx.AsyncClient (NOT app.state.http_client — that is the
    LLM client with LLM-specific defaults and a different lifecycle).
    Per-request is acceptable because the 30s cache keeps probe frequency low.
  * httpx.Timeout(15.0) applied to the AsyncClient — the 15s SLA.
  * 30-second in-memory cache prevents ElevenLabs quota burn on repeated
    frontend polls. ?force=true bypasses cache READ only; cache is always
    updated on completion (success or failure).
  * Exception handler order is load-bearing: TimeoutException MUST precede
    RequestError because TimeoutException is a subclass of RequestError.
    ConnectError MUST also precede RequestError (same reason).
  * Probe URL is hardcoded to https://api.elevenlabs.io/v1/user. /v1/user
    is ~200 bytes vs ~50KB for /v1/voices, exercising the same auth surface.
    RESEARCH.md Q4 documents /v1/voices as the field fallback if /v1/user
    proves unreliable.
  * Auth header is `xi-api-key: {api_key}` — NOT `Authorization: Bearer`.
    Confirmed from ElevenLabs SDK source (client_wrapper.py).
  * Response validation: after raise_for_status(), body must contain the
    `subscription` key. Missing key → invalid_response code.

Response shape contract (stable — Phase 15-02 frontend depends on it):
  Success: {"ok": true, "latencyMs": <int>}
  Failure: {"ok": false, "code": <enum>, "status": <int|null>,
            "hint": <string>, "latencyMs": <int>}

  code enum: timeout | auth_error | not_found | rate_limited |
             upstream_error | network_error | tls_error | invalid_response
"""

import asyncio
import logging
import ssl
import time

import httpx
from fastapi import APIRouter
from fastapi.responses import JSONResponse

from ..config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# Probe constants
# ---------------------------------------------------------------------------

# Hardcoded probe URL — /v1/user is smaller than /v1/voices (~200B vs ~50KB)
# while exercising the same auth path. RESEARCH.md Q4 documents /v1/voices as
# the field fallback if /v1/user proves unreliable.
_PROBE_URL = "https://api.elevenlabs.io/v1/user"

# 15-second SLA per CONTEXT.md / RESEARCH.md.
_HEALTH_TIMEOUT_SECONDS = 15.0

# 30-second in-memory cache — prevents ElevenLabs quota burn on repeated probes.
_CACHE_TTL_S = 30.0


# ---------------------------------------------------------------------------
# Module-level cache state
# ---------------------------------------------------------------------------

_cache_lock = asyncio.Lock()
_cache: "tuple[float, dict] | None" = None  # (monotonic_timestamp, response_body_dict)


# ---------------------------------------------------------------------------
# Client factory — isolated so pytest can monkeypatch it narrowly
# ---------------------------------------------------------------------------


def _make_http_client() -> httpx.AsyncClient:
    """Return a fresh AsyncClient with the 15s probe timeout.

    Tests monkeypatch this function to return a MockTransport-backed client
    without touching main.py's lifespan client or the global httpx module.
    """
    return httpx.AsyncClient(timeout=httpx.Timeout(_HEALTH_TIMEOUT_SECONDS))


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------


@router.get("/api/health/tts")
async def tts_health_check(force: bool = False) -> JSONResponse:
    """
    Probe ElevenLabs /v1/user with an authenticated GET request.

    Always returns HTTP 200. The body's `ok` field reports upstream health.
    TTS_PROVIDER=fake short-circuits before any network call, returning
    {ok: true, latencyMs: 0}.
    Results are cached for 30 seconds; ?force=true bypasses cache read.
    """
    global _cache

    settings = get_settings()

    # ------------------------------------------------------------------
    # Fast path: TTS_PROVIDER=fake — no cache, no network, no cost.
    # ------------------------------------------------------------------
    if settings.tts_provider == "fake":
        logger.info(
            "tts_health_check code=%s status=%s latencyMs=%d provider=fake",
            "ok",
            None,
            0,
        )
        return JSONResponse(
            status_code=200,
            content={"ok": True, "latencyMs": 0},
        )

    # ------------------------------------------------------------------
    # Cache read (skipped if force=True)
    # ------------------------------------------------------------------
    if not force:
        async with _cache_lock:
            if _cache is not None and (time.monotonic() - _cache[0]) < _CACHE_TTL_S:
                cached_body = _cache[1]
                logger.info(
                    "tts_health_check code=%s status=%s latencyMs=%d (cache hit)",
                    "ok" if cached_body.get("ok") else cached_body.get("code"),
                    cached_body.get("status"),
                    cached_body.get("latencyMs", 0),
                )
                return JSONResponse(status_code=200, content=cached_body)

    # ------------------------------------------------------------------
    # Live probe
    # ------------------------------------------------------------------
    t0 = time.monotonic()

    try:
        async with _make_http_client() as client:
            response = await client.get(
                _PROBE_URL,
                headers={"xi-api-key": settings.elevenlabs_api_key or ""},
            )
            response.raise_for_status()

            data = response.json()
            if "subscription" not in data:
                raise ValueError("missing subscription key")

            latency_ms = int((time.monotonic() - t0) * 1000)
            logger.info(
                "tts_health_check code=%s status=%s latencyMs=%d",
                "ok",
                200,
                latency_ms,
            )
            body: dict = {"ok": True, "latencyMs": latency_ms}

    # Handler order is load-bearing:
    #   TimeoutException  → must precede RequestError (it is a subclass)
    #   HTTPStatusError   → only raised by raise_for_status(); dispatches on code
    #   ConnectError      → must precede RequestError (it is a subclass)
    #   RequestError      → catch-all for other transport errors
    #   Exception         → malformed response body / unexpected parse errors

    except httpx.TimeoutException:
        latency_ms = int((time.monotonic() - t0) * 1000)
        code = "timeout"
        status: "int | None" = None
        hint = "ElevenLabs did not respond within 15 seconds — check network or provider status"
        body = {"ok": False, "code": code, "status": status, "hint": hint, "latencyMs": latency_ms}

    except httpx.HTTPStatusError as exc:
        latency_ms = int((time.monotonic() - t0) * 1000)
        status = exc.response.status_code
        if status in (401, 403):
            code = "auth_error"
            hint = "Authentication failed — check ELEVENLABS_API_KEY in .env"
        elif status == 404:
            code = "not_found"
            hint = "ElevenLabs endpoint not found — probe URL may have changed"
        elif status == 429:
            code = "rate_limited"
            hint = "Rate limited by ElevenLabs — retry in a moment"
        else:
            # 5xx and any other non-2xx bucket to upstream_error.
            code = "upstream_error"
            hint = (
                f"ElevenLabs provider error (HTTP {status}) — try again or check provider status"
            )
        body = {"ok": False, "code": code, "status": status, "hint": hint, "latencyMs": latency_ms}

    except httpx.ConnectError as exc:
        # TLS-vs-network discrimination via __cause__. If this proves flaky in
        # the field, collapse both branches into `network_error` (mirrors the
        # comment in health.py lines 156-170).
        latency_ms = int((time.monotonic() - t0) * 1000)
        status = None
        if isinstance(exc.__cause__, ssl.SSLError):
            code = "tls_error"
            hint = "TLS handshake failed — check corporate proxy and custom CA settings"
        else:
            code = "network_error"
            hint = "Cannot reach api.elevenlabs.io — check network connectivity and firewall"
        body = {"ok": False, "code": code, "status": status, "hint": hint, "latencyMs": latency_ms}

    except httpx.RequestError:
        # Catch-all for other transport errors: ReadError, WriteError, etc.
        latency_ms = int((time.monotonic() - t0) * 1000)
        code = "network_error"
        status = None
        hint = "Cannot reach api.elevenlabs.io — check network connectivity and firewall"
        body = {"ok": False, "code": code, "status": status, "hint": hint, "latencyMs": latency_ms}

    except Exception:
        # Upstream returned 2xx but body was not the expected shape (missing
        # `subscription` key, JSONDecodeError, ValueError raised above, etc.).
        # raise_for_status() succeeded so status is 200.
        latency_ms = int((time.monotonic() - t0) * 1000)
        code = "invalid_response"
        status = 200
        hint = "ElevenLabs returned an unexpected response shape"
        body = {"ok": False, "code": code, "status": status, "hint": hint, "latencyMs": latency_ms}

    # Shared failure + success logging (success early-returns above, so all
    # paths reaching here are failures — but keep the log shape consistent).
    if not body.get("ok"):
        logger.info(
            "tts_health_check code=%s status=%s latencyMs=%d",
            body.get("code"),
            body.get("status"),
            body.get("latencyMs", 0),
        )

    # ------------------------------------------------------------------
    # Cache write — always write back (success or failure, force or not)
    # ------------------------------------------------------------------
    async with _cache_lock:
        _cache = (time.monotonic(), body)

    return JSONResponse(status_code=200, content=body)
