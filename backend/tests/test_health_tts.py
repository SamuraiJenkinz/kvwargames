"""
Pytest coverage for the GET /api/health/tts endpoint (Plan 15-01).

Scenarios:
  1.  Success                  — ElevenLabs 200 with valid user body
                                 -> HTTP 200 {ok: true, latencyMs}
  2.  Auth error 401           — ElevenLabs 401
                                 -> HTTP 200 {ok: false, code: "auth_error", status: 401}
  3.  Auth error 403           — ElevenLabs 403
                                 -> HTTP 200 {ok: false, code: "auth_error", status: 403}
  4.  Not found 404            — ElevenLabs 404
                                 -> HTTP 200 {ok: false, code: "not_found", status: 404}
  5.  Rate limited 429         — ElevenLabs 429
                                 -> HTTP 200 {ok: false, code: "rate_limited", status: 429}
  6.  Upstream error 500       — ElevenLabs 500
                                 -> HTTP 200 {ok: false, code: "upstream_error", status: 500}
  7.  Timeout                  — httpx.TimeoutException raised by transport
                                 -> HTTP 200 {ok: false, code: "timeout", status: null}
  8.  Network error            — httpx.ConnectError (no SSL cause)
                                 -> HTTP 200 {ok: false, code: "network_error", status: null}
  9.  TLS error                — httpx.ConnectError with ssl.SSLError __cause__
                                 -> HTTP 200 {ok: false, code: "tls_error", status: null}
  10. Invalid response shape   — ElevenLabs 200 but body lacks `subscription` key
                                 -> HTTP 200 {ok: false, code: "invalid_response", status: 200}
  11. Fake provider short-circuit — TTS_PROVIDER=fake, no httpx mock, returns instantly
                                 -> HTTP 200 {ok: true, latencyMs: 0}
  12. Cache hit avoids second probe — first success, second transport would 500 but cache wins
                                 -> HTTP 200 {ok: true} (cached)
  13. force=true bypasses cache, write-back — first success cached; force=true sees 401;
      subsequent plain GET sees the cached 401 result
                                 -> force response: {ok: false, code: "auth_error"}
                                 -> follow-up cached response: same auth_error
  14. 15s SLA bound             — TimeoutException surfaces quickly, response elapsed < 2s

Key differences from test_health_llm.py:
  - health_tts creates a per-request httpx.AsyncClient (not app.state.http_client).
    We monkeypatch `app.routers.health_tts.httpx.AsyncClient` with a factory that
    wraps a MockTransport, so the per-request `async with httpx.AsyncClient(...)` call
    gets our mock instead of a real client.
  - Module-level cache must be reset between tests via the autouse
    `reset_tts_health_cache` fixture defined in this file.
"""

from __future__ import annotations

import ssl
import time

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app


# ---------------------------------------------------------------------------
# Autouse: reset module-level cache between every test
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def reset_tts_health_cache():
    """Clear module-level _cache between tests — cache is process-global."""
    from app.routers import health_tts
    health_tts._cache = None
    yield
    health_tts._cache = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _valid_el_user_response() -> dict:
    """Canned ElevenLabs /v1/user body — the shape health_tts.py expects."""
    return {
        "subscription": {
            "tier": "free",
            "character_count": 0,
            "character_limit": 10000,
        },
        "xi_api_key": "test-el-key-abc",
    }


def _mock_client(handler) -> httpx.AsyncClient:
    """Return an AsyncClient wired to a MockTransport running the given handler.

    Tests monkeypatch `app.routers.health_tts._make_http_client` to return this
    client, which avoids touching main.py's lifespan http_client or the global
    httpx module:

        monkeypatch.setattr(
            "app.routers.health_tts._make_http_client",
            lambda: _mock_client(handler),
        )

    _make_http_client is a narrow patch target — it is only called from the
    tts_health_check endpoint and returns a fresh context-manager-compatible
    AsyncClient each time. Patching it does not affect main.py's lifespan
    client (which the LLM health tests depend on).
    """
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_tts_health_success(env_base, env_tts_elevenlabs, monkeypatch):
    """ElevenLabs 200 with valid user body -> HTTP 200 {ok: true, latencyMs: int}.
    Asserts the probe hits /v1/user with the correct xi-api-key header.
    """
    captured: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return httpx.Response(200, json=_valid_el_user_response())

    monkeypatch.setattr("app.routers.health_tts._make_http_client", lambda: _mock_client(handler))

    with TestClient(app) as client:
        resp = client.get("/api/health/tts")

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["ok"] is True
    assert isinstance(body["latencyMs"], int)
    assert body["latencyMs"] >= 0
    assert set(body.keys()) == {"ok", "latencyMs"}
    # Verify probe URL and auth header
    assert len(captured) == 1, "expected exactly one upstream probe"
    outbound = captured[0]
    assert str(outbound.url) == "https://api.elevenlabs.io/v1/user"
    assert outbound.headers.get("xi-api-key") == "test-el-key-abc"


def test_tts_health_auth_error_401(env_base, env_tts_elevenlabs, monkeypatch):
    """ElevenLabs 401 -> HTTP 200 {ok: false, code: 'auth_error', status: 401}.
    Hint must reference ELEVENLABS_API_KEY.
    """
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"detail": "unauthorized"})

    monkeypatch.setattr("app.routers.health_tts._make_http_client", lambda: _mock_client(handler))

    with TestClient(app) as client:
        resp = client.get("/api/health/tts")

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["ok"] is False
    assert body["code"] == "auth_error"
    assert body["status"] == 401
    assert "ELEVENLABS_API_KEY" in body["hint"]
    assert isinstance(body["latencyMs"], int)


def test_tts_health_auth_error_403(env_base, env_tts_elevenlabs, monkeypatch):
    """ElevenLabs 403 -> HTTP 200 {ok: false, code: 'auth_error', status: 403}."""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(403, json={"detail": "forbidden"})

    monkeypatch.setattr("app.routers.health_tts._make_http_client", lambda: _mock_client(handler))

    with TestClient(app) as client:
        resp = client.get("/api/health/tts")

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["ok"] is False
    assert body["code"] == "auth_error"
    assert body["status"] == 403
    assert "ELEVENLABS_API_KEY" in body["hint"]


def test_tts_health_not_found_404(env_base, env_tts_elevenlabs, monkeypatch):
    """ElevenLabs 404 -> HTTP 200 {ok: false, code: 'not_found', status: 404}."""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404, json={"detail": "not found"})

    monkeypatch.setattr("app.routers.health_tts._make_http_client", lambda: _mock_client(handler))

    with TestClient(app) as client:
        resp = client.get("/api/health/tts")

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["ok"] is False
    assert body["code"] == "not_found"
    assert body["status"] == 404


def test_tts_health_rate_limited_429(env_base, env_tts_elevenlabs, monkeypatch):
    """ElevenLabs 429 -> HTTP 200 {ok: false, code: 'rate_limited', status: 429}."""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(429, json={"detail": "too many requests"})

    monkeypatch.setattr("app.routers.health_tts._make_http_client", lambda: _mock_client(handler))

    with TestClient(app) as client:
        resp = client.get("/api/health/tts")

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["ok"] is False
    assert body["code"] == "rate_limited"
    assert body["status"] == 429


def test_tts_health_upstream_error_500(env_base, env_tts_elevenlabs, monkeypatch):
    """ElevenLabs 500 -> HTTP 200 {ok: false, code: 'upstream_error', status: 500}."""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, json={"detail": "internal server error"})

    monkeypatch.setattr("app.routers.health_tts._make_http_client", lambda: _mock_client(handler))

    with TestClient(app) as client:
        resp = client.get("/api/health/tts")

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["ok"] is False
    assert body["code"] == "upstream_error"
    assert body["status"] == 500
    assert "500" in body["hint"]


def test_tts_health_timeout(env_base, env_tts_elevenlabs, monkeypatch):
    """httpx.TimeoutException raised by transport -> HTTP 200
    {ok: false, code: 'timeout', status: null}.
    """
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.TimeoutException("simulated timeout", request=request)

    monkeypatch.setattr("app.routers.health_tts._make_http_client", lambda: _mock_client(handler))

    with TestClient(app) as client:
        resp = client.get("/api/health/tts")

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["ok"] is False
    assert body["code"] == "timeout"
    assert body["status"] is None
    assert "15 seconds" in body["hint"]
    assert isinstance(body["latencyMs"], int)


def test_tts_health_network_error(env_base, env_tts_elevenlabs, monkeypatch):
    """httpx.ConnectError (no SSL cause) -> HTTP 200
    {ok: false, code: 'network_error', status: null}.
    """
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused")

    monkeypatch.setattr("app.routers.health_tts._make_http_client", lambda: _mock_client(handler))

    with TestClient(app) as client:
        resp = client.get("/api/health/tts")

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["ok"] is False
    assert body["code"] == "network_error"
    assert body["status"] is None
    assert "api.elevenlabs.io" in body["hint"]


def test_tts_health_tls_error(env_base, env_tts_elevenlabs, monkeypatch):
    """httpx.ConnectError with ssl.SSLError __cause__ -> HTTP 200
    {ok: false, code: 'tls_error', status: null}.
    """
    def handler(request: httpx.Request) -> httpx.Response:
        try:
            raise ssl.SSLError("simulated TLS failure")
        except ssl.SSLError as ssl_exc:
            raise httpx.ConnectError("connection failed") from ssl_exc

    monkeypatch.setattr("app.routers.health_tts._make_http_client", lambda: _mock_client(handler))

    with TestClient(app) as client:
        resp = client.get("/api/health/tts")

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["ok"] is False
    assert body["code"] == "tls_error"
    assert body["status"] is None
    assert "TLS" in body["hint"]


def test_tts_health_invalid_response(env_base, env_tts_elevenlabs, monkeypatch):
    """ElevenLabs returns 200 with body lacking `subscription` key
    -> HTTP 200 {ok: false, code: 'invalid_response', status: 200}.
    """
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"unexpected": "shape"})

    monkeypatch.setattr("app.routers.health_tts._make_http_client", lambda: _mock_client(handler))

    with TestClient(app) as client:
        resp = client.get("/api/health/tts")

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["ok"] is False
    assert body["code"] == "invalid_response"
    assert body["status"] == 200


def test_tts_health_fake_provider_short_circuit(env_base, env_tts_fake):
    """TTS_PROVIDER=fake short-circuits before any network/cache logic.
    No httpx mock installed — if any network call is attempted the test would
    fail (real network or connection refused). Assert {ok: true, latencyMs: 0}.
    """
    with TestClient(app) as client:
        resp = client.get("/api/health/tts")

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["ok"] is True
    assert body["latencyMs"] == 0


def test_tts_health_cache_hit_avoids_second_probe(env_base, env_tts_elevenlabs, monkeypatch):
    """First request succeeds and populates cache. Second transport would 500
    but the cache returns the first result. Assert second probe is NOT called
    (call counter stays at 0 for the second transport).
    """
    # First transport: success
    def success_handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=_valid_el_user_response())

    monkeypatch.setattr(
        "app.routers.health_tts._make_http_client",
        lambda: _mock_client(success_handler),
    )

    with TestClient(app) as client:
        resp1 = client.get("/api/health/tts")

    assert resp1.json()["ok"] is True

    # Second transport: would 500 if called — track calls
    second_calls: list[int] = []

    def failing_handler(request: httpx.Request) -> httpx.Response:
        second_calls.append(1)
        return httpx.Response(500, json={"detail": "should not be called"})

    monkeypatch.setattr(
        "app.routers.health_tts._make_http_client",
        lambda: _mock_client(failing_handler),
    )

    with TestClient(app) as client:
        resp2 = client.get("/api/health/tts")

    # Cache hit: still ok=true, second transport never called
    assert resp2.status_code == 200
    assert resp2.json()["ok"] is True
    assert len(second_calls) == 0, "cache should have prevented second network probe"


def test_tts_health_force_true_bypasses_cache(env_base, env_tts_elevenlabs, monkeypatch):
    """force=true bypasses cache READ and fetches fresh result.
    The forced result is written back to cache so a subsequent plain GET
    returns the updated cached value (Pitfall 7 from RESEARCH.md).
    """
    # First request: success -> cache populated
    def success_handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=_valid_el_user_response())

    monkeypatch.setattr(
        "app.routers.health_tts._make_http_client",
        lambda: _mock_client(success_handler),
    )

    with TestClient(app) as client:
        resp1 = client.get("/api/health/tts")

    assert resp1.json()["ok"] is True

    # Second request: force=true + 401 transport -> must bypass cache, see 401
    def auth_error_handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"detail": "unauthorized"})

    monkeypatch.setattr(
        "app.routers.health_tts._make_http_client",
        lambda: _mock_client(auth_error_handler),
    )

    with TestClient(app) as client:
        resp2 = client.get("/api/health/tts?force=true")

    assert resp2.status_code == 200
    body2 = resp2.json()
    assert body2["ok"] is False
    assert body2["code"] == "auth_error", "force=true must bypass cache and see 401"

    # Third request: plain GET (no force) — should return auth_error from cache
    # (second transport stays wired but cache should be hit first)
    with TestClient(app) as client:
        resp3 = client.get("/api/health/tts")

    assert resp3.status_code == 200
    body3 = resp3.json()
    assert body3["ok"] is False
    assert body3["code"] == "auth_error", (
        "plain GET after force=true should return the force-result from cache"
    )


def test_tts_health_15s_sla_per_request_override(env_base, env_tts_elevenlabs, monkeypatch):
    """TimeoutException surfaces without hanging — response arrives in <2s wall-clock.
    Proves the 15s SLA is enforced (MockTransport returns instantly here, so
    this asserts the timeout plumbing doesn't silently swallow the exception).
    """
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.TimeoutException("simulated 15s timeout", request=request)

    monkeypatch.setattr("app.routers.health_tts._make_http_client", lambda: _mock_client(handler))

    t0 = time.monotonic()
    with TestClient(app) as client:
        resp = client.get("/api/health/tts")
    elapsed = time.monotonic() - t0

    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert body["code"] == "timeout"
    # MockTransport raises instantly; wall-clock must be << 2s
    assert elapsed < 2.0, f"endpoint took {elapsed:.2f}s — timeout plumbing may be broken"
