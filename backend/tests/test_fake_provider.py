"""
Tests for FakeTTSProvider (Phase 13, plan 13-02).

Verifies:
  - FakeTTSProvider instantiates via get_tts_provider when TTS_PROVIDER=fake.
  - synthesise() returns valid MP3 bytes (>= 70 KB, correct header magic).
  - Output is deterministic: same (text, voice_id) -> identical bytes.
  - Different voice_ids return different fixture bytes.
  - Unknown voice_id falls back to Kent fixture (does not raise).
  - FAKE_TTS_DELAY_SECONDS=0 makes the call fast (< 0.5s wall-clock).
  - CRITICAL (Phase 13 SC-2): FakeTTSProvider makes ZERO outbound HTTP calls
    to api.elevenlabs.io (proved by httpx MockTransport side-effect spy).
"""

from __future__ import annotations

import os
import time
from pathlib import Path
from unittest import mock

import pytest

from app.config import Settings, get_settings
from app.services.tts import get_tts_provider
from app.services.tts.fake_provider import CHEN_BYTES, FINCH_BYTES, KENT_BYTES


def _make_fake_provider(monkeypatch, delay_seconds: float = 0.0):
    """Helper: instantiate FakeTTSProvider via the factory with delay=0 by default."""
    monkeypatch.setitem(Settings.model_config, "env_file", None)
    monkeypatch.setenv("FAKE_TTS_DELAY_SECONDS", str(delay_seconds))
    monkeypatch.delenv("TTS_PROVIDER", raising=False)
    get_settings.cache_clear()
    settings = Settings(_env_file=None)
    return get_tts_provider(settings)


def test_fake_provider_returns_fixture_bytes(env_base, monkeypatch):
    """FakeTTSProvider.synthesise() must return >= 70 KB of valid MP3 bytes."""
    provider = _make_fake_provider(monkeypatch)
    result = provider.synthesise("any text", "__fake_kent__")
    assert len(result) >= 70_000, f"Expected >= 70000 bytes, got {len(result)}"
    # Valid MPEG sync bytes (0xFF 0xFB) or ID3 tag (ID3)
    assert result[:2] == b"\xff\xfb" or result[:3] == b"ID3", (
        f"Expected MPEG sync or ID3 header, got {result[:4].hex()}"
    )


def test_fake_provider_deterministic(env_base, monkeypatch):
    """Same (text, voice_id) must return byte-identical output on repeated calls."""
    provider = _make_fake_provider(monkeypatch)
    result_a = provider.synthesise("hello world", "__fake_kent__")
    result_b = provider.synthesise("hello world", "__fake_kent__")
    assert result_a == result_b, "FakeTTSProvider output is not deterministic"


def test_fake_provider_distinct_voices_return_distinct_bytes(env_base, monkeypatch):
    """The three voice sentinels must each return different fixture bytes."""
    provider = _make_fake_provider(monkeypatch)
    kent = provider.synthesise("text", "__fake_kent__")
    finch = provider.synthesise("text", "__fake_finch__")
    chen = provider.synthesise("text", "__fake_chen__")
    assert kent != finch, "Kent and Finch fixtures should be different"
    assert kent != chen, "Kent and Chen fixtures should be different"
    assert finch != chen, "Finch and Chen fixtures should be different"


def test_fake_provider_unknown_voice_falls_back_not_raises(env_base, monkeypatch):
    """An unmapped voice_id must return Kent fixture bytes without raising."""
    provider = _make_fake_provider(monkeypatch)
    result = provider.synthesise("text", "completely-unknown-voice-id")
    assert isinstance(result, bytes), "Should return bytes even for unknown voice_id"
    assert result == KENT_BYTES, "Unknown voice_id should fall back to Kent fixture"


def test_fake_provider_delay_zero_in_tests(env_base, monkeypatch):
    """With FAKE_TTS_DELAY_SECONDS=0, synthesise() must complete in < 0.5s."""
    provider = _make_fake_provider(monkeypatch, delay_seconds=0.0)
    t0 = time.monotonic()
    provider.synthesise("text", "__fake_kent__")
    elapsed = time.monotonic() - t0
    assert elapsed < 0.5, f"Expected < 0.5s elapsed, got {elapsed:.3f}s"


def test_fake_provider_makes_zero_network_calls(env_base, monkeypatch):
    """CRITICAL (Phase 13 SC-2): FakeTTSProvider must make zero outbound HTTP calls.

    Strategy: patch httpx._client.HTTPTransport.handle_request to raise immediately
    if ever called. Then call synthesise() in a loop. If any network call is
    attempted, the test fails fast with AssertionError.

    Also confirms structurally that fake_provider.py does not import httpx.
    """
    provider = _make_fake_provider(monkeypatch)

    def _no_network(*args, **kwargs):
        raise AssertionError(
            "FakeTTSProvider attempted an outbound HTTP call — violates Phase 13 SC-2"
        )

    with mock.patch("httpx._client.HTTPTransport.handle_request", side_effect=_no_network):
        # Multiple calls to exercise all code paths
        for _ in range(3):
            provider.synthesise("x", "__fake_kent__")
        provider.synthesise("y", "__fake_finch__")
        provider.synthesise("z", "__fake_chen__")
        # Unknown voice (fallback path)
        provider.synthesise("w", "unknown-voice")

    # Structural assertion: fake_provider.py must not import httpx or requests
    fake_provider_source = (
        Path(__file__).parent.parent / "app" / "services" / "tts" / "fake_provider.py"
    ).read_text()
    assert "import httpx" not in fake_provider_source, (
        "fake_provider.py imports httpx — remove it (zero network surface area)"
    )
    assert "import requests" not in fake_provider_source, (
        "fake_provider.py imports requests — remove it (zero network surface area)"
    )
    assert "api.elevenlabs.io" not in fake_provider_source, (
        "fake_provider.py references api.elevenlabs.io — remove it"
    )
