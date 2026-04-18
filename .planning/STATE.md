# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-17 after v1.2 milestone kickoff)

**Core value:** Three AI personas respond in-character to facilitator input with accurate, live game state tracking
**Current focus:** v1.2 Debrief Podcast — Phase 14 in progress (wave 1: 14-01 + 14-02 shipped)

## Current Position

Phase: 14 of 16 (Podcast Endpoint + Player — End-to-End on Fake) — Complete
Plan: 3 of 3 in current phase — 14-01 (backend), 14-02 (frontend data layer), 14-03 (player UI) all shipped and human-checkpoint approved
Status: Phase 14 complete — all three plans landed on 2026-04-18; human checkpoint SC1..SC6 confirmed; 608 frontend tests passing
Last activity: 2026-04-18 — Completed 14-03-PLAN.md (podcast player UI: 7 components + ActionToolbar/FacilitatorInput edits + orchestrator fix for extractPersonaTexts + SC1..SC6 human-verify approved)

Progress: [████████████████░] 54/57 plans complete — v1.0 (39) + v1.1 (7) + v1.2 plans 13-01/02/03 + 14-01/02/03 (6) shipped; v1.2 plans remaining: 15-01/02, 16-01/02

## Performance Metrics

**Shipped Milestones:**

| Milestone | Phases | Plans | Status | Shipped |
|-----------|--------|-------|--------|---------|
| v1.0 MVP | 1–8 | 39/39 | ✅ Tagged | 2026-04-15 |
| v1.1 Pre-live-run hardening | 9–12 | 7/7 | ✅ Tagged | 2026-04-15 |
| v1.2 Debrief Podcast | 13–16 | 6/~10 | 🚧 In progress (Phases 13 + 14 complete 2026-04-18) | — |

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

v1.1 decisions still relevant:

- Health endpoint always returns HTTP 200 (body.ok carries signal) — reused verbatim for `/api/health/tts` in Phase 15
- Tier B pattern (encode → lock → replay → commit raw response) — reused for Phase 16 live ElevenLabs verification

### Pending Todos

None. v1.1 technical-debt items are tracked in PROJECT.md and v1.1-MILESTONE-AUDIT.md and do not block v1.2 work.

### Blockers/Concerns

- **PODDEP-01 (corporate firewall)** — CLEARED 2026-04-17, verification-approved 2026-04-18. Operational precedent (existing production app on MC211APT2AS5AHG calls api.elevenlabs.io today) + HTTP 200 `/v1/voices` preflight. Plans 13-02 and 13-03 unblocked. Formal TTS streaming-payload verification deferred to Phase 16 Tier-B replay. Key Decision logged in PROJECT.md line 138.

## Session Continuity

Last session: 2026-04-18 — Completed 14-03-PLAN.md (podcast player UI); all three 14-XX plans shipped; human checkpoint SC1..SC6 approved; 608 frontend tests passing
Stopped at: Phase 14 complete — 14-01 (backend SSE), 14-02 (frontend data layer), 14-03 (player UI) all shipped. Next: Phase 15 (graceful degradation: health endpoint + empirical TTS failure verification)
Resume file: None — ready for 15-01.
