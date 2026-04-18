---
phase: 14-podcast-endpoint-player
plan: "01"
subsystem: api
tags: [fastapi, sse, server-sent-events, mp3, lameenc, pydantic, tts, podcast, audio]

# Dependency graph
requires:
  - phase: 13-firewall-spike-mockable-backend-foundation
    provides: TTSProvider ABC, FakeTTSProvider, ElevenLabsTTSProvider, get_tts_provider(settings), text_preprocessor.preprocess()

provides:
  - POST /api/debrief/podcast (text/event-stream SSE): yields persona_done x3 + done event with token/offsets/word_count
  - GET /api/debrief/podcast/audio?token= (audio/mpeg): single-use token pull for stitched MP3
  - backend/app/services/audio_generator.py: stitch(), bytes_to_seconds(), compute_offsets(), make_cache_key(), PodcastCache, TokenStore, generate_podcast_sse()
  - backend/app/services/tts/fixtures/silence_700ms.mp3: committed 700ms CBR mp3_44100_128 silence pad (11,702 bytes, 0xFF 0xFB sync header)
  - In-process PodcastCache keyed on sha256(game_name + text + voices), with force_fresh bypass
  - In-process TokenStore with 60s TTL lazy sweep; single-use audio tokens

affects:
  - 14-02 (frontend data layer consumes SSE contract and audio token fetch)
  - 14-03 (E2E checkpoint verification against these endpoints)
  - 16 (live ElevenLabs provider swaps in via same get_tts_provider interface)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "FastAPI async generator SSE: endpoint is async def yielding ServerSentEvent with raw_data= (not data=) to prevent double-JSON-encoding"
    - "SSE framing via EventSourceResponse as response_class annotation + async generator yield — not EventSourceResponse(generator()) wrapper"
    - "Pure orchestration module pattern: audio_generator.py has zero FastAPI/HTTP imports; router owns SSE framing"
    - "run_in_threadpool() wraps sync provider.synthesise() to keep endpoint async-clean"
    - "Lifespan-mounted app.state caches: PodcastCache and TokenStore created once per process"

key-files:
  created:
    - backend/app/services/tts/fixtures/silence_700ms.mp3
    - backend/app/services/audio_generator.py
    - backend/app/routers/debrief.py
    - backend/tests/test_audio_generator.py
    - backend/tests/test_debrief_podcast.py
  modified:
    - backend/app/main.py
    - backend/tests/conftest.py

key-decisions:
  - "ServerSentEvent must use raw_data= not data= when passing pre-serialized JSON strings; data= causes double-JSON-encoding on the wire"
  - "SSE endpoint must be an async generator yielding ServerSentEvent, not return EventSourceResponse(generator()); FastAPI's is_sse_stream detection requires the endpoint to be a gen callable"
  - "anyio_backend fixture constrained to asyncio (trio not installed); added per-file fixture to prevent test collection failures"
  - "generate_podcast_sse() yields plain dicts, not ServerSentEvent; router owns framing — keeps the module HTTP-framework-agnostic and unit-testable"

patterns-established:
  - "SSE endpoint pattern: @router.post(..., response_class=EventSourceResponse) + async def ... -> AsyncIterator[ServerSentEvent]: + yield ServerSentEvent(event=..., raw_data=...)"
  - "Async test pattern: pytestmark = pytest.mark.anyio + @pytest.fixture params=['asyncio'] anyio_backend override for anyio tests"

# Metrics
duration: 6min
completed: 2026-04-18
---

# Phase 14 Plan 01: Podcast Backend Endpoint Summary

**SSE podcast endpoint (POST) + audio token pull (GET) with CBR MP3 stitching, 700ms silence pad, sha256 in-process cache, and single-use token store — all wired against FakeTTSProvider with 125 backend tests green**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-04-18T12:19:22Z
- **Completed:** 2026-04-18T12:25:04Z
- **Tasks:** 2
- **Files modified:** 7 (5 created, 2 modified)

## Accomplishments

- Generated and committed 700ms CBR mp3_44100_128 silence pad (11,702 bytes, MPEG sync `0xFF 0xFB`) via lameenc — same toolchain as Phase 13 fixture generation
- Built `audio_generator.py` with pure unit-testable helpers (`stitch`, `bytes_to_seconds`, `compute_offsets`, `make_cache_key`) and async orchestrator (`generate_podcast_sse`) that yields dicts for framework-agnostic testing
- Shipped `POST /api/debrief/podcast` (SSE: 3x `persona_done` + `done` event carrying token/offsets/word_count/cached) and `GET /api/debrief/podcast/audio` (audio/mpeg, single-use, 60s TTL)
- Wired `PodcastCache` + `TokenStore` into `app.state` via lifespan; registered `debrief.router` before SPA catch-all mount
- 125 total backend tests passing (93 pre-existing + 22 unit + 10 integration)

## Task Commits

Each task was committed atomically:

1. **Task 1: Silence pad asset + audio_generator orchestrator + cache + token store** - `46fa6d7` (feat)
2. **Task 2: Debrief router + main.py wiring + integration tests** - `3583020` (feat)

**Plan metadata:** (docs commit follows this summary)

## Files Created/Modified

- `backend/app/services/tts/fixtures/silence_700ms.mp3` - Committed binary: 700ms CBR silence pad, MPEG sync header 0xFF 0xFB
- `backend/app/services/audio_generator.py` - Exports stitch, bytes_to_seconds, compute_offsets, make_cache_key, PodcastCache, TokenStore, generate_podcast_sse, PERSONA_ORDER, SILENCE_BYTES, SILENCE_PAD_S
- `backend/app/routers/debrief.py` - Two endpoints: POST SSE sidecar + GET audio token pull
- `backend/app/main.py` - Added debrief router import, PodcastCache/TokenStore lifespan init, debrief.router registration
- `backend/tests/test_audio_generator.py` - 22 unit tests: silence pad, stitch, CBR math, offsets, cache, tokens, async SSE flows
- `backend/tests/test_debrief_podcast.py` - 10 integration tests: SSE event sequence, done payload, audio stitching, single-use token, cache hit, force_fresh, 400 validation, 404 unknown token
- `backend/tests/conftest.py` - Added `env_tts_fake` fixture (TTS_PROVIDER=fake, FAKE_TTS_DELAY_SECONDS=0.0)

## Decisions Made

**D1: ServerSentEvent raw_data= not data= for pre-serialized JSON**
When the SSE data is already a JSON string, `ServerSentEvent(data=json_str)` causes double-encoding (the string gets wrapped in another JSON string on the wire). Using `raw_data=json_str` passes the pre-serialized string through unchanged. Discovered by inspecting FastAPI's `_serialize_sse_item` source.

**D2: Async generator endpoint pattern (not EventSourceResponse wrapper)**
FastAPI's `is_sse_stream` detection requires the endpoint itself to be a generator callable AND the response class to be `EventSourceResponse`. Wrapping a generator in `EventSourceResponse(gen())` bypasses this and tries to call `.encode()` on `ServerSentEvent` objects (which are Pydantic models). The correct pattern: `@router.post(..., response_class=EventSourceResponse)` + `async def endpoint(...) -> AsyncIterator[ServerSentEvent]: yield ...`

**D3: anyio_backend fixture constrained to asyncio**
trio is not installed in this project. Without constraining `anyio_backend`, pytest-anyio generates [asyncio] and [trio] parametrizations; the trio variants fail with `ModuleNotFoundError`. Added a file-scoped `anyio_backend` fixture returning `"asyncio"` only.

**D4: generate_podcast_sse yields plain dicts**
The orchestrator module yields `{"event": str, "data": str}` dicts rather than `ServerSentEvent` objects to stay HTTP-framework-agnostic and unit-testable without importing FastAPI. The router owns the SSE framing layer. This preserves the Task 1 test pattern where events are collected and inspected as dicts.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] FastAPI SSE endpoint pattern required correction**
- **Found during:** Task 2 (writing debrief router)
- **Issue:** Initial implementation used `EventSourceResponse(sse_generator())` wrapper pattern, which fails because FastAPI's routing layer calls `.encode()` on `ServerSentEvent` Pydantic objects (they have no `.encode()` method). Also, `data=` on `ServerSentEvent` double-encodes pre-serialized JSON.
- **Fix:** Rewrote endpoint as `@router.post(..., response_class=EventSourceResponse)` async generator yielding `ServerSentEvent(raw_data=...)`. Two-iteration fix: first corrected the generator pattern, then corrected the data field.
- **Files modified:** backend/app/routers/debrief.py
- **Verification:** Response shows clean SSE wire format (`data: {"persona": "kent"}` not `data: "{\"persona\": \"kent\"}"`)
- **Committed in:** 3583020 (Task 2 commit)

**2. [Rule 3 - Blocking] anyio trio backend not installed**
- **Found during:** Task 1 test run
- **Issue:** `pytestmark = pytest.mark.anyio` without backend constraint causes anyio to parametrize over [asyncio, trio]; trio backend not installed → 7 test failures with `ModuleNotFoundError: No module named 'trio'`
- **Fix:** Added `@pytest.fixture(params=["asyncio"]) def anyio_backend(request): return request.param` to constrain to asyncio only
- **Files modified:** backend/tests/test_audio_generator.py
- **Verification:** 22 tests pass on [asyncio] variant only
- **Committed in:** 46fa6d7 (Task 1 commit, fix applied before commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes necessary for correctness. No scope creep. Plan contract preserved exactly.

## Issues Encountered

- FastAPI SSE API version mismatch required source inspection to understand the correct pattern (see Decision D1 and D2 above). Resolved by reading `fastapi.routing` source and verifying with a quick smoke test before writing integration tests.

## User Setup Required

None — no external service configuration required. All tests run against FakeTTSProvider with zero network calls.

## Next Phase Readiness

- Backend SSE contract is stable and tested: `POST /api/debrief/podcast` body shape and event sequence documented in plan frontmatter must_haves
- `GET /api/debrief/podcast/audio?token=` returns `audio/mpeg` single-use; plan 14-02 frontend data layer can consume both endpoints
- Cache + token store initialized in lifespan; concurrent requests from TestClient isolated per-test via `with TestClient(app) as client:` context (fresh lifespan per test)
- No blockers for plan 14-02 (runs in parallel, wave 1, non-overlapping files)

---
*Phase: 14-podcast-endpoint-player*
*Completed: 2026-04-18*
