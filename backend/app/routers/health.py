"""
LLM health-check router.

Endpoint added in Plan 09-01:
  GET /api/health/llm — performs a cheap (~11 token) authenticated round-trip
                        to the configured upstream LLM endpoint and returns a
                        stable success/failure shape suitable for a frontend
                        indicator (Phase 10) and launch gate.

Key invariants:
  * HTTP status is ALWAYS 200. Endpoint health != upstream health.
    Clients discriminate on the `ok` boolean in the body.
  * Auth construction mirrors `routers/llm.py` lines 79-84 exactly — it uses
    settings.llm_auth_header_name / llm_auth_value_prefix / get_extra_headers()
    so Azure auth-mode deployments ("api-key: <key>") work the same as
    OpenAI-compatible ones ("Authorization: Bearer <key>"). DO NOT copy the
    hardcoded Bearer prefix from config_gen.py — that is wrong here.
  * Per-request timeout=httpx.Timeout(15.0) is set on the .post() call to
    override the client-level LLM_TIMEOUT_SECONDS default (60s by default).
    Without this override the 15s SLA is NOT enforced.
  * Exception handler order is load-bearing: TimeoutException MUST precede
    RequestError because TimeoutException is a subclass of RequestError.

Response shape contract (stable — Phase 10 frontend depends on it):
  Success: {"ok": true, "latencyMs": <int>}
  Failure: {"ok": false, "code": <enum>, "status": <int|null>,
            "hint": <string>, "latencyMs": <int>}

  code enum: timeout | auth_error | not_found | rate_limited |
             upstream_error | network_error | tls_error | invalid_response
"""

import logging
import ssl
import time

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from ..config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# Probe constants
# ---------------------------------------------------------------------------

# ~11-token round-trip: minimal prompt + max_tokens=5 caps the reply.
_HEALTH_PROBE_MESSAGES = [{"role": "user", "content": "Reply with: OK"}]

# 15-second SLA per CONTEXT.md / RESEARCH.md. Applied as a per-request override
# on the .post() call below; the shared client's default timeout is
# LLM_TIMEOUT_SECONDS (60s by default) which is too slow for a health probe.
_HEALTH_TIMEOUT_SECONDS = 15.0


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------


@router.get("/api/health/llm")
async def llm_health_check(request: Request) -> JSONResponse:
    """
    Probe the upstream LLM with a cheap authenticated round-trip.

    Always returns HTTP 200. The body's `ok` field reports upstream health.
    Every call fires a real probe — no caching, debouncing, or rate limiting.
    """
    settings = get_settings()
    # Reuse the shared AsyncClient from lifespan. Do NOT instantiate a new one.
    client: httpx.AsyncClient = request.app.state.http_client

    # Auth header construction copied verbatim from routers/llm.py lines 79-84
    # so Azure ("api-key: <key>") and OpenAI-compatible ("Authorization:
    # Bearer <key>") deployments both work without a code change.
    auth_value = f"{settings.llm_auth_value_prefix}{settings.llm_api_key}".strip()
    headers = {
        settings.llm_auth_header_name: auth_value,
        "Content-Type": "application/json",
        **settings.get_extra_headers(),
    }

    payload = {
        "model": settings.llm_model,
        "messages": _HEALTH_PROBE_MESSAGES,
        "max_tokens": 5,
        "temperature": 0,
    }

    t0 = time.monotonic()

    try:
        response = await client.post(
            settings.llm_endpoint_url,
            json=payload,
            headers=headers,
            # Per-request override — critical. Without this the client-level
            # LLM_TIMEOUT_SECONDS (default 60s) applies and the 15s SLA breaks.
            timeout=httpx.Timeout(_HEALTH_TIMEOUT_SECONDS),
        )
        response.raise_for_status()

        data = response.json()
        content = data["choices"][0]["message"]["content"]
        if not content:
            # Upstream returned 200 but the body was empty — treat as malformed.
            raise ValueError("empty content in LLM response")

        latency_ms = int((time.monotonic() - t0) * 1000)
        logger.info(
            "llm_health_check code=%s status=%s latencyMs=%d",
            "ok",
            200,
            latency_ms,
        )
        return JSONResponse(
            status_code=200,
            content={"ok": True, "latencyMs": latency_ms},
        )

    # Handler order is load-bearing:
    #   TimeoutException  → must precede RequestError (it is a subclass)
    #   HTTPStatusError   → only raised by raise_for_status(); dispatches on code
    #   ConnectError      → must precede RequestError (it is a subclass)
    #   RequestError      → catch-all for other transport errors
    #   Exception         → malformed response body / unexpected parse errors

    except httpx.TimeoutException:
        code = "timeout"
        status: "int | None" = None
        hint = "LLM did not respond within 15 seconds — check network or provider latency"

    except httpx.HTTPStatusError as exc:
        status = exc.response.status_code
        if status in (401, 403):
            code = "auth_error"
            hint = "Authentication failed — check LLM_API_KEY in .env"
        elif status == 404:
            code = "not_found"
            hint = "LLM endpoint not found — check LLM_URL path in .env"
        elif status == 429:
            code = "rate_limited"
            hint = "Rate limited by LLM provider — retry in a moment"
        else:
            # 5xx and any other non-2xx (e.g. 400) bucket to upstream_error.
            code = "upstream_error"
            hint = (
                f"LLM provider error (HTTP {status}) — try again or check provider status"
            )

    except httpx.ConnectError as exc:
        # TLS-vs-network discrimination via __cause__. This is NOT a documented-
        # stable httpx API (see RESEARCH.md Q8) — if it proves flaky in the wild,
        # collapse both branches into `network_error`. Retained here because it
        # gives facilitators a materially more actionable hint when a corporate
        # proxy or custom CA is the culprit.
        if isinstance(exc.__cause__, ssl.SSLError):
            code = "tls_error"
            hint = (
                "TLS handshake failed — check LLM_EXTRA_HEADERS and corporate proxy settings"
            )
        else:
            code = "network_error"
            hint = (
                "Cannot reach LLM endpoint — check LLM_URL in .env and network connectivity"
            )
        status = None

    except httpx.RequestError:
        # Catch-all for other transport errors: ReadError, WriteError, pool
        # exhaustion that didn't surface as TimeoutException, etc.
        code = "network_error"
        status = None
        hint = (
            "Cannot reach LLM endpoint — check LLM_URL in .env and network connectivity"
        )

    except Exception:
        # Upstream returned 2xx but the body was not the expected chat-completions
        # shape (KeyError / IndexError / JSONDecodeError / the ValueError raised
        # above on empty content). raise_for_status() succeeded so status is 200.
        code = "invalid_response"
        status = 200
        hint = (
            "LLM returned an unexpected response shape — "
            "check LLM_URL points to a chat-completions endpoint"
        )

    # Shared failure return path — every failure branch funnels through here so
    # latency recording, logging, and response shape stay consistent.
    latency_ms = int((time.monotonic() - t0) * 1000)
    logger.info(
        "llm_health_check code=%s status=%s latencyMs=%d",
        code,
        status,
        latency_ms,
    )
    return JSONResponse(
        status_code=200,  # ALWAYS 200 — endpoint health != upstream health.
        content={
            "ok": False,
            "code": code,
            "status": status,
            "hint": hint,
            "latencyMs": latency_ms,
        },
    )
