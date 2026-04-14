"""
Backend error-injection tests for Phase 08-04.

Scenarios (using httpx.MockTransport — same pattern as test_llm_auth_header.py):
  1. Upstream raises TimeoutException        -> backend returns 504 LLM_TIMEOUT
  2. Upstream responds HTTP 500              -> backend returns 502 LLM_UPSTREAM_ERROR
     (router maps any non-2xx non-401 upstream to 502 LLM_UPSTREAM_ERROR — see
     backend/app/routers/llm.py lines 122-132. The plan's reference to "500
     returns 500" was written against an assumed envelope; the test asserts
     against the actual router behaviour as stated in decisions_locked #3 —
     "do NOT modify production code".)
  3. Upstream returns 200 OK but the JSON body is truncated/malformed (missing
     choices[0].message.content)            -> backend returns 500 INTERNAL_ERROR
     via the generic Exception catch-all (KeyError during content extraction).

Technique:
  Copies the httpx.MockTransport + app.state.http_client swap pattern locked
  in Plan 06-01 (backend/tests/test_llm_auth_header.py lines 38-53). No new
  test dependencies. Reuses the `env_base` fixture from conftest.py.
"""

from __future__ import annotations

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app


# ---------------------------------------------------------------------------
# Mock-transport factories
# ---------------------------------------------------------------------------


def _build_mock_client_timeout() -> httpx.AsyncClient:
    """AsyncClient whose every request raises httpx.TimeoutException — the
    only failure mode that reaches the router's LLM_TIMEOUT (504) branch."""

    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.TimeoutException("simulated upstream timeout", request=request)

    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


def _build_mock_client_upstream_status(status: int) -> httpx.AsyncClient:
    """AsyncClient that returns a non-2xx upstream response — reaches the
    router's HTTPStatusError branch. Status 401 -> LLM_AUTH_ERROR; any other
    non-2xx -> LLM_UPSTREAM_ERROR (502)."""

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            status,
            json={"error": {"code": "upstream_failure", "message": f"HTTP {status}"}},
        )

    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


def _build_mock_client_truncated() -> httpx.AsyncClient:
    """AsyncClient that returns 200 OK with a truncated/malformed JSON body —
    cuts off mid-field so `data["choices"][0]["message"]["content"]` raises a
    KeyError (or json.JSONDecodeError, depending on how much survives). Both
    paths end at the router's generic Exception catch -> INTERNAL_ERROR (500)."""

    def handler(request: httpx.Request) -> httpx.Response:
        # Valid JSON shape but missing the "content" field inside message.
        # This ensures JSON parse succeeds but the content extraction KeyErrors.
        return httpx.Response(
            200,
            json={"choices": [{"message": {"role": "assistant"}}]},
        )

    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


def _post_trivial_llm_request(client: TestClient) -> httpx.Response:
    """Minimal /api/llm request body that satisfies LLMProxyRequest — same
    shape as test_llm_auth_header.py::_post_trivial_llm_request."""
    return client.post(
        "/api/llm",
        json={
            "systemPrompt": "test prompt",
            "messages": [{"role": "user", "content": "ping"}],
        },
    )


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_upstream_timeout_returns_504_llm_timeout(env_base):
    """httpx.TimeoutException raised upstream -> 504 with LLM_TIMEOUT code."""
    with TestClient(app) as client:
        original = app.state.http_client
        app.state.http_client = _build_mock_client_timeout()
        try:
            resp = _post_trivial_llm_request(client)
        finally:
            app.state.http_client = original

    assert resp.status_code == 504, resp.text
    body = resp.json()
    assert body["error"]["code"] == "LLM_TIMEOUT"


def test_upstream_500_returns_502_llm_upstream_error(env_base):
    """Upstream HTTP 500 -> 502 LLM_UPSTREAM_ERROR (router maps all non-2xx
    non-401 upstream responses to 502). The test asserts the actual router
    behaviour, not the hypothetical pass-through shape."""
    with TestClient(app) as client:
        original = app.state.http_client
        app.state.http_client = _build_mock_client_upstream_status(500)
        try:
            resp = _post_trivial_llm_request(client)
        finally:
            app.state.http_client = original

    assert resp.status_code == 502, resp.text
    body = resp.json()
    assert body["error"]["code"] == "LLM_UPSTREAM_ERROR"


def test_truncated_body_returns_500_internal_error(env_base):
    """Upstream 200 with a body that passes json-parse but is missing the
    expected `choices[0].message.content` field — KeyError flows through the
    generic Exception handler and surfaces as 500 INTERNAL_ERROR."""
    with TestClient(app) as client:
        original = app.state.http_client
        app.state.http_client = _build_mock_client_truncated()
        try:
            resp = _post_trivial_llm_request(client)
        finally:
            app.state.http_client = original

    assert resp.status_code == 500, resp.text
    body = resp.json()
    assert body["error"]["code"] == "INTERNAL_ERROR"
