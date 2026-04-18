"""Audio generator orchestrator for Phase 14.

Responsibilities (pure, no HTTP):
  - stitch(kent, finch, chen) -> bytes : kent + SILENCE + finch + SILENCE + chen
  - bytes_to_seconds(n) -> float        : CBR formula, exact for mp3_44100_128
  - compute_offsets(kent, finch, chen) -> list[float] : [0.0, finch_start, chen_start]
  - make_cache_key(game_name, text, voices) -> str : sha256 hex of sorted JSON payload
  - PodcastCache (dict-wrapper on app.state) : keyed by cache_key -> (bytes, offsets, word_count)
  - TokenStore (dict-wrapper on app.state) : short-lived token -> (bytes, inserted_at); 60s TTL lazy sweep

Also exports the SSE orchestration coroutine generate_podcast_sse(request, body, provider, cache, tokens)
which yields dict events ({"event": str, "data": str}) rather than ServerSentEvent objects, so the
router layer owns the SSE framing. This keeps this module HTTP-framework-agnostic and unit-testable.
"""

import asyncio
import hashlib
import json
import time
import uuid
from pathlib import Path
from typing import AsyncIterator, Literal

from starlette.concurrency import run_in_threadpool

from app.services.text_preprocessor import preprocess
from app.services.tts.base import TTSProvider
from app.services.tts.errors import TTSProviderError

CBR_BITRATE = 128_000  # bits per second — locked by ELEVENLABS_OUTPUT_FORMAT=mp3_44100_128
SILENCE_PAD_S = 0.7
TOKEN_TTL_S = 60.0

_FIXTURES = Path(__file__).parent / "tts" / "fixtures"
SILENCE_BYTES = (_FIXTURES / "silence_700ms.mp3").read_bytes()


def stitch(kent: bytes, finch: bytes, chen: bytes) -> bytes:
    """Concatenate three MP3 byte streams with a single silence pad between each.

    No pad before Kent's opening, no pad after Chen's closing (PODGEN-04).
    Raw-bytes concat works because all segments share mp3_44100_128 CBR (locked
    project invariant); frames are self-contained and never span concat boundaries.
    """
    return kent + SILENCE_BYTES + finch + SILENCE_BYTES + chen


def bytes_to_seconds(n_bytes: int) -> float:
    """Exact duration for mp3_44100_128 CBR. Formula: (bytes * 8) / 128000."""
    return (n_bytes * 8) / CBR_BITRATE


def compute_offsets(kent: bytes, finch: bytes, chen: bytes) -> list[float]:
    """Return [0.0, finch_start_s, chen_start_s] for seek-to-persona UX.

    finch starts at kent_duration + 0.7s silence.
    chen starts at finch_start + finch_duration + 0.7s silence.
    """
    kent_s = bytes_to_seconds(len(kent))
    finch_s = bytes_to_seconds(len(finch))
    finch_start = kent_s + SILENCE_PAD_S
    chen_start = finch_start + finch_s + SILENCE_PAD_S
    return [0.0, finch_start, chen_start]


def make_cache_key(game_name: str, debrief_text: str, voices: dict[str, str]) -> str:
    """sha256 hex of sort_keys JSON payload — deterministic and invalidation-friendly."""
    payload = json.dumps(
        {"game_name": game_name, "text": debrief_text, "voices": voices},
        sort_keys=True,
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


class PodcastCache:
    """In-process cache: cache_key -> (audio_bytes, offsets, word_count).

    Plain dict wrapper so tests can inject a fresh instance. No eviction for
    Phase 14 scope (single session, small MP3 ~500 KB per entry).
    """

    def __init__(self) -> None:
        self._store: dict[str, tuple[bytes, list[float], int]] = {}

    def get(self, key: str):
        return self._store.get(key)

    def set(self, key: str, audio: bytes, offsets: list[float], word_count: int) -> None:
        self._store[key] = (audio, offsets, word_count)

    def invalidate(self, key: str) -> None:
        self._store.pop(key, None)


class TokenStore:
    """Short-lived audio token slot: token -> (audio_bytes, inserted_at).

    Lazy TTL sweep on every pop(); entries older than 60s are evicted.
    Entries are single-use (pop removes them).
    """

    def __init__(self, ttl_s: float = TOKEN_TTL_S) -> None:
        self._store: dict[str, tuple[bytes, float]] = {}
        self._ttl = ttl_s

    def put(self, audio: bytes) -> str:
        self._sweep()
        token = uuid.uuid4().hex
        self._store[token] = (audio, time.monotonic())
        return token

    def pop(self, token: str) -> bytes | None:
        self._sweep()
        entry = self._store.pop(token, None)
        return entry[0] if entry else None

    def _sweep(self) -> None:
        now = time.monotonic()
        expired = [t for t, (_b, ts) in self._store.items() if now - ts > self._ttl]
        for t in expired:
            self._store.pop(t, None)


PERSONA_ORDER: tuple[Literal["kent", "finch", "chen"], ...] = ("kent", "finch", "chen")


async def generate_podcast_sse(
    request,  # starlette.requests.Request — only needed for is_disconnected()
    body: dict,  # validated by pydantic at the router; passed in as dict here for framework-agnostic code
    provider: TTSProvider,
    cache: PodcastCache,
    tokens: TokenStore,
) -> AsyncIterator[dict]:
    """Yield SSE events as dicts: {"event": name, "data": json_string}.

    Reads body["persona_texts"] (dict[persona->text]), body["voices"] (dict[persona->voice_id]),
    body["game_name"], body["force_fresh"] (bool).

    Event sequence:
      - "persona_done" x 3 (Kent, Finch, Chen) as each completes
      - OR "error" with structured TTSProviderError payload if provider raises
      - "done" with {token, offsets: [f,f,f], word_count: int} on success

    Cache hit path: emits all three persona_done events instantly (no provider calls),
    then done. This preserves the UX contract (three events) even on fast-path.
    """
    game_name = body["game_name"]
    texts = body["persona_texts"]  # {"kent": str, "finch": str, "chen": str}
    voices = body["voices"]  # {"kent": voice_id, "finch": ..., "chen": ...}
    force_fresh = bool(body.get("force_fresh", False))

    # Concatenate all three texts for cache key and word count
    joined = "\n".join(texts[p] for p in PERSONA_ORDER)
    word_count = len(joined.split())
    key = make_cache_key(game_name, joined, voices)

    # Cache hit fast path
    if not force_fresh:
        hit = cache.get(key)
        if hit is not None:
            audio, offsets, cached_word_count = hit
            for persona in PERSONA_ORDER:
                if await request.is_disconnected():
                    return
                yield {"event": "persona_done", "data": json.dumps({"persona": persona})}
            token = tokens.put(audio)
            yield {
                "event": "done",
                "data": json.dumps({
                    "token": token,
                    "offsets": offsets,
                    "word_count": cached_word_count,
                    "cached": True,
                }),
            }
            return

    # Invalidate on force_fresh to avoid stale hits from concurrent sessions
    if force_fresh:
        cache.invalidate(key)

    produced: dict[str, bytes] = {}

    for persona in PERSONA_ORDER:
        if await request.is_disconnected():
            return  # client aborted — bail before any more synthesis
        try:
            processed = preprocess(texts[persona])
            audio_bytes = await run_in_threadpool(
                provider.synthesise, processed, voices[persona]
            )
        except TTSProviderError as exc:
            yield {
                "event": "error",
                "data": json.dumps({"code": exc.code, "message": str(exc), "persona": persona}),
            }
            return
        produced[persona] = audio_bytes
        yield {"event": "persona_done", "data": json.dumps({"persona": persona})}

    stitched = stitch(produced["kent"], produced["finch"], produced["chen"])
    offsets = compute_offsets(produced["kent"], produced["finch"], produced["chen"])
    cache.set(key, stitched, offsets, word_count)
    token = tokens.put(stitched)

    yield {
        "event": "done",
        "data": json.dumps({
            "token": token,
            "offsets": offsets,
            "word_count": word_count,
            "cached": False,
        }),
    }
