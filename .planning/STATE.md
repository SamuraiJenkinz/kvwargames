# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-17 after v1.2 milestone kickoff)

**Core value:** Three AI personas respond in-character to facilitator input with accurate, live game state tracking
**Current focus:** v1.2 Debrief Podcast — Phase 16 next (Live ElevenLabs Verification + Milestone Audit)

## Current Position

Phase: 16 of 16 (Live ElevenLabs Verification + Milestone Audit) — In progress
Plan: 2 of 2 in current phase — 16-01 complete; 16-02 (v1.2 milestone audit) next
Status: Phase 16, Plan 16-01 complete (commits 3701198, b851553, af6d525, fd41e6c, 02298a3, 7cd1682); SC1/SC2/SC3 all PASS
Last activity: 2026-04-19 — Completed 16-01-PLAN.md — Tier-B live ElevenLabs replay complete; 16-LIVE-VERIFICATION.md authored; 16-01-SUMMARY.md written; all 6 evidence artifacts committed

Progress: [████████████████████] 58/59 plans complete — v1.0 (39) + v1.1 (7) + v1.2 plans 13-01/02/03 + 14-01/02/03 + 15-01/02/03 + 16-01 (10) shipped; v1.2 plans remaining: 16-02

## Performance Metrics

**Shipped Milestones:**

| Milestone | Phases | Plans | Status | Shipped |
|-----------|--------|-------|--------|---------|
| v1.0 MVP | 1–8 | 39/39 | ✅ Tagged | 2026-04-15 |
| v1.1 Pre-live-run hardening | 9–12 | 7/7 | ✅ Tagged | 2026-04-15 |
| v1.2 Debrief Podcast | 13–16 | 10/11 | 🚧 In progress (Phases 13 + 14 + 15 + 16-01 complete 2026-04-19) | — |

| 15. TTS Health + Graceful Degradation | v1.2 | 3/3 | Complete | 2026-04-19 |

**v1.0 Velocity:** 39 plans across 8 phases over ~2 days (2026-04-13 → 2026-04-15)
**v1.1 Velocity:** 7 plans across 4 phases in ~4 hours (same day as v1.0 ship)
**v1.2 Plan Estimate:** ~10 plans across 4 phases — mock-first (13 + 14 + 15) then live-verification (16)

## Accumulated Context

### Decisions

Full decision log in `.planning/PROJECT.md` Key Decisions table — 23 architectural decisions spanning v1.0 (15) and v1.1 (8), all marked Good after milestone audits.

v1.2 roadmap-level decisions worth carrying into Phase 13 planning:

- **Mock-first, live-last.** Phases 13–15 are 100% mockable against `FakeTTSProvider`; Phase 16 is the first phase that calls a real ElevenLabs key. Mirrors v1.1 Tier-B precedent.
- **PODDEP-01 firewall spike is the entry-gate task of Phase 13** (plan 13-01), not deferred to Phase 16. Confirms `api.elevenlabs.io` reachability before the ElevenLabs concrete provider lands in plan 13-02.
- **Blocking streaming `audio/mpeg`, not 202+poll.** Backend stays stateless; per-persona progress UI is optimistic client-side animation, not a real progress feed.
- **Raw-bytes MP3 concat, no `pydub` / `ffmpeg`.** All ElevenLabs segments share `mp3_44100_128` CBR; 500ms silence pad is a committed static asset.
- **Parallel `/api/health/tts`, not extended `/api/health/llm`.** LLM-down hard-fails Launch; TTS-down is a soft warning — one `body.ok` cannot carry both signals.
- **Graceful degradation is load-bearing.** Phase 15 proves the markdown debrief path survives ElevenLabs failure by empirical flip-the-key-to-garbage run.

v1.2 plan 14-01 decisions (podcast backend endpoint):

- **ServerSentEvent raw_data= not data=** — data= causes double-JSON-encoding on the wire; raw_data= passes pre-serialized JSON string through unchanged
- **Async generator endpoint pattern** — FastAPI's is_sse_stream detection requires the endpoint to be a gen callable; wrapping EventSourceResponse(gen()) bypasses this
- **generate_podcast_sse yields plain dicts, not ServerSentEvent** — keeps audio_generator.py HTTP-framework-agnostic and unit-testable
- **anyio_backend constrained to asyncio** — trio not installed; per-file fixture prevents anyio from generating failing [trio] parametrizations

v1.2 plan 14-02 decisions (frontend data layer):

- **fetch+ReadableStream over EventSource** — EventSource lacks POST body support; podcast endpoint requires body with persona texts, voices, game name (SC4 reconciliation)
- **Separate usePodcastStore (not gameStore slice)** — podcast lifecycle is distinct from game state; avoids polluting 700-line gameStore
- **Local time in buildMp3Filename** — `toISOString()` (UTC) gives AEST facilitators wrong timestamps; `getHours()/getMinutes()` respects locale
- **'session' fallback for MP3 kebab** — distinct from debriefExporter.ts ('game' fallback); semantically cleaner for MP3 context
- **Blob URL revoke-before-create invariant** — `revokeObjectURL(prev)` called at top of `startGeneration` and in `reset()`; prevents memory leaks across regenerate cycles

v1.2 plan 14-03 decisions (podcast player UI):

- **extractPersonaTexts anchored on last debrief_divider, not isDebrief flag** — `gameStore.buildPersonaMessage` never sets `isDebrief` on persona messages; only the divider message has that boundary. Filtering on `isDebrief` returns empty texts → backend 400. Fix: `findLastIndex(m => m.type === 'debrief_divider')` then collect persona messages after it.
- **No autoplay on `<audio>` element (PODPLAY-01)** — loaded paused via imperative `audioRef.current.src = blobUrl; load()`; regression-tested invariant
- **Blob URL not revoked on Download MP3 click** — revoking at download time breaks replay; store owns lifecycle (revokes on next startGeneration or reset())
- **MP3 duration display quirk (cosmetic)** — raw-bytes stitching without pydub/ffmpeg causes WMP to read duration from first frame header only; Chrome/VLC scan all frames and report correct duration. Full audio plays correctly. Expected outcome of no-pydub decision.
- **No `<dialog>` element for confirm dialogs** — jsdom lacks `showModal()` support; plain div overlay with role=dialog keeps components testable without API mocking

v1.2 plan 15-02 decisions (TTS health frontend badge):

- **Separate test file for mid-gen store-level tests** — `podcastMidGenFailure.test.ts` not appended to `podcastClient.test.ts`: `vi.mock` in vitest hoists to file top, which would replace real `generatePodcast` for all 11 transport-level tests → 8 failures. Separate file isolates mock scope. Pattern: one `vi.mock` scope per test file.
- **9 TtsHealthBadge tests** (plan specified "8+"): test_9 (auto-check URL has no force param) is the counter-assertion to test_6 (Re-check uses force=true). Both sides of URL-fork tested.
- **TtsHealthBadge onStatusChange wired to no-op in LoadConfigPanel** — critical PODRES-02 invariant: TTS badge must never gate Launch. `setHealthStatus` is owned exclusively by the LLM `HealthBadge`.

v1.2 plan 15-01 decisions (TTS health endpoint):

- **`_make_http_client()` factory for testability** — patching `httpx.AsyncClient` globally caused RecursionError (factory called the patched class) and broke `main.py` lifespan's `aclose()`. Narrow `_make_http_client()` factory is the correct patch target for per-request client tests.
- **Per-request `httpx.AsyncClient` for TTS health** — not `app.state.http_client` (LLM client). Confirmed appropriate given 30s cache keeps probe frequency low.
- **`?force=true` writes back to cache after bypass** — bypasses cache READ only, always writes result on completion (prevents stale cache after manual refresh).

v1.2 plan 16-01 decisions (live ElevenLabs replay):

- **`/api/config/tts-voices` as dedicated endpoint** — voice-ID dispatch shape is distinct from generic config; dedicated endpoint keeps fake-vs-elevenlabs dispatch isolated
- **No Tier-A preprocessor fixes needed** — EDIP letter-by-letter confirmed on first pass across all 3 segments; Phase 13 ACRONYMS dict entry was sufficient
- **~3 s CBR/display duration variance is cosmetic** — ID3/Lavf header bytes in numerator inflate CBR estimate; VLC/Chrome report correct playback duration; no audio missing; expected consequence of no-pydub stitching
- **SSE parser Rule-3 auto-fix (af6d525)** — initial parser discarded `event:` name lines; consumer dispatch matched nothing; fix: capture event name line and attach as `event` key on yielded dict
- **No Tier-B deferrals** — all 3 stock voices (Sarah/George/Eric mapped Kent/Finch/Chen) produced distinct intelligible audio on first pass

v1.2 plan 15-03 observations (empirical verification):

- **Two-endpoint code divergence: `/v1/user` → `auth_error`, `/v1/text-to-speech` → `upstream_error`** — the setup-screen health probe hits ElevenLabs `/v1/user` (returned 401/403 → `auth_error`) while TTS generation hits `/v1/text-to-speech/{voice_id}` with dummy voice IDs (ElevenLabs returned HTTP 500 → `upstream_error`). Both codes are valid members of the 8-code taxonomy. Phase 16 Tier-B replay will use real voice IDs so both endpoints succeed. The code-dispatch table handling multiple codes simultaneously is now empirically confirmed.
- **Zustand stores are not on `window`** — `usePodcastStore.getState().error` in DevTools console returns `ReferenceError`. Stores are module-local ES exports. Future v1.3 polish option: expose stores at `window.__STORES__` in dev mode. For Phase 15 verification visual proof from the rendered banner was sufficient (stronger — validates the full SSE → store → component → DOM flow). Phase 16 verifier should use React DevTools component tree if store inspection is needed.

v1.1 decisions still relevant:

- Health endpoint always returns HTTP 200 (body.ok carries signal) — reused verbatim for `/api/health/tts` in Phase 15
- Tier B pattern (encode → lock → replay → commit raw response) — reused for Phase 16 live ElevenLabs verification

### Pending Todos

None. v1.1 technical-debt items are tracked in PROJECT.md and v1.1-MILESTONE-AUDIT.md and do not block v1.2 work.

### Blockers/Concerns

- **PODDEP-01 (corporate firewall)** — CLEARED 2026-04-17, verification-approved 2026-04-18. Operational precedent (existing production app on MC211APT2AS5AHG calls api.elevenlabs.io today) + HTTP 200 `/v1/voices` preflight. Plans 13-02 and 13-03 unblocked. Formal TTS streaming-payload verification deferred to Phase 16 Tier-B replay. Key Decision logged in PROJECT.md line 138.

## Session Continuity

Last session: 2026-04-19 — Phase 16 plan 16-01 complete; all 3 success criteria PASS; 16-LIVE-VERIFICATION.md + 16-01-SUMMARY.md committed
Stopped at: Completed 16-01-PLAN.md; 16-02 (v1.2 milestone audit) is next
Resume file: None
