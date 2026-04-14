"""
Regression tests for the configurable LLM auth header (Plan 06-01).

These tests prove that:
  1. Default config produces `Authorization: Bearer <key>` on the outbound
     upstream request, with no `api-key` header — matches every prior OpenAI-
     compatible deployment behaviour.
  2. With `LLM_AUTH_HEADER_NAME=api-key` and `LLM_AUTH_VALUE_PREFIX=`, the
     outbound request carries `api-key: <key>` with NO Authorization header —
     matches Azure OpenAI's auth contract.

Technique:
  A captured-request list is populated by an httpx.MockTransport handler.
  The shared `app.state.http_client` is swapped for an AsyncClient wired to
  that transport, so the llm router proxies to the mock instead of the real
  upstream.  This avoids any network dependency and requires no new test
  dependencies (httpx.MockTransport is built in).

Guards:
  A future accidental re-hardcoding of `"Authorization": f"Bearer {key}"`
  would break `test_azure_api_key_style` immediately.
"""

from __future__ import annotations

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _build_mock_client(captured: list[httpx.Request]) -> httpx.AsyncClient:
    """AsyncClient whose every request is captured and answered with a canned
    OpenAI-style chat completion body."""

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return httpx.Response(
            200,
            json={
                "choices": [
                    {"message": {"role": "assistant", "content": "ok"}}
                ]
            },
        )

    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


def _post_trivial_llm_request(client: TestClient) -> httpx.Response:
    return client.post(
        "/api/llm",
        json={
            "systemPrompt": "test prompt",
            "messages": [{"role": "user", "content": "hello"}],
        },
    )


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_default_uses_authorization_bearer(env_base):
    """
    With only the required LLM_* env vars set, the outbound upstream request
    must carry `Authorization: Bearer <key>` and MUST NOT carry `api-key`.
    """
    captured: list[httpx.Request] = []

    with TestClient(app) as client:
        # Replace the lifespan-created real client with our mock.
        original = app.state.http_client
        app.state.http_client = _build_mock_client(captured)
        try:
            resp = _post_trivial_llm_request(client)
        finally:
            # Restore so the outer `with` block's shutdown closes the real
            # AsyncClient (not our mock, which we keep open-and-drop; fine
            # for a test process).
            app.state.http_client = original

    assert resp.status_code == 200, resp.text
    assert len(captured) == 1
    outbound = captured[0]
    assert outbound.headers.get("Authorization") == "Bearer test-key-abc123"
    assert "api-key" not in outbound.headers


def test_azure_api_key_style(env_base, monkeypatch):
    """
    With `LLM_AUTH_HEADER_NAME=api-key` and empty `LLM_AUTH_VALUE_PREFIX`, the
    outbound request must carry `api-key: <key>` (raw, no prefix) and MUST
    NOT carry `Authorization`.
    """
    monkeypatch.setenv("LLM_AUTH_HEADER_NAME", "api-key")
    monkeypatch.setenv("LLM_AUTH_VALUE_PREFIX", "")

    captured: list[httpx.Request] = []

    with TestClient(app) as client:
        original = app.state.http_client
        app.state.http_client = _build_mock_client(captured)
        try:
            resp = _post_trivial_llm_request(client)
        finally:
            app.state.http_client = original

    assert resp.status_code == 200, resp.text
    assert len(captured) == 1
    outbound = captured[0]
    assert outbound.headers.get("api-key") == "test-key-abc123"
    assert "Authorization" not in outbound.headers
