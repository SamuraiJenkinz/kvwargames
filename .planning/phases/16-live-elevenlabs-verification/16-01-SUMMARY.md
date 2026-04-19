---
phase: 16-live-elevenlabs-verification
plan: 01
shipped_date: 2026-04-19
status: complete
subsystem: evidence+frontend+backend
tags: [elevenlabs, live-replay, tts, podcast, verification, tier-b]
dependency_graph:
  requires: [13-01, 14-01, 14-02, 14-03, 15-01, 15-02, 15-03]
  provides: [tier-b-evidence-bundle, live-elevenlabs-verification-record]
  affects: [16-02]
tech_stack:
  added: [config_tts_endpoint, live_replay_script]
  patterns: [sse-inline-parser, cbr-byte-offset-splicing, auth-leak-assertion]
key_files:
  created:
    - backend/app/routers/config_tts.py
    - src/lib/ttsVoicesClient.ts
    - .planning/phases/16-live-elevenlabs-verification/fixtures/scenario2-debrief.json
    - .planning/phases/16-live-elevenlabs-verification/scripts/run_live_replay.py
    - .planning/phases/16-live-elevenlabs-verification/evidence/debrief-scenario2-live.mp3
    - .planning/phases/16-live-elevenlabs-verification/evidence/segment-offsets.json
    - .planning/phases/16-live-elevenlabs-verification/evidence/player-screenshot.png
    - .planning/phases/16-live-elevenlabs-verification/16-LIVE-VERIFICATION.md
  modified:
    - backend/app/main.py
    - backend/tests/test_config_tts.py
    - src/components/game/FacilitatorInput/ActionToolbar.tsx
    - src/lib/__tests__/ttsVoicesClient.test.ts
decisions:
  - id: D1
    summary: "/api/config/tts-voices as a dedicated endpoint (not bundled into generic /api/config)"
    rationale: "Voice-ID fetching has a distinct fake-vs-elevenlabs dispatch shape: FakeTTSProvider returns sentinel strings while ElevenLabs provider reads from env vars. Bundling into a generic config endpoint would require the generic handler to understand TTS provider dispatch logic. Dedicated endpoint keeps that concern isolated."
    status: good
  - id: D2
    summary: "No Tier-A preprocessor fixes needed — EDIP pronounced correctly on first pass"
    rationale: "Operator listen-through confirmed letter-by-letter expansion in all three segments. The preprocessor ACRONYMS dict entry added in Phase 13 was sufficient. No re-generation loop was required."
    status: good
  - id: D3
    summary: "~3 s cosmetic duration variance (CBR 48.94 s vs browser/VLC 0:52) documented as expected — no action"
    rationale: "CBR formula (size × 8 / 128000) counts ID3/Lavf header bytes in the numerator, inflating the estimate. VLC and Chrome scan all frames and report correct playback duration. Full audio plays correctly. Expected consequence of no-pydub stitching decision made in plan 14-03."
    status: good
  - id: D4
    summary: "SSE parser auto-fix mid-execution (Rule-3 blocker, commit af6d525)"
    rationale: "Script's initial inline SSE parser captured only data: lines and discarded event: name lines. Consumer dispatch on event.get('event', '') matched nothing so the loop silently exhausted the stream without yielding a done event. Fix: capture event: lines too and attach name as event field on yielded dicts. Verified by successful end-to-end replay immediately after (exit 0, 15.15 s wall-clock)."
    status: good
  - id: D5
    summary: "No Tier-B deferrals — all 3 stock voices produced distinct and intelligible audio on first pass"
    rationale: "Sarah/George/Eric (ElevenLabs stock voices mapped to Kent/Finch/Chen) delivered distinct voice character and clear diction on the Scenario-2 debrief text without requiring re-generation. This confirms the voice mapping locked in plan 14-01 is production-ready."
    status: good
metrics:
  duration: ~45 min (Tasks 1+2 automated; Task 3 checkpoint with operator listen-through)
  completed: 2026-04-19
---

# Phase 16 Plan 01: Live ElevenLabs Verification — Tier-B Evidence Summary

**One-liner:** Real ElevenLabs API replay producing a 782,966-byte stitched MP3 (52 s, three distinct voices) with EDIP letter-by-letter pronunciation confirmed by operator listen-through.

## What Was Built

### Task 1 — `/api/config/tts-voices` endpoint + frontend client

Added `backend/app/routers/config_tts.py` exposing `GET /api/config/tts-voices` that dispatches to `FakeTTSProvider` (returns sentinel voice IDs) or `ElevenLabs` provider (reads `ELEVENLABS_VOICE_KENT/FINCH/CHEN` env vars). Registered router in `backend/app/main.py`. Three pytest tests in `backend/tests/test_config_tts.py` cover the fake-provider response shape. Added `src/lib/ttsVoicesClient.ts` with `fetchTtsVoices()` and wired it into `ActionToolbar.tsx` (replaces hardcoded sentinel strings). Two vitest tests in `src/lib/__tests__/ttsVoicesClient.test.ts`.

Commit: `3701198`

### Task 2 — Scenario-2 fixture + live replay script + evidence

Locked `fixtures/scenario2-debrief.json` (verbatim v1.0 live-run debrief text for all three personas). Authored `scripts/run_live_replay.py` (12-step replay harness: env guard → fixture load → voice-ID fetch → preflight health → POST podcast SSE → MP3 token fetch → evidence write → auth-leak assertion). Script includes inline SSE parser (after Rule-3 auto-fix, commit `af6d525`) and single-persona re-gen mode via `--persona kent|finch|chen`.

Ran the script on `MC211APT2AS5AHG` with `TTS_PROVIDER=elevenlabs` and real voice IDs. Output:
- `evidence/debrief-scenario2-live.mp3` — 782,966 bytes, SHA-256 `e9be8febd7aae986be3d06b3de99a2298610b5d876fc6d94bc3c21b0b98b73af`
- `evidence/segment-offsets.json` — `[0.0, 17.3949375, 35.756437500000004]`

Commits: `b851553` (fixture + script), `af6d525` (SSE parser blocker fix), `fd41e6c` (evidence files)

### Task 3 — Human-verify checkpoint + verification record

Operator listen-through via VLC: confirmed three distinct voices in Kent → Finch → Chen order, 0:52 display duration, EDIP letter-by-letter in all three segments. PodcastPlayer browser screenshot taken with backend live on `TTS_PROVIDER=elevenlabs` (commit `02298a3`).

Authored `16-LIVE-VERIFICATION.md` with six sections: replay metadata, payload (raw + preprocessed + API request shape), per-persona response evidence, stitched MP3 artifact table, SC1/SC2/SC3 verdicts, cross-references.

Commits: `02298a3` (screenshot), `7cd1682` (verification record)

## Verification Summary

| Criterion | Result |
|---|---|
| SC1 — Stitched MP3 plays end-to-end | **PASS** — operator VLC confirms three distinct voices in order, audio plays clearly, no defects |
| SC2 — Acronym pronunciation | **PASS** — EDIP letter-by-letter across all 3 segments; 7 acronyms carry from Phase 13 golden-corpus |
| SC3 — Evidence bundle committed | **PASS** — all 6 bundle components committed (fixture, script, MP3, offsets JSON, screenshot, verification record) |

Backend: 142 tests green. Frontend: 627 tests green.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] SSE parser discarded `event:` name lines — consumer dispatch matched nothing**

- **Found during:** Task 2 — first replay attempt
- **Issue:** Script's initial inline SSE parser only accumulated `data:` lines and reset the buffer on blank lines. The consumer dispatched on `event.get("event", "")` but the parser never populated the `event` key. The ElevenLabs backend emits `event: persona_done` on a separate line before the `data:` JSON body. With the name line discarded, all dispatched events matched the empty-string fallback and were silently dropped. The SSE loop exhausted the stream and the script exited without a `done` token.
- **Fix:** Added `elif raw_line.startswith("event:"):` branch to capture the event name and store it in `event_name`; attached `event_name` as `"event"` key on yielded dict before yielding. No change to dispatch logic in caller — once the key was populated, existing dispatch worked correctly.
- **Verified by:** Immediately re-ran replay — exit 0 at 15.15 s wall-clock, token received, MP3 fetched, evidence written.
- **Files modified:** `.planning/phases/16-live-elevenlabs-verification/scripts/run_live_replay.py`
- **Commit:** `af6d525`
- **Scope impact:** None — no plan-level scope change; replay script is not a product artifact. Fix contained within the planning evidence tooling.

## Handoff to 16-02

The v1.2 milestone audit can cite `16-LIVE-VERIFICATION.md` to validate PODGEN-01..08 and PODPLAY-01..05 against the real ElevenLabs endpoint. PODRES-01..03 evidence remains `15-VERIFICATION.md`. PODDEP-01..02 evidence remains `13-VERIFICATION.md`. REQUIREMENTS.md status flip from Pending → Complete for the 21 Phase-13-through-16 requirements is scoped for plan 16-02.

All three success criteria (SC1, SC2, SC3) are PASS. Plan 16-02 inherits a complete evidence bundle with no open items.
