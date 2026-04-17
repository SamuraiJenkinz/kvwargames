"""
Tests for ElevenLabsTTSProvider error-code mapping (Phase 13, plan 13-02).

Verifies all 8 error codes from the TTSProviderError taxonomy:
  httpx.TimeoutException        → timeout
  ApiError 401                  → auth_error
  ApiError 403                  → auth_error
  ApiError 404                  → not_found
  ApiError 429                  → rate_limited
  ApiError 503                  → upstream_error
  httpx.ConnectError (TLS)      → tls_error
  httpx.ConnectError (non-TLS)  → network_error
  httpx.RequestError (generic)  → network_error
  empty bytes (200 OK)          → invalid_response

Uses httpx.MockTransport injected via the httpx_client kwarg on ElevenLabsTTSProvider
so the SDK's internal HTTP layer is fully intercepted — no real network calls.
"""

from __future__ import annotations

import ssl
from typing import Callable

import httpx
import pytest
from elevenlabs.core import ApiError

from app.services.tts.elevenlabs_provider import ElevenLabsTTSProvider
from app.services.tts.errors import TTSProviderError


def _make_provider(handler: Callable) -> ElevenLabsTTSProvider:
    """Build an ElevenLabsTTSProvider with an httpx.MockTransport injected."""
    mock_client = httpx.Client(transport=httpx.MockTransport(handler))
    return ElevenLabsTTSProvider(
        api_key="test-key",
        model_id="eleven_multilingual_v2",
        output_format="mp3_44100_128",
        httpx_client=mock_client,
    )


def test_success_path_returns_bytes():
    """200 OK with MP3 bytes must be returned unchanged."""
    expected = b"\xff\xfb" + b"\x00" * 100

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=expected)

    provider = _make_provider(handler)
    result = provider.synthesise("hello", "test-voice")
    assert result == expected


def test_timeout_maps_to_timeout_code():
    """httpx.TimeoutException must map to TTSProviderError(code='timeout')."""
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.TimeoutException("timed out", request=request)

    provider = _make_provider(handler)
    with pytest.raises(TTSProviderError) as exc_info:
        provider.synthesise("hello", "test-voice")
    err = exc_info.value
    assert err.code == "timeout"
    assert err.status is None


def test_http_401_maps_to_auth_error():
    """ApiError with status 401 must map to TTSProviderError(code='auth_error')."""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"detail": {"status": "unauthorized", "message": "bad key"}})

    provider = _make_provider(handler)
    with pytest.raises(TTSProviderError) as exc_info:
        provider.synthesise("hello", "test-voice")
    err = exc_info.value
    assert err.code == "auth_error"
    assert err.status == 401


def test_http_403_maps_to_auth_error():
    """ApiError with status 403 must map to TTSProviderError(code='auth_error')."""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(403, json={"detail": {"status": "forbidden", "message": "forbidden"}})

    provider = _make_provider(handler)
    with pytest.raises(TTSProviderError) as exc_info:
        provider.synthesise("hello", "test-voice")
    err = exc_info.value
    assert err.code == "auth_error"
    assert err.status == 403


def test_http_404_maps_to_not_found():
    """ApiError with status 404 must map to TTSProviderError(code='not_found')."""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404, json={"detail": {"status": "not_found", "message": "voice not found"}})

    provider = _make_provider(handler)
    with pytest.raises(TTSProviderError) as exc_info:
        provider.synthesise("hello", "test-voice")
    err = exc_info.value
    assert err.code == "not_found"
    assert err.status == 404


def test_http_429_maps_to_rate_limited():
    """ApiError with status 429 must map to TTSProviderError(code='rate_limited')."""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(429, json={"detail": {"status": "too_many_requests", "message": "slow down"}})

    provider = _make_provider(handler)
    with pytest.raises(TTSProviderError) as exc_info:
        provider.synthesise("hello", "test-voice")
    err = exc_info.value
    assert err.code == "rate_limited"
    assert err.status == 429


def test_http_503_maps_to_upstream_error():
    """ApiError with status 503 must map to TTSProviderError(code='upstream_error')."""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(503, json={"detail": {"status": "service_unavailable", "message": "overloaded"}})

    provider = _make_provider(handler)
    with pytest.raises(TTSProviderError) as exc_info:
        provider.synthesise("hello", "test-voice")
    err = exc_info.value
    assert err.code == "upstream_error"
    assert err.status == 503


def test_connect_error_tls_maps_to_tls_error():
    """httpx.ConnectError with SSLError cause must map to TTSProviderError(code='tls_error')."""
    def handler(request: httpx.Request) -> httpx.Response:
        ssl_cause = ssl.SSLError("certificate verify failed")
        exc = httpx.ConnectError("SSL handshake failed", request=request)
        exc.__cause__ = ssl_cause
        raise exc

    provider = _make_provider(handler)
    with pytest.raises(TTSProviderError) as exc_info:
        provider.synthesise("hello", "test-voice")
    err = exc_info.value
    assert err.code == "tls_error"


def test_connect_error_nontls_maps_to_network_error():
    """httpx.ConnectError without SSLError cause must map to TTSProviderError(code='network_error')."""
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused", request=request)

    provider = _make_provider(handler)
    with pytest.raises(TTSProviderError) as exc_info:
        provider.synthesise("hello", "test-voice")
    err = exc_info.value
    assert err.code == "network_error"


def test_generic_request_error_maps_to_network_error():
    """A generic httpx.RequestError (non-ConnectError, non-Timeout) must map to 'network_error'."""
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.RequestError("transport failed", request=request)

    provider = _make_provider(handler)
    with pytest.raises(TTSProviderError) as exc_info:
        provider.synthesise("hello", "test-voice")
    err = exc_info.value
    assert err.code == "network_error"


def test_empty_bytes_maps_to_invalid_response():
    """200 OK with empty body must map to TTSProviderError(code='invalid_response')."""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=b"")

    provider = _make_provider(handler)
    with pytest.raises(TTSProviderError) as exc_info:
        provider.synthesise("hello", "test-voice")
    err = exc_info.value
    assert err.code == "invalid_response"
