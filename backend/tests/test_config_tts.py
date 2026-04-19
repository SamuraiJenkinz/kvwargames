"""
Pytest coverage for GET /api/config/tts-voices endpoint (Plan 16-01).

Scenarios:
  1. TTS_PROVIDER=fake  → response body is exactly the three sentinel strings
  2. TTS_PROVIDER=elevenlabs → response body is the three configured voice ID stubs
  3. Response shape contract → exactly three string keys kent/finch/chen, no extra fields

Fixtures used:
  - env_base      (conftest.py) — provides required LLM_* env vars
  - env_tts_fake  (conftest.py) — sets TTS_PROVIDER=fake
  - env_tts_elevenlabs (conftest.py) — sets TTS_PROVIDER=elevenlabs with stub IDs
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app


def test_returns_sentinels_when_tts_provider_fake(env_base, env_tts_fake):
    """With TTS_PROVIDER=fake, the endpoint returns the three __fake_*__ sentinel strings.

    This preserves existing Phase 14 fake-mode behaviour verbatim — no tests should
    regress when the sentinel-dispatch is moved server-side.
    """
    with TestClient(app) as client:
        resp = client.get("/api/config/tts-voices")

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body == {
        "kent": "__fake_kent__",
        "finch": "__fake_finch__",
        "chen": "__fake_chen__",
    }


def test_returns_configured_ids_when_tts_provider_elevenlabs(env_base, env_tts_elevenlabs):
    """With TTS_PROVIDER=elevenlabs, the endpoint returns the ELEVENLABS_VOICE_* values.

    env_tts_elevenlabs sets:
      ELEVENLABS_VOICE_KENT  = "fake-voice-kent"
      ELEVENLABS_VOICE_FINCH = "fake-voice-finch"
      ELEVENLABS_VOICE_CHEN  = "fake-voice-chen"

    These are stub strings — not real ElevenLabs IDs.  The test proves the endpoint
    reads from settings; the live replay (Task 2) proves real IDs reach ElevenLabs.
    """
    with TestClient(app) as client:
        resp = client.get("/api/config/tts-voices")

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body == {
        "kent": "fake-voice-kent",
        "finch": "fake-voice-finch",
        "chen": "fake-voice-chen",
    }


def test_response_shape_stable(env_base, env_tts_fake):
    """Response is exactly the three string keys kent/finch/chen — no extra fields.

    This is the contract the frontend ttsVoicesClient.ts depends on.  If the shape
    changes, the frontend client must be updated simultaneously.
    """
    with TestClient(app) as client:
        resp = client.get("/api/config/tts-voices")

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert set(body.keys()) == {"kent", "finch", "chen"}, (
        f"Expected exactly {{kent, finch, chen}} keys; got {set(body.keys())}"
    )
    assert all(isinstance(v, str) for v in body.values()), (
        "All voice map values must be strings"
    )
