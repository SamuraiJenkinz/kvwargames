"""
Pytest coverage for the GET /api/health/llm endpoint (Plan 09-01 / 09-02).

Scenarios (all use httpx.MockTransport — same pattern as
test_llm_auth_header.py and test_error_injection.py):

  1. Success            — upstream 200 with valid chat-completions body
                          -> HTTP 200 {ok: true, latencyMs}
  2. Auth failure (401) — upstream 401
                          -> HTTP 200 {ok: false, code: "auth_error",
                                       status: 401, hint mentions LLM_API_KEY}
  3. Timeout            — httpx.TimeoutException from the transport
                          -> HTTP 200 {ok: false, code: "timeout", status: null}
  4. Auth-mode parity   — LLM_AUTH_HEADER_NAME=api-key, empty prefix
                          -> upstream request carries `api-key: <raw key>`
                             and NOT `Authorization: Bearer ...`
  5. Extra-headers parity — LLM_EXTRA_HEADERS='{"X-Corp-Trace":...}'
                          -> every configured extra header appears on the
                             upstream request.

Guards:
  Tests 4 and 5 are the specific guards against Pitfall 1 from 09-RESEARCH.md:
  a future contributor accidentally copying config_gen.py's hardcoded
  `Authorization: Bearer <key>` construction into health.py would fail
  test_health_check_uses_configurable_auth_header immediately. Likewise,
  dropping the `**settings.get_extra_headers()` spread would fail
  test_health_check_forwards_extra_headers.

Pattern:
  Every test that swaps app.state.http_client pairs the swap with a
  try/finally restore (Pitfall 3 from 09-RESEARCH.md — an unrestored swap
  leaks the mock into subsequent tests). The MockTransport factory is
  local to each test (or built inline) so captured-request state does not
  leak between tests.
"""

from __future__ import annotations

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _valid_chat_completion_response() -> dict:
    """Canned OpenAI-style chat completion body — the shape health.py expects."""
    return {"choices": [{"message": {"role": "assistant", "content": "OK"}}]}


def _mock_client(handler) -> httpx.AsyncClient:
    """AsyncClient wired to a MockTransport running the given handler."""
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


# ---------------------------------------------------------------------------
# Tests — mandatory scenarios
# ---------------------------------------------------------------------------


def test_health_check_success(env_base):
    """Upstream 200 with valid body -> HTTP 200 {ok: true, latencyMs: <int>}."""

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=_valid_chat_completion_response())

    with TestClient(app) as client:
        original = app.state.http_client
        app.state.http_client = _mock_client(handler)
        try:
            resp = client.get("/api/health/llm")
        finally:
            app.state.http_client = original

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["ok"] is True
    assert isinstance(body["latencyMs"], int)
    assert body["latencyMs"] >= 0
    # On success, the shape is exactly {ok, latencyMs} — no extra keys.
    assert set(body.keys()) == {"ok", "latencyMs"}


def test_health_check_auth_failure_401(env_base):
    """Upstream 401 -> HTTP 200 {ok: false, code: 'auth_error', status: 401}
    with a hint that names LLM_API_KEY (actionable for the operator)."""

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"error": "unauthorized"})

    with TestClient(app) as client:
        original = app.state.http_client
        app.state.http_client = _mock_client(handler)
        try:
            resp = client.get("/api/health/llm")
        finally:
            app.state.http_client = original

    # The endpoint ALWAYS returns HTTP 200 — clients discriminate on body.ok.
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["ok"] is False
    assert body["code"] == "auth_error"
    assert body["status"] == 401
    assert isinstance(body["hint"], str) and body["hint"]
    assert "LLM_API_KEY" in body["hint"]
    assert isinstance(body["latencyMs"], int)


def test_health_check_timeout(env_base):
    """httpx.TimeoutException from the transport -> HTTP 200
    {ok: false, code: 'timeout', status: null} with a hint mentioning 15s."""

    def handler(request: httpx.Request) -> httpx.Response:
        # The `request=` kwarg is required by httpx's exception constructor
        # (09-RESEARCH.md Q6).
        raise httpx.TimeoutException("mock timeout", request=request)

    with TestClient(app) as client:
        original = app.state.http_client
        app.state.http_client = _mock_client(handler)
        try:
            resp = client.get("/api/health/llm")
        finally:
            app.state.http_client = original

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["ok"] is False
    assert body["code"] == "timeout"
    assert body["status"] is None
    assert isinstance(body["hint"], str) and body["hint"]
    # Hint must surface the 15s SLA so the operator knows what timed out.
    assert "15 seconds" in body["hint"] or "15s" in body["hint"]
    assert isinstance(body["latencyMs"], int)


# ---------------------------------------------------------------------------
# Tests — parity guards (Pitfall 1 from 09-RESEARCH.md)
# ---------------------------------------------------------------------------


def test_health_check_uses_configurable_auth_header(env_base, monkeypatch):
    """With LLM_AUTH_HEADER_NAME=api-key and empty prefix, the outbound
    upstream request must carry `api-key: <raw key>` and MUST NOT carry
    Authorization. This is the regression guard against a future refactor
    that copies config_gen.py's hardcoded Bearer pattern into health.py."""
    monkeypatch.setenv("LLM_AUTH_HEADER_NAME", "api-key")
    monkeypatch.setenv("LLM_AUTH_VALUE_PREFIX", "")

    captured: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return httpx.Response(200, json=_valid_chat_completion_response())

    with TestClient(app) as client:
        original = app.state.http_client
        app.state.http_client = _mock_client(handler)
        try:
            resp = client.get("/api/health/llm")
        finally:
            app.state.http_client = original

    assert resp.status_code == 200, resp.text
    assert len(captured) == 1, "expected exactly one upstream probe"
    outbound = captured[0]
    # Raw key, no "Bearer " prefix.
    assert outbound.headers.get("api-key") == "test-key-abc123"
    # Authorization must be absent (httpx Headers is case-insensitive on
    # lookup, so `in` is a reliable case-insensitive membership test).
    assert "Authorization" not in outbound.headers
    assert "authorization" not in outbound.headers


def test_health_check_forwards_extra_headers(env_base, monkeypatch):
    """With LLM_EXTRA_HEADERS set, each configured header must appear on
    the outbound upstream request. Guards against a refactor that drops
    the `**settings.get_extra_headers()` spread from the header dict."""
    monkeypatch.setenv(
        "LLM_EXTRA_HEADERS",
        '{"X-Corp-Trace":"abc123","X-Environment":"test"}',
    )

    captured: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return httpx.Response(200, json=_valid_chat_completion_response())

    with TestClient(app) as client:
        original = app.state.http_client
        app.state.http_client = _mock_client(handler)
        try:
            resp = client.get("/api/health/llm")
        finally:
            app.state.http_client = original

    assert resp.status_code == 200, resp.text
    assert len(captured) == 1, "expected exactly one upstream probe"
    outbound = captured[0]
    assert outbound.headers.get("X-Corp-Trace") == "abc123"
    assert outbound.headers.get("X-Environment") == "test"
