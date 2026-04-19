# Roadmap: War Game Engine

## Milestones

- ✅ **v1.0 MVP** — Phases 1–8 (shipped 2026-04-15) — archived: [`milestones/v1.0-ROADMAP.md`](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 Pre-live-run hardening** — Phases 9–12 (shipped 2026-04-15) — archived: [`milestones/v1.1-ROADMAP.md`](milestones/v1.1-ROADMAP.md)
- 🚧 **v1.2 Debrief Podcast** — Phases 13–16 (in progress)

## Current Milestone

### 🚧 v1.2 Debrief Podcast (In Progress)

**Milestone Goal:** Convert the end-of-session debrief into a three-voice MP3 podcast — Kent, Finch, and Chen each read their own existing `isDebrief: true` messages through distinct ElevenLabs stock voices, stitched into a single session MP3. Facilitators get an inline player and a Download MP3 button adjacent to the existing markdown download. Zero browser-side credentials; the markdown export path remains the single source of truth for session memory and must never share a failure boundary with the audio path.

**Shape:** Four phases, mock-first to live-last, mirroring the v1.1 Tier-B precedent.
- Phase 13 locks the entry-gate firewall spike and lands the 100%-mockable backend foundation (TTSProvider ABC, FakeTTSProvider default, text preprocessor).
- Phase 14 ships the full end-to-end podcast flow against the fake backend — endpoint, player, cache, cancel, skip-to-persona, Re-generate — so every UX surface is debugged before any real ElevenLabs byte is spent.
- Phase 15 adds health-check parity and proves graceful degradation by flipping ElevenLabs off mid-session and confirming the markdown debrief still works.
- Phase 16 is the first phase that calls a real ElevenLabs key; it is gated on the Phase 13 firewall spike and applies the v1.1 Tier-B replay-and-commit-raw-bytes pattern to a Scenario-2 debrief fixture.

## Phases (v1.2)

- [x] **Phase 13: Firewall Spike + Mockable Backend Foundation** — PODDEP-01 corporate-firewall proof, FakeTTSProvider dev default, TTSProvider ABC, ElevenLabs concrete provider (not exercised yet), and the wargame-vocabulary TTS preprocessor. ✅ 2026-04-18
- [x] **Phase 14: Podcast Endpoint + Player (End-to-End on Fake)** — `POST /api/debrief/podcast` (SSE), `GET /api/debrief/podcast/audio?token=...`, podcastStore (Zustand) with blob-URL lifecycle, PodcastPlayer component, cache / cancel / re-generate / skip-to-persona / word-count soft-ceiling, all verified against FakeTTSProvider. ✅ 2026-04-18
- [x] **Phase 15: TTS Health + Graceful Degradation** — `GET /api/health/tts`, setup-screen TtsHealthBadge (informational, does NOT gate Launch), and empirical proof that ElevenLabs-down leaves the markdown debrief fully functional. ✅ 2026-04-19
- [ ] **Phase 16: Live ElevenLabs Verification + Milestone Audit** — First phase that calls a real ElevenLabs key. Tier-B replay against a Scenario-2 debrief fixture, listen-through, raw MP3 committed as evidence, milestone audit.

## Phase Details

### Phase 13: Firewall Spike + Mockable Backend Foundation
**Goal**: The backend can produce a stitched three-voice MP3 from a debrief-shaped input entirely against a fake provider — and the corporate firewall is empirically proven to allow the real provider's long-running TLS payload before any production code targets it.
**Depends on**: Phase 12 (backend and health-endpoint scaffolding shipped in v1.1)
**Requirements**: PODDEP-01, PODDEP-02, PODGEN-05
**Success Criteria** (what must be TRUE):
  1. A `curl` or `python -c "requests.post(...)"` run from inside the corporate network against `api.elevenlabs.io` returns a >60-second MP3 payload intact, and the raw command output is committed to the phase's evidence folder and noted in PROJECT.md Key Decisions with date.
  2. Setting `TTS_PROVIDER=fake` in `.env` (the dev default) causes `POST /api/debrief/podcast` invocations in a local `pytest` run to return deterministic stitched MP3 bytes with no network traffic to `api.elevenlabs.io` whatsoever (verified via `httpx` mock-transport spy or equivalent).
  3. Running the preprocessor on the v1.0 Scenario-2 `isDebrief: true` message corpus yields output where `EDIP`, `PC`, `PO`, `CRM`, `IC`, `LEFS`, `SIEP`, and `SoS` are expanded to the correct letter-spelled or word forms, numbers are normalised to words, and markdown emphasis characters (`**`, `*`, `_`) are stripped — verified by a golden-file test.
  4. A local `pytest` run ends with the `/api/debrief/podcast` endpoint returning a valid MP3 `Content-Type: audio/mpeg` response whose bytes, when written to disk, open and play in VLC (or equivalent) at the expected ~3-segments × fake-duration length.
**Plans**: 3 plans

Plans:
- [x] 13-01: Firewall spike + ElevenLabs-reachability evidence + PROJECT.md Key Decision (PODDEP-01) — completed 2026-04-17 (operational precedent + preflight; TTS probe superseded)
- [x] 13-02: TTSProvider ABC + FakeTTSProvider + ElevenLabsTTSProvider (concrete, not yet exercised) + `TTS_PROVIDER` env switch (PODDEP-02) — completed 2026-04-17
- [x] 13-03: `text_preprocessor.py` with pronunciation dict + `num2words` integration + golden-file test corpus from Scenario-2 debriefs (PODGEN-05) — completed 2026-04-17

### Phase 14: Podcast Endpoint + Player (End-to-End on Fake)
**Goal**: A facilitator sitting at the app can click Generate Podcast after a full game and — with `TTS_PROVIDER=fake` — hear a three-voice stitched MP3 play inline, download it with the correct filename, skip between persona segments, see a progress indicator update, cancel mid-generation, and re-generate from cache or force a fresh run, all without any live ElevenLabs traffic.
**Depends on**: Phase 13
**Requirements**: PODGEN-01, PODGEN-02, PODGEN-03, PODGEN-04, PODGEN-06, PODGEN-07, PODGEN-08, PODPLAY-01, PODPLAY-02, PODPLAY-03, PODPLAY-04, PODPLAY-05, PODUX-01, PODUX-02, PODUX-03
**Success Criteria** (what must be TRUE):
  1. At end-of-game debrief, the facilitator sees a "Generate Podcast" button adjacent to the existing "Download Debrief (.md)" button, clicks it, and within the FakeTTSProvider's simulated render time an HTML5 `<audio controls>` element appears pre-loaded with the stitched MP3 in the paused state (no auto-play).
  2. The generated MP3, downloaded via a "Download MP3" button, saves as `debrief-{kebab-game-name}-{YYYY-MM-DD-HHmm}.mp3`, opens in VLC, contains three clearly-distinguishable persona segments in Kent → Finch → Chen order with ~700 ms silence between each, and has no leading or trailing silence pad.
  3. The player area offers three Skip buttons (Skip to Kent / Finch / Chen) that seek the audio element to the start of each persona's segment using backend-returned offsets, and a "Now playing: {Persona name}" label updates at each segment boundary as playback crosses those offsets.
  4. While generation is in flight, the facilitator sees a per-persona status line ("Kent ✓ · Finch rendering… · Chen waiting") plus an overall progress bar with percentage, can click Cancel to abort the fetch and return the UI to the pre-generation state with no partial MP3 offered, and — if the combined debrief exceeds the ~2000-word soft ceiling — sees a word-count + estimated-audio-length confirmation dialog before any provider call.
  5. Clicking Generate a second time with unchanged debrief text returns the previously-generated MP3 instantly from in-memory cache with zero additional provider calls, and a dedicated "Re-generate" button invalidates that cache and prompts for confirmation before re-hitting the provider.
  6. An expandable panel below the player renders the markdown debrief transcript inline (collapsed by default) using the existing markdown rendering path — no new markdown dependency added.
**Plans**: 3 plans

Plans:
- [x] 14-01: Backend SSE sidecar endpoint (`POST /api/debrief/podcast` text/event-stream) + paired audio-by-token endpoint + `audio_generator.py` orchestrator (raw-bytes stitching with committed 700ms silence pad fixture, CBR per-segment offsets, in-process cache + token store, client-disconnect abort between personas) (PODGEN-02, PODGEN-03, PODGEN-04, PODGEN-07 backend) — completed 2026-04-18
- [x] 14-02: Frontend data layer: `podcastClient.ts` (fetch + ReadableStream SSE consumer, NOT EventSource) + standalone `podcastStore` (Zustand) with blob-URL lifecycle, FSM (idle/generating/done/error), abort plumbing + `mp3Filename.ts` (local-time kebab filename) + `wordCountEstimate.ts` (150 wpm + 3×delay math) + extended jsdom test harness (PODGEN-06 math, PODGEN-07 UX, PODGEN-08 wiring, PODUX-03) — completed 2026-04-18
- [x] 14-03: Visible UI: `PodcastSection` orchestrator + `GenerationPanel` + `PodcastPlayer` + `TranscriptPanel` + two `ConfirmDialog`-based modals + `ActionToolbar` three-state button row + human-verify checkpoint on dev server (PODGEN-01, PODPLAY-01..05, PODUX-01/02, UX halves of PODGEN-06/07/08) — completed 2026-04-18

### Phase 15: TTS Health + Graceful Degradation
**Goal**: The facilitator sees TTS connectivity status on the setup screen before launching — informational only, never gating Launch — and if ElevenLabs is unreachable or broken mid-session, the markdown debrief path continues to work unchanged.
**Depends on**: Phase 14 (needs a working end-to-end podcast path to verify that disabling it does NOT break the markdown path)
**Requirements**: PODRES-01, PODRES-02, PODRES-03
**Success Criteria** (what must be TRUE):
  1. `GET /api/health/tts` always returns HTTP 200; `body.ok === true` with `latencyMs` when the provider is reachable and `body.ok === false` with a structured 8-code reason (`timeout`, `auth_error`, `not_found`, `rate_limited`, `upstream_error`, `network_error`, `tls_error`, `invalid_response`) when it is not; response arrives within the 15-second SLA.
  2. The setup screen shows a TtsHealthBadge adjacent to the existing LLM HealthBadge with the same auto-check-on-mount + Re-check button shape; when TTS health is red the Launch button remains enabled (unlike the LLM gate) and the badge shows the message "Podcast generation unavailable — markdown debrief will still work."
  3. Setting `ELEVENLABS_API_KEY` to a garbage value and running a full game to end-of-debrief produces a clear error status in the podcast area (with reason code) while the adjacent "Download Debrief (.md)" button still downloads the complete session markdown with no regressions — verified by empirical run.
  4. Mid-generation network interruption (simulated by killing the FakeTTSProvider mid-call or mocking a `RequestError`) surfaces the same structured error status in the podcast area; the markdown download remains unaffected.
**Plans**: 3 plans

Plans:
- [x] 15-01: Backend `GET /api/health/tts` router (8-code taxonomy, 15s SLA, 30s cache, /v1/user probe, TTS_PROVIDER=fake short-circuit, env_tts_elevenlabs conftest fixture, 14 pytest tests) (PODRES-03) — completed 2026-04-19
- [x] 15-02: Frontend TtsHealthBadge (amber failed-state, locked copy, informational-only, Launch-never-blocked) + formatLatency extract + mid-gen failure vitest safety net (PODRES-02 + engineering-layer PODRES-01) — completed 2026-04-19
- [x] 15-03: Empirical verification: garbage-key run end-to-end, 15-VERIFICATION.md evidence bundle with screenshots + SHA-256 of downloaded debrief.md (PODRES-01 empirical) — completed 2026-04-19

### Phase 16: Live ElevenLabs Verification + Milestone Audit
**Goal**: With a real ElevenLabs API key configured and the Phase 13 firewall spike cleared, generating a podcast from a Scenario-2 debrief fixture produces an audibly correct three-voice MP3 end-to-end on the target deployment host — and the v1.2 milestone is audited complete.
**Depends on**: Phase 13 (PODDEP-01 firewall spike must be cleared), Phase 14 (end-to-end path must work on the fake), Phase 15 (graceful-degradation must be verified — if Phase 16's live run fails, the milestone still ships usefully)
**Requirements**: None new (verification phase — covers PODGEN-01..08 and PODPLAY-01..05 against real ElevenLabs, mirroring the v1.1 Tier-B pattern)
**Success Criteria** (what must be TRUE):
  1. `TTS_PROVIDER=elevenlabs` plus a real API key pointed at the v0.10 configured voice IDs produces a stitched MP3 from a captured Scenario-2 end-of-game debrief that plays end-to-end in VLC at the expected duration (3 segments × ~30–60s each + 2 × ~700ms pads), with three distinct voices in Kent → Finch → Chen order.
  2. A human listen-through confirms correct acronym pronunciation against the preprocessor's golden-file corpus — `EDIP`, `PC`, `PO`, `CRM`, `IC`, `LEFS`, `SIEP`, `SoS` all sound right — with any deviations captured as either a preprocessor-dict update or a documented stock-voice limitation to carry into the v1.3 VOICE-01 backlog item.
  3. The raw live response artifacts (request body, response headers, final stitched MP3 bytes as a committed binary, per-segment offsets JSON) are written to `.planning/phases/16-{name}/16-LIVE-VERIFICATION.md` as the Tier-B evidence bundle, following the v1.1 precedent at `12-LIVE-VERIFICATION.md`.
  4. The v1.2 milestone audit (`.planning/milestones/v1.2-MILESTONE-AUDIT.md`) confirms 21/21 requirements delivered, 4/4 phases complete, graceful-degradation empirically verified, and no blocking tech debt — running the same audit shape as `v1.1-MILESTONE-AUDIT.md`.
**Plans**: 2 plans (TBD)

Plans:
- [ ] 16-01: Live ElevenLabs Tier-B replay against Scenario-2 debrief fixture + commit raw MP3 + per-segment offsets + acronym listen-through notes
- [ ] 16-02: v1.2 milestone audit + PROJECT.md Key Decisions update + REQUIREMENTS.md status flip to Validated

## Progress

**Execution Order:**
Phases execute in numeric order: 13 → 14 → 15 → 16

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 3/3 | Complete | 2026-04-13 |
| 2. FastAPI Backend | v1.0 | 4/4 | Complete | 2026-04-13 |
| 3. UI Design System | v1.0 | 4/4 | Complete | 2026-04-13 |
| 4. Setup Screen | v1.0 | 4/4 | Complete | 2026-04-14 |
| 5. Game Screen Layout | v1.0 | 7/7 | Complete | 2026-04-14 |
| 6. LLM Integration | v1.0 | 9/9 | Complete | 2026-04-14 |
| 7. Debrief, Export, Config Generation | v1.0 | 4/4 | Complete | 2026-04-15 |
| 8. QA and Credential Audit | v1.0 | 5/5 | Complete | 2026-04-15 |
| 9. LLM Health Check — Backend | v1.1 | 2/2 | Complete | 2026-04-15 |
| 10. LLM Health Check — Frontend | v1.1 | 2/2 | Complete | 2026-04-15 |
| 11. Polish Bug Fixes | v1.1 | 1/1 | Complete | 2026-04-15 |
| 12. Crisis State Prompt Engineering | v1.1 | 2/2 | Complete | 2026-04-15 |
| 13. Firewall Spike + Mockable Backend Foundation | v1.2 | 3/3 | Complete | 2026-04-18 |
| 14. Podcast Endpoint + Player (End-to-End on Fake) | v1.2 | 3/3 | Complete | 2026-04-18 |
| 15. TTS Health + Graceful Degradation | v1.2 | 3/3 | Complete | 2026-04-19 |
| 16. Live ElevenLabs Verification + Milestone Audit | v1.2 | 0/2 | Not started | - |
