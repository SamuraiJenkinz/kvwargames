# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-17 after v1.2 milestone kickoff)

**Core value:** Three AI personas respond in-character to facilitator input with accurate, live game state tracking
**Current focus:** v1.2 Debrief Podcast — Phase 13 ready to plan

## Current Position

Phase: 13 of 16 (Firewall Spike + Mockable Backend Foundation)
Plan: 1 of 3 in current phase
Status: In progress
Last activity: 2026-04-17 — Completed 13-01-PLAN.md (PODDEP-01 firewall spike — cleared via operational precedent + preflight; formal TTS probe superseded)

Progress: [████████████░░░░] 47/57 plans complete — v1.0 (39) + v1.1 (7) + v1.2 plan 13-01 (1) shipped; v1.2 plans remaining: 13-02, 13-03, 14-01/02/03, 15-01/02, 16-01/02

## Performance Metrics

**Shipped Milestones:**

| Milestone | Phases | Plans | Status | Shipped |
|-----------|--------|-------|--------|---------|
| v1.0 MVP | 1–8 | 39/39 | ✅ Tagged | 2026-04-15 |
| v1.1 Pre-live-run hardening | 9–12 | 7/7 | ✅ Tagged | 2026-04-15 |
| v1.2 Debrief Podcast | 13–16 | 0/~10 | 🚧 In progress | — |

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

v1.1 decisions still relevant:

- Health endpoint always returns HTTP 200 (body.ok carries signal) — reused verbatim for `/api/health/tts` in Phase 15
- Tier B pattern (encode → lock → replay → commit raw response) — reused for Phase 16 live ElevenLabs verification

### Pending Todos

None. v1.1 technical-debt items are tracked in PROJECT.md and v1.1-MILESTONE-AUDIT.md and do not block v1.2 work.

### Blockers/Concerns

- **PODDEP-01 (corporate firewall)** — CLEARED 2026-04-17. Operational precedent (existing production app on MC211APT2AS5AHG calls api.elevenlabs.io today) + HTTP 200 preflight. Plans 13-02 and 13-03 unblocked. Formal TTS streaming-payload verification deferred to Phase 16 Tier-B replay.

## Session Continuity

Last session: 2026-04-17
Stopped at: Completed 13-01-PLAN.md — PODDEP-01 cleared, spike script committed, evidence file written, PROJECT.md + REQUIREMENTS.md updated. Next step: execute 13-02-PLAN.md (TTSProvider ABC + FakeTTSProvider + ElevenLabsTTSProvider + TTS_PROVIDER env switch).
Resume file: None — ready for plan 13-02.
