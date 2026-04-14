"""
Tests for the config generation endpoint (POST /api/generate-config).

Added in Plan 07-03:
  - Test A: request payload includes response_format: json_object
  - Test B: request payload system message contains the literal word "JSON"
  - Test C: system prompt contains GameConfig shape fields (pcThresholds, nationalActions,
            redLines) and does NOT contain old shape fields (winConditions, scenarioName)
  - Test D: 200 OK response body is returned as {text: string} (happy path)
  - Test E: upstream 401 maps to LLM_AUTH_ERROR with 401 status
  - Test F: upstream timeout maps to LLM_TIMEOUT 504

Technique:
  Uses httpx.MockTransport (built-in, no extra deps) to intercept the outbound
  upstream request. Follows the same pattern as test_llm_auth_header.py (Plan 06-01).
"""

from __future__ import annotations

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers.config_gen import CONFIG_GEN_SYSTEM_PROMPT


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _build_mock_client_capture(
    captured: list[httpx.Request],
    response_status: int = 200,
    response_json: dict | None = None,
) -> httpx.AsyncClient:
    """Build an AsyncClient that captures requests and returns a canned response."""
    if response_json is None:
        response_json = {
            "choices": [
                {"message": {"role": "assistant", "content": '{"name": "Test Game", "JSON": true}'}}
            ]
        }

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return httpx.Response(response_status, json=response_json)

    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


def _build_timeout_client() -> httpx.AsyncClient:
    """Build an AsyncClient that always raises TimeoutException."""

    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.TimeoutException("upstream timed out", request=request)

    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


def _post_generate_config(client: TestClient, brief: str = "A test brief.") -> httpx.Response:
    return client.post(
        "/api/generate-config",
        json={"brief": brief},
    )


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_request_payload_includes_response_format_json_object(env_base):
    """
    Test A: The outbound request to the upstream LLM includes
    response_format: {"type": "json_object"} in the JSON body.
    """
    captured: list[httpx.Request] = []

    with TestClient(app) as client:
        original = app.state.http_client
        app.state.http_client = _build_mock_client_capture(captured)
        try:
            resp = _post_generate_config(client)
        finally:
            app.state.http_client = original

    assert resp.status_code == 200, resp.text
    assert len(captured) == 1
    outbound_body = captured[0].read()
    import json
    payload = json.loads(outbound_body)
    assert payload.get("response_format") == {"type": "json_object"}, (
        f"Expected response_format={{type: json_object}} in payload, got: {payload.get('response_format')}"
    )


def test_request_payload_system_message_contains_json_literal(env_base):
    """
    Test B: The outbound request system message content contains the literal
    word "JSON" (required by OpenAI for json_object mode).
    """
    captured: list[httpx.Request] = []

    with TestClient(app) as client:
        original = app.state.http_client
        app.state.http_client = _build_mock_client_capture(captured)
        try:
            resp = _post_generate_config(client)
        finally:
            app.state.http_client = original

    assert resp.status_code == 200, resp.text
    import json
    payload = json.loads(captured[0].read())
    messages = payload.get("messages", [])
    system_messages = [m for m in messages if m.get("role") == "system"]
    assert system_messages, "No system message found in outbound payload"
    system_content = system_messages[0]["content"]
    assert "JSON" in system_content, (
        f"The word 'JSON' must appear in the system prompt (OpenAI json_object requirement). "
        f"Got: {system_content[:200]}..."
    )


def test_system_prompt_contains_gamconfig_shape_fields(env_base):
    """
    Test C: CONFIG_GEN_SYSTEM_PROMPT describes the GameConfig shape correctly.
    - Contains: pcThresholds, nationalActions, redLines (GameConfig fields)
    - Does NOT contain: winConditions, scenarioName (old wrong shape)
    """
    assert "pcThresholds" in CONFIG_GEN_SYSTEM_PROMPT, (
        "System prompt missing 'pcThresholds' — old shape may still be in use"
    )
    assert "nationalActions" in CONFIG_GEN_SYSTEM_PROMPT, (
        "System prompt missing 'nationalActions'"
    )
    assert "redLines" in CONFIG_GEN_SYSTEM_PROMPT, (
        "System prompt missing 'redLines'"
    )
    assert "winConditions" not in CONFIG_GEN_SYSTEM_PROMPT, (
        "System prompt still references old field 'winConditions' — purge it"
    )
    assert "scenarioName" not in CONFIG_GEN_SYSTEM_PROMPT, (
        "System prompt still references old field 'scenarioName' — purge it"
    )


def test_200_ok_response_body_is_text_string(env_base):
    """
    Test D: On 200 OK from upstream, the endpoint returns {text: string}
    where text is the raw LLM output.
    """
    captured: list[httpx.Request] = []
    expected_content = '{"name": "My Game", "JSON": "valid"}'
    mock_response_json = {
        "choices": [
            {"message": {"role": "assistant", "content": expected_content}}
        ]
    }

    with TestClient(app) as client:
        original = app.state.http_client
        app.state.http_client = _build_mock_client_capture(
            captured, response_status=200, response_json=mock_response_json
        )
        try:
            resp = _post_generate_config(client, brief="A proper brief for testing.")
        finally:
            app.state.http_client = original

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "text" in body, f"Response body missing 'text' key: {body}"
    assert isinstance(body["text"], str), f"'text' should be a string, got: {type(body['text'])}"
    assert body["text"] == expected_content


def test_upstream_401_maps_to_llm_auth_error(env_base):
    """
    Test E: When upstream returns 401, the endpoint returns LLM_AUTH_ERROR with status 401.
    """
    captured: list[httpx.Request] = []

    with TestClient(app) as client:
        original = app.state.http_client
        app.state.http_client = _build_mock_client_capture(
            captured,
            response_status=401,
            response_json={"error": {"message": "Invalid API key"}},
        )
        try:
            resp = _post_generate_config(client)
        finally:
            app.state.http_client = original

    assert resp.status_code == 401, resp.text
    body = resp.json()
    assert body.get("error", {}).get("code") == "LLM_AUTH_ERROR", (
        f"Expected LLM_AUTH_ERROR, got: {body}"
    )


def test_upstream_timeout_maps_to_llm_timeout_504(env_base):
    """
    Test F: When upstream times out, the endpoint returns LLM_TIMEOUT with status 504.
    """
    with TestClient(app) as client:
        original = app.state.http_client
        app.state.http_client = _build_timeout_client()
        try:
            resp = _post_generate_config(client)
        finally:
            app.state.http_client = original

    assert resp.status_code == 504, resp.text
    body = resp.json()
    assert body.get("error", {}).get("code") == "LLM_TIMEOUT", (
        f"Expected LLM_TIMEOUT, got: {body}"
    )
