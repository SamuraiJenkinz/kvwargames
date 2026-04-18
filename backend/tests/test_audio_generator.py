"""Tests for audio_generator.py (Phase 14, plan 14-01).

Covers:
  - Silence pad asset validity (CBR MP3 header + size)
  - stitch() raw concat, no leading/trailing pad
  - bytes_to_seconds() CBR math
  - compute_offsets() strictly-increasing float list
  - make_cache_key() determinism and sort-order invariance
  - PodcastCache roundtrip + invalidation
  - TokenStore single-use and TTL sweep
  - generate_podcast_sse() full flow (cache miss, cache hit, force-fresh,
    disconnect abort, provider error, zero network calls)
"""

from __future__ import annotations

import json
import time
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.audio_generator import (
    PERSONA_ORDER,
    SILENCE_BYTES,
    SILENCE_PAD_S,
    PodcastCache,
    TokenStore,
    bytes_to_seconds,
    compute_offsets,
    generate_podcast_sse,
    make_cache_key,
    stitch,
)
from app.services.tts.errors import TTSProviderError
from app.services.tts.fake_provider import CHEN_BYTES, FINCH_BYTES, KENT_BYTES

pytestmark = pytest.mark.anyio

# Constrain anyio to asyncio only (trio is not installed in this project)
@pytest.fixture(params=["asyncio"])
def anyio_backend(request):
    return request.param


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_fake_provider():
    """Return a FakeTTSProvider with sentinel voice IDs and zero delay."""
    from app.services.tts.fake_provider import FakeTTSProvider

    return FakeTTSProvider(
        voice_map={
            "__fake_kent__": KENT_BYTES,
            "__fake_finch__": FINCH_BYTES,
            "__fake_chen__": CHEN_BYTES,
        },
        delay_seconds=0.0,
    )


def _make_request(disconnected: bool = False):
    """Return a minimal request mock with is_disconnected() returning the given value."""
    req = MagicMock()
    req.is_disconnected = AsyncMock(return_value=disconnected)
    return req


def _make_body(force_fresh: bool = False) -> dict:
    return {
        "game_name": "TestGame",
        "persona_texts": {
            "kent": "Kent speaks about strategy.",
            "finch": "Finch discusses the data.",
            "chen": "Chen gives the final analysis.",
        },
        "voices": {
            "kent": "__fake_kent__",
            "finch": "__fake_finch__",
            "chen": "__fake_chen__",
        },
        "force_fresh": force_fresh,
    }


async def _collect_events(gen) -> list[dict]:
    """Drain an async generator into a list of event dicts."""
    events = []
    async for evt in gen:
        events.append(evt)
    return events


# ---------------------------------------------------------------------------
# Task 1a: Silence pad asset
# ---------------------------------------------------------------------------

def test_silence_pad_exists_and_is_cbr_mp3():
    """SILENCE_BYTES is loaded, sized 9-14 KB, and starts with MPEG sync header."""
    assert 9_000 <= len(SILENCE_BYTES) <= 14_000, (
        f"Expected 9-14 KB silence pad, got {len(SILENCE_BYTES)} bytes"
    )
    assert SILENCE_BYTES[:2] == b"\xff\xfb", (
        f"Expected MPEG sync 0xff 0xfb, got {SILENCE_BYTES[:2].hex()}"
    )


# ---------------------------------------------------------------------------
# Task 1b: stitch()
# ---------------------------------------------------------------------------

def test_stitch_is_raw_concat_no_leading_or_trailing_pad():
    """stitch(k, f, c) == k + SILENCE + f + SILENCE + c; no leading or trailing pad."""
    k, f, c = b"KENT_DATA", b"FINCH_DATA", b"CHEN_DATA"
    result = stitch(k, f, c)
    assert result == k + SILENCE_BYTES + f + SILENCE_BYTES + c
    # No leading pad
    assert not result.startswith(SILENCE_BYTES), "stitch() must NOT start with silence"
    # No trailing pad
    assert not result.endswith(SILENCE_BYTES), "stitch() must NOT end with silence"


def test_stitch_with_real_fixture_bytes():
    """stitch() with real fixture bytes has correct total length."""
    result = stitch(KENT_BYTES, FINCH_BYTES, CHEN_BYTES)
    expected_len = len(KENT_BYTES) + len(SILENCE_BYTES) + len(FINCH_BYTES) + len(SILENCE_BYTES) + len(CHEN_BYTES)
    assert len(result) == expected_len


# ---------------------------------------------------------------------------
# bytes_to_seconds()
# ---------------------------------------------------------------------------

def test_bytes_to_seconds_cbr_math_one_second():
    """128000 bps / 8 = 16000 bytes per second."""
    assert bytes_to_seconds(128_000 // 8) == pytest.approx(1.0)


def test_bytes_to_seconds_cbr_math_arbitrary():
    """80666 bytes at 128kbps = 5.0416... seconds."""
    assert bytes_to_seconds(80_666) == pytest.approx(5.042, abs=0.001)


# ---------------------------------------------------------------------------
# compute_offsets()
# ---------------------------------------------------------------------------

def test_compute_offsets_is_strictly_increasing():
    """compute_offsets returns [0.0, finch_start, chen_start] all strictly increasing."""
    offsets = compute_offsets(KENT_BYTES, FINCH_BYTES, CHEN_BYTES)
    assert len(offsets) == 3
    assert offsets[0] == 0.0
    # finch starts after kent + 0.7s silence (must exceed 0.7s minimum)
    assert offsets[1] > SILENCE_PAD_S, f"finch start {offsets[1]} must exceed {SILENCE_PAD_S}"
    # chen starts at least another SILENCE_PAD_S after finch
    assert offsets[2] > offsets[1] + SILENCE_PAD_S, (
        f"chen start {offsets[2]} must exceed finch_start + {SILENCE_PAD_S}"
    )


def test_compute_offsets_formula_exact():
    """Verify offsets using the CBR formula directly."""
    kent_s = bytes_to_seconds(len(KENT_BYTES))
    finch_s = bytes_to_seconds(len(FINCH_BYTES))
    offsets = compute_offsets(KENT_BYTES, FINCH_BYTES, CHEN_BYTES)
    expected_finch_start = kent_s + SILENCE_PAD_S
    expected_chen_start = expected_finch_start + finch_s + SILENCE_PAD_S
    assert offsets[1] == pytest.approx(expected_finch_start)
    assert offsets[2] == pytest.approx(expected_chen_start)


# ---------------------------------------------------------------------------
# make_cache_key()
# ---------------------------------------------------------------------------

def test_make_cache_key_is_deterministic_and_order_independent():
    """Same content in different dict-insertion order produces same key."""
    key_a = make_cache_key("G", "T", {"kent": "a", "finch": "b", "chen": "c"})
    key_b = make_cache_key("G", "T", {"chen": "c", "kent": "a", "finch": "b"})
    assert key_a == key_b, "make_cache_key must be order-independent (sort_keys=True)"


def test_make_cache_key_different_text_different_hash():
    """Different text produces different hash."""
    key_a = make_cache_key("G", "text one", {"kent": "v", "finch": "v", "chen": "v"})
    key_b = make_cache_key("G", "text two", {"kent": "v", "finch": "v", "chen": "v"})
    assert key_a != key_b


def test_make_cache_key_is_hex_string():
    """make_cache_key returns a 64-char hex string (sha256)."""
    key = make_cache_key("game", "text", {"kent": "a", "finch": "b", "chen": "c"})
    assert len(key) == 64
    assert all(c in "0123456789abcdef" for c in key)


# ---------------------------------------------------------------------------
# PodcastCache
# ---------------------------------------------------------------------------

def test_podcast_cache_roundtrip():
    """PodcastCache: set → get returns the same values; get on missing key returns None."""
    cache = PodcastCache()
    assert cache.get("missing") is None
    offsets = [0.0, 5.0, 10.0]
    cache.set("key1", b"audio", offsets, 42)
    result = cache.get("key1")
    assert result == (b"audio", offsets, 42)


def test_podcast_cache_invalidate():
    """PodcastCache.invalidate removes the entry; second invalidate is a no-op."""
    cache = PodcastCache()
    cache.set("key1", b"audio", [0.0, 1.0, 2.0], 10)
    cache.invalidate("key1")
    assert cache.get("key1") is None
    # Second invalidate must not raise
    cache.invalidate("key1")


# ---------------------------------------------------------------------------
# TokenStore
# ---------------------------------------------------------------------------

def test_token_store_single_use():
    """TokenStore: put returns a unique hex token; pop returns bytes first time, None second."""
    store = TokenStore()
    token = store.put(b"audio_bytes")
    assert isinstance(token, str) and len(token) == 32  # uuid4().hex
    result = store.pop(token)
    assert result == b"audio_bytes"
    assert store.pop(token) is None, "Second pop must return None (single-use)"


def test_token_store_different_puts_have_unique_tokens():
    """Each put() produces a unique token."""
    store = TokenStore()
    t1 = store.put(b"a")
    t2 = store.put(b"b")
    assert t1 != t2


def test_token_store_ttl_sweep():
    """Entries older than TTL are swept on the next operation."""
    store = TokenStore(ttl_s=60.0)
    # Inject two entries with an artificially old timestamp (61s ago)
    now = time.monotonic()
    store._store["old_token_1"] = (b"old1", now - 61)
    store._store["old_token_2"] = (b"old2", now - 61)
    # Insert a fresh entry — this triggers sweep
    fresh_token = store.put(b"fresh")
    # Old entries must be gone
    assert store.pop("old_token_1") is None, "old_token_1 should have been swept"
    assert store.pop("old_token_2") is None, "old_token_2 should have been swept"
    # Fresh entry must still be present (pop will remove it)
    assert store.pop(fresh_token) == b"fresh"


# ---------------------------------------------------------------------------
# generate_podcast_sse() — async tests
# ---------------------------------------------------------------------------

async def test_generate_podcast_sse_emits_three_persona_done_then_done():
    """Full SSE flow: 3 persona_done events in kent→finch→chen order, then done."""
    cache = PodcastCache()
    tokens = TokenStore()
    provider = _make_fake_provider()
    request = _make_request(disconnected=False)
    body = _make_body()

    events = await _collect_events(
        generate_podcast_sse(request, body, provider, cache, tokens)
    )

    assert len(events) == 4, f"Expected 4 events, got {len(events)}: {events}"

    # persona_done events in order
    for i, persona in enumerate(("kent", "finch", "chen")):
        assert events[i]["event"] == "persona_done"
        data = json.loads(events[i]["data"])
        assert data["persona"] == persona, f"Event {i}: expected {persona}, got {data['persona']}"

    # done event
    assert events[3]["event"] == "done"
    done_data = json.loads(events[3]["data"])
    assert "token" in done_data
    assert len(done_data["token"]) == 32  # uuid4().hex
    assert len(done_data["offsets"]) == 3
    assert done_data["offsets"][0] == 0.0
    assert done_data["offsets"][1] > 0.7
    assert done_data["offsets"][2] > done_data["offsets"][1] + 0.7
    assert done_data["word_count"] > 0
    assert done_data["cached"] is False


async def test_generate_podcast_sse_done_event_token_is_retrievable():
    """Token from done event allows retrieving stitched audio from TokenStore."""
    cache = PodcastCache()
    tokens = TokenStore()
    provider = _make_fake_provider()
    request = _make_request()
    body = _make_body()

    events = await _collect_events(
        generate_podcast_sse(request, body, provider, cache, tokens)
    )
    done_data = json.loads(events[3]["data"])
    token = done_data["token"]

    audio = tokens.pop(token)
    assert audio is not None
    expected_len = len(KENT_BYTES) + len(SILENCE_BYTES) + len(FINCH_BYTES) + len(SILENCE_BYTES) + len(CHEN_BYTES)
    assert len(audio) == expected_len


async def test_generate_podcast_sse_cache_hit_skips_provider_calls():
    """Cache hit path emits 4 events without calling provider.synthesise."""
    cache = PodcastCache()
    tokens = TokenStore()
    request = _make_request()
    body = _make_body()

    # Pre-populate cache
    joined = "\n".join(body["persona_texts"][p] for p in PERSONA_ORDER)
    key = make_cache_key(body["game_name"], joined, body["voices"])
    stitched = stitch(KENT_BYTES, FINCH_BYTES, CHEN_BYTES)
    offsets = compute_offsets(KENT_BYTES, FINCH_BYTES, CHEN_BYTES)
    cache.set(key, stitched, offsets, 42)

    # Provider that must NOT be called
    provider = MagicMock()
    provider.synthesise = MagicMock(side_effect=AssertionError("synthesise must not be called on cache hit"))

    events = await _collect_events(
        generate_podcast_sse(request, body, provider, cache, tokens)
    )

    assert len(events) == 4
    for i, persona in enumerate(("kent", "finch", "chen")):
        assert events[i]["event"] == "persona_done"
    done_data = json.loads(events[3]["data"])
    assert done_data["cached"] is True


async def test_generate_podcast_sse_force_fresh_calls_provider():
    """force_fresh=True bypasses the cache and calls provider.synthesise 3 times."""
    cache = PodcastCache()
    tokens = TokenStore()
    provider = _make_fake_provider()
    request = _make_request()

    # Pre-populate cache with stale bytes
    body = _make_body(force_fresh=False)
    joined = "\n".join(body["persona_texts"][p] for p in PERSONA_ORDER)
    key = make_cache_key(body["game_name"], joined, body["voices"])
    cache.set(key, b"stale_audio", [0.0, 1.0, 2.0], 5)

    # Force-fresh request
    body_ff = _make_body(force_fresh=True)

    from unittest.mock import patch
    call_count = []
    original_synthesise = provider.synthesise

    def counting_synthesise(text, voice_id):
        call_count.append(voice_id)
        return original_synthesise(text, voice_id)

    provider.synthesise = counting_synthesise

    events = await _collect_events(
        generate_podcast_sse(request, body_ff, provider, cache, tokens)
    )

    assert len(call_count) == 3, f"Expected 3 provider calls, got {len(call_count)}"
    done_data = json.loads(events[3]["data"])
    assert done_data["cached"] is False
    # Cache should now hold fresh audio (different from stale)
    cached = cache.get(key)
    assert cached is not None
    assert cached[0] != b"stale_audio"


async def test_generate_podcast_sse_disconnect_aborts_early():
    """Client disconnect between iterations aborts the generator early."""
    cache = PodcastCache()
    tokens = TokenStore()
    provider = _make_fake_provider()

    # is_disconnected() returns False on first check, True on second
    # First call: before kent (returns False → kent proceeds)
    # Second call: before finch (returns True → abort)
    call_count = [0]

    async def disconnected_after_kent():
        call_count[0] += 1
        return call_count[0] > 1  # True starting from 2nd call

    request = MagicMock()
    request.is_disconnected = disconnected_after_kent

    body = _make_body()
    events = await _collect_events(
        generate_podcast_sse(request, body, provider, cache, tokens)
    )

    # Must have fewer than 3 persona_done events and no done event
    persona_done_count = sum(1 for e in events if e["event"] == "persona_done")
    done_count = sum(1 for e in events if e["event"] == "done")
    assert persona_done_count < 3, "Should have fewer than 3 persona_done events after disconnect"
    assert done_count == 0, "No done event should be emitted after disconnect"


async def test_generate_podcast_sse_provider_error_yields_error_event():
    """TTSProviderError from provider yields exactly one error event, no done event."""
    cache = PodcastCache()
    tokens = TokenStore()
    request = _make_request()

    failing_provider = MagicMock()
    failing_provider.synthesise = MagicMock(
        side_effect=TTSProviderError(code="upstream_error", message="boom")
    )

    body = _make_body()
    events = await _collect_events(
        generate_podcast_sse(request, body, failing_provider, cache, tokens)
    )

    error_events = [e for e in events if e["event"] == "error"]
    done_events = [e for e in events if e["event"] == "done"]

    assert len(error_events) == 1, f"Expected exactly 1 error event, got {len(error_events)}"
    assert len(done_events) == 0, "No done event should follow an error"

    error_data = json.loads(error_events[0]["data"])
    assert error_data["code"] == "upstream_error"
    assert "boom" in error_data["message"]


async def test_fake_provider_still_makes_zero_network_calls():
    """FakeTTSProvider makes zero outbound HTTP calls even when called via generate_podcast_sse."""
    from unittest import mock

    cache = PodcastCache()
    tokens = TokenStore()
    provider = _make_fake_provider()
    request = _make_request()
    body = _make_body()

    def _no_network(*args, **kwargs):
        raise AssertionError(
            "FakeTTSProvider attempted an outbound HTTP call via generate_podcast_sse"
        )

    with mock.patch("httpx._client.HTTPTransport.handle_request", side_effect=_no_network):
        events = await _collect_events(
            generate_podcast_sse(request, body, provider, cache, tokens)
        )

    # Must still have completed successfully
    assert any(e["event"] == "done" for e in events), "SSE should complete with done event"
