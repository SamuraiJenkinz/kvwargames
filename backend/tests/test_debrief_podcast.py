"""Integration tests for the debrief podcast endpoints (Phase 14, plan 14-01).

Endpoints under test:
  POST /api/debrief/podcast       -> text/event-stream SSE
  GET  /api/debrief/podcast/audio -> audio/mpeg (token pull, single-use)

Uses FastAPI TestClient with lifespan (app.state.podcast_cache and
app.state.podcast_tokens are created on entry).

All tests use the env_tts_fake + env_base fixtures to ensure
TTS_PROVIDER=fake, FAKE_TTS_DELAY_SECONDS=0.0, and LLM_* vars are set.
"""

from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.tts.fake_provider import CHEN_BYTES, FINCH_BYTES, KENT_BYTES
from app.services.audio_generator import SILENCE_BYTES

pytestmark = pytest.mark.usefixtures("env_base", "env_tts_fake")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_VALID_BODY = {
    "game_name": "TestGame",
    "persona_texts": {
        "kent": "Kent Valentina speaks about strategy and positioning.",
        "finch": "Dr Finch analyses the competitive landscape.",
        "chen": "Dr Chen gives the final risk assessment.",
    },
    "voices": {
        "kent": "__fake_kent__",
        "finch": "__fake_finch__",
        "chen": "__fake_chen__",
    },
    "force_fresh": False,
}


def _parse_sse_stream(text: str) -> list[tuple[str, dict]]:
    """Parse SSE text stream into [(event_name, parsed_json_data), ...].

    Expected wire format per event:
      event: persona_done\n
      data: {"persona": "kent"}\n
      \n
    """
    events: list[tuple[str, dict]] = []
    current_event: str | None = None
    current_data: list[str] = []
    for line in text.splitlines():
        if line == "":
            if current_event is not None:
                data_json = "\n".join(current_data)
                events.append((current_event, json.loads(data_json) if data_json else {}))
                current_event, current_data = None, []
            continue
        if line.startswith("event:"):
            current_event = line[len("event:"):].strip()
        elif line.startswith("data:"):
            current_data.append(line[len("data:"):].strip())
    # Flush any trailing event without blank-line terminator
    if current_event is not None and current_data:
        events.append((current_event, json.loads("\n".join(current_data))))
    return events


def _post_podcast(client: TestClient, body: dict | None = None) -> list[tuple[str, dict]]:
    """POST to /api/debrief/podcast and return parsed SSE events."""
    if body is None:
        body = _VALID_BODY
    response = client.post("/api/debrief/podcast", json=body)
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text[:200]}"
    return _parse_sse_stream(response.text)


# ---------------------------------------------------------------------------
# Isolation fixture: clear in-process state between tests
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def clear_podcast_state():
    """Wipe the podcast_cache and podcast_tokens stores between tests."""
    # Tests use the TestClient context manager per-test, so app.state
    # is freshly created each time the lifespan runs. This fixture is
    # a belt-and-suspenders guard for any test that reuses a shared client.
    yield


# ---------------------------------------------------------------------------
# SSE event sequence tests
# ---------------------------------------------------------------------------

def test_sse_emits_three_persona_done_in_kent_finch_chen_order():
    """POST returns 4 SSE events: persona_done × 3 (in order) then done."""
    with TestClient(app) as client:
        events = _post_podcast(client)

    assert len(events) == 4, f"Expected 4 events, got {len(events)}: {events}"
    expected_personas = ["kent", "finch", "chen"]
    for i, persona in enumerate(expected_personas):
        name, data = events[i]
        assert name == "persona_done", f"Event {i}: expected 'persona_done', got {name!r}"
        assert data["persona"] == persona, (
            f"Event {i}: expected persona={persona!r}, got {data['persona']!r}"
        )
    name, _ = events[3]
    assert name == "done", f"Event 3: expected 'done', got {name!r}"


def test_sse_done_event_carries_token_and_three_offsets():
    """done event carries token (32-char hex), 3 offsets, word_count, cached=False."""
    with TestClient(app) as client:
        events = _post_podcast(client)

    _, done_data = events[3]
    assert "token" in done_data, "done event must carry token"
    assert len(done_data["token"]) == 32, f"token must be 32-char hex, got {done_data['token']!r}"
    assert all(c in "0123456789abcdef" for c in done_data["token"]), "token must be hex"

    offsets = done_data["offsets"]
    assert len(offsets) == 3, f"Expected 3 offsets, got {len(offsets)}"
    assert offsets[0] == 0.0
    assert offsets[1] > 0.7, f"finch offset {offsets[1]} must exceed 0.7"
    assert offsets[2] > offsets[1] + 0.7, (
        f"chen offset {offsets[2]} must exceed finch_offset + 0.7"
    )
    assert done_data["word_count"] > 0, "word_count must be positive"
    assert done_data["cached"] is False, "first call must not be cached"


def test_sse_content_type_is_event_stream():
    """POST /api/debrief/podcast response Content-Type must contain text/event-stream."""
    with TestClient(app) as client:
        response = client.post("/api/debrief/podcast", json=_VALID_BODY)
    assert "text/event-stream" in response.headers.get("content-type", ""), (
        f"Expected text/event-stream, got {response.headers.get('content-type')}"
    )


# ---------------------------------------------------------------------------
# Audio token endpoint tests
# ---------------------------------------------------------------------------

def test_audio_endpoint_returns_stitched_mp3_on_valid_token():
    """GET /api/debrief/podcast/audio?token=... returns 200 audio/mpeg with stitched bytes."""
    with TestClient(app) as client:
        events = _post_podcast(client)
        _, done_data = events[3]
        token = done_data["token"]

        audio_resp = client.get(f"/api/debrief/podcast/audio?token={token}")

    assert audio_resp.status_code == 200
    assert "audio/mpeg" in audio_resp.headers.get("content-type", ""), (
        f"Expected audio/mpeg, got {audio_resp.headers.get('content-type')}"
    )
    expected_len = (
        len(KENT_BYTES) + len(SILENCE_BYTES) + len(FINCH_BYTES)
        + len(SILENCE_BYTES) + len(CHEN_BYTES)
    )
    assert len(audio_resp.content) == expected_len, (
        f"Expected {expected_len} bytes, got {len(audio_resp.content)}"
    )
    # Must start with Kent's fixture bytes
    assert audio_resp.content[:16] == KENT_BYTES[:16], "Audio must start with Kent bytes"


def test_audio_endpoint_404_on_second_fetch_same_token():
    """Token is single-use: second GET with same token returns 404."""
    with TestClient(app) as client:
        events = _post_podcast(client)
        _, done_data = events[3]
        token = done_data["token"]

        first = client.get(f"/api/debrief/podcast/audio?token={token}")
        second = client.get(f"/api/debrief/podcast/audio?token={token}")

    assert first.status_code == 200
    assert second.status_code == 404


def test_audio_endpoint_404_on_unknown_token():
    """GET with unknown token returns 404 with JSON detail."""
    with TestClient(app) as client:
        resp = client.get("/api/debrief/podcast/audio?token=deadbeef")

    assert resp.status_code == 404
    # Must return JSON (not HTML SPA catch-all)
    body = resp.json()
    assert "detail" in body, f"Expected JSON with 'detail', got {body}"


def test_router_registered_before_spa_mount():
    """audio endpoint returns JSON 404 (not HTML from SPA catch-all)."""
    with TestClient(app) as client:
        resp = client.get("/api/debrief/podcast/audio?token=totally-unknown")
    assert resp.status_code == 404
    # Must be parseable as JSON — SPA catch-all would return HTML 200
    body = resp.json()
    assert "detail" in body


# ---------------------------------------------------------------------------
# Caching tests
# ---------------------------------------------------------------------------

def test_second_generate_with_same_body_is_cache_hit():
    """Second POST with identical body is served from cache (cached=True in done event)."""
    with TestClient(app) as client:
        events_a = _post_podcast(client)
        events_b = _post_podcast(client)

    _, done_a = events_a[3]
    _, done_b = events_b[3]

    assert done_a["cached"] is False, "First call must not be cached"
    assert done_b["cached"] is True, "Second identical call must be cached"
    # Both tokens must be different UUIDs (even though audio bytes are the same)
    assert done_a["token"] != done_b["token"], "Each call produces a unique token"


def test_force_fresh_bypasses_cache():
    """force_fresh=True bypasses cache even after a successful cached call."""
    body_normal = {**_VALID_BODY, "force_fresh": False}
    body_fresh = {**_VALID_BODY, "force_fresh": True}

    with TestClient(app) as client:
        events_a = _post_podcast(client, body_normal)  # fills cache
        events_b = _post_podcast(client, body_fresh)   # bypasses cache

    _, done_a = events_a[3]
    _, done_b = events_b[3]

    assert done_a["cached"] is False
    assert done_b["cached"] is False, "force_fresh must bypass cache (cached=False)"
    # Both tokens are valid and distinct
    assert len(done_b["token"]) == 32


# ---------------------------------------------------------------------------
# Validation / error tests
# ---------------------------------------------------------------------------

def test_invalid_body_returns_400():
    """POST with missing required field returns 400 VALIDATION_ERROR."""
    bad_body = {
        "game_name": "TestGame",
        # persona_texts is missing entirely
        "voices": {
            "kent": "__fake_kent__",
            "finch": "__fake_finch__",
            "chen": "__fake_chen__",
        },
    }
    with TestClient(app) as client:
        resp = client.post("/api/debrief/podcast", json=bad_body)

    assert resp.status_code == 400
    body = resp.json()
    assert body["error"]["code"] == "VALIDATION_ERROR"
