# Project Milestones: War Game Engine

## v1.2 Debrief Podcast (Shipped: 2026-04-19)

**Delivered:** Three-voice MP3 podcast for end-of-session debriefs — Kent, Finch, and Chen each read their existing `isDebrief: true` messages through distinct ElevenLabs stock voices, stitched into a single session MP3 with an inline player + Download MP3 button adjacent to the existing markdown download, graceful degradation when ElevenLabs is unreachable, and zero browser-side credentials.

**Phases completed:** 13–16 (11 plans total)

**Key accomplishments:**

- Mock-first, live-last execution — `FakeTTSProvider` as `TTS_PROVIDER=fake` dev default (zero network, verified by httpx spy) plus concrete `ElevenLabsTTSProvider` with the full 8-code error taxonomy; Phases 13/14/15 debugged every UX surface against the fake before any ElevenLabs quota was spent
- Corporate-firewall reachability proven via operational precedent (existing production app on MC211APT2AS5AHG calls `api.elevenlabs.io` daily) plus HTTP 200 `/v1/voices` preflight on 2026-04-17; streaming-payload evidence delivered by the Phase 16 Tier-B replay
- `POST /api/debrief/podcast` as SSE (blocking streaming `audio/mpeg`, not 202-then-poll) + paired `GET /api/debrief/podcast/audio?token=` + `audio_generator.py` orchestrator with raw-bytes stitching (no pydub/ffmpeg — all segments are `mp3_44100_128` CBR, frames are self-contained), committed 700ms silence pad fixture, in-process cache keyed on `(texts + voice_ids)` SHA-256, client-disconnect abort between personas
- Frontend: `podcastClient.ts` (fetch + ReadableStream SSE consumer), standalone `usePodcastStore` Zustand FSM with blob-URL revoke-before-create invariant, seven React components wiring GenerationPanel (per-persona status + discrete 0/33/66/100% progress bar + Cancel) → PodcastPlayer (`<audio controls>` no-autoplay + Skip-to-persona offsets + Now-playing label + collapsible transcript) → ActionToolbar three-state podcast button row with two confirm dialogs
- Wargame-vocabulary preprocessor — fixed-order pipeline `markdown_strip → acronym_expand → number_normalize`, 14-entry acronym dict (EDIP/PC/PO/CRM/IC/LEFS/SIEP/SoS + plurals, word-boundary case-sensitive longest-first), `num2words==0.5.14` for years/ordinals/percentages/plain integers, 12-entry golden-file corpus sourced verbatim from Scenario-2 injects, 52-test parametrized pytest suite
- TTS health parity — `GET /api/health/tts` as a parallel endpoint to `/api/health/llm` (explicitly not extended — LLM-down hard-fails Launch but TTS-down is informational; one `body.ok` cannot carry both signals), 30s cache with `?force=true` bypass, `TtsHealthBadge` informational amber state with locked copy "Podcast generation unavailable — markdown debrief will still work.", Launch button never gated on TTS health (PODRES-02 invariant)
- Graceful degradation empirically verified — garbage-key browser run produced `[upstream_error]` banner in GenerationPanel while the adjacent Download Debrief (.md) button still delivered a valid 7,466-byte markdown file (SHA-256 `b00eda86ee230d4058783548c2104d9e374f7b037ee9d914ccc9e916329057ec`); two-endpoint code divergence (`/v1/user` → `auth_error`, `/v1/text-to-speech/{voice_id}` → `upstream_error`) documented as expected behaviour that strengthens the dispatch-table verification
- Tier-B live ElevenLabs replay PASSED on first call — 782,966-byte stitched MP3 generated against Scenario-2 debrief fixture with real v0.10 voice IDs on the target deployment host; three distinct intelligible voices in Kent → Finch → Chen order with ~700ms silence pads between segments (offsets `[0.0, 17.3949375, 35.756437500000004]` monotonically increasing); EDIP letter-by-letter pronunciation confirmed on first pass across all 3 segments (no Tier-A preprocessor fixes needed; no Tier-B voice deferrals seeded into v1.3 VOICE-01)
- v1.2 milestone audit PASSED — 21/21 requirements SATISFIED, 4/4 phases, 4/4 integration, 3/3 E2E flows; status `tech_debt` with two Low-severity non-blocking items (TD-v1.2-01 WMP cosmetic duration display quirk expected consequence of no-pydub stitching; TD-v1.2-02 v1.1 inherited doc-drift already resolved during v1.2 kickoff)

**Stats:**

- 135 files changed (+22,863 / −1,517 lines total) across the v1.2 range
- 75 commits across 4 phases / 11 plans
- Timeline: 2026-04-15 → 2026-04-19 (~4 days, starting same day as v1.0/v1.1 ship)
- Test suites at audit: 627/627 frontend (Vitest, 33 test files) + 142/142 backend (pytest) + `tsc -b && vite build` succeeds

**Git range:** `0f592e8` (v1.1 completion) → `84b0ca8` (build(16): regenerate dist/)

**Milestone audit:** `milestones/v1.2-MILESTONE-AUDIT.md` — 21/21 requirements, 4/4 phases, 4/4 integration, 3/3 flows; `tech_debt` status (non-blocking; two Low-severity items documented).

**Live-endpoint evidence:** `.planning/phases/16-live-elevenlabs-verification/16-LIVE-VERIFICATION.md` — Tier-B replay with committed 782,966-byte stitched MP3 binary, per-segment offsets JSON, player screenshot, and 8-row acronym deviation table.

**What's next:** Next milestone TBD — candidate backlog includes v1.3 VOICE-01 (persona-matched voice audition replacing stock defaults), PLAYER-01/02/03 (per-persona MP3 download + Media Session API chapters + playback-speed selector), error-banner UX polish, and dev-mode Zustand store exposure at `window.__STORES__`. Start with `/gsd:new-milestone`.

---

## v1.1 Pre-live-run hardening (Shipped: 2026-04-15)

**Delivered:** Operational-gap closure milestone — a full-auth LLM health-check endpoint, a launch-gating setup-screen health badge, removal of the DEV auto-seed path that caused a blank-screen-plus-React-warning on direct `/game` hits, and an empirically-verified `crisisState` auto-advance rule in the Finch persona prompt.

**Phases completed:** 9–12 (7 plans total)

**Key accomplishments:**

- `GET /api/health/llm` backend endpoint with 8-code error taxonomy (`timeout` / `auth_error` / `not_found` / `rate_limited` / `upstream_error` / `network_error` / `tls_error` / `invalid_response`), 15-second per-request SLA, auth parity with `/api/llm` — always returns HTTP 200 so monitoring tools are not misled
- Setup-screen `HealthBadge` component with AbortController-safe fetch, auto-check on mount, Re-check button with in-flight guard, three-state rendering (spinner / green dot / red dot); Launch button gated behind `healthStatus === 'ok'` with no override path
- DEV auto-seed removed entirely — `GuardedGameScreen` reduced to null-check + silent `<Navigate to="/setup" replace />`; `src/mocks/seedMockState.ts` deleted; "setState called during render" warning eliminated by construction
- DEBRIEF-01 regression guard retained — test-first diagnosis (Branch B) confirmed the R1-first-character truncation was a browser/OS download artifact from the v1.0 live run, not a pure-function defect; test pins the invariant
- `crisisState` transition rule doubly-encoded in the system prompt (Block 7 Finch MUST + Block 9 subsection), locked with first-repo-use inline snapshots, parser/applier round-trip tests, and a promoted hard `withinLimit` token-budget assertion
- Tier B live-LLM replay PASSED on the first call — Finch emitted `{crisisSeverity: 4, crisisState: "Security-Related Supply Crisis"}` in a single stateUpdate on R3 of Scenario 2; raw JSON committed as the evidence artifact at `12-LIVE-VERIFICATION.md`; Tier B pattern (encode → lock → replay → commit raw response) now reusable

**Stats:**

- 45 files changed (+7,241 / −105 lines total)
- 12 frontend files changed (+782 / −51 TypeScript/TSX)
- 3 backend files changed (+424 / −2 Python)
- 39 commits across 4 phases / 7 plans
- Timeline: 2026-04-15 (~4 hours of concentrated execution, same day as v1.0 MVP ship)

**Git range:** `2fe62c5` (docs: define milestone v1.1 requirements) → `0f592e8` (docs(12): complete crisis-state-prompt-engineering phase)

**Milestone audit:** `milestones/v1.1-MILESTONE-AUDIT.md` — 18/18 requirements, 4/4 phases, 4/4 integration, 3/3 flows; `tech_debt` status (non-blocking; sole item was a doc-drift line in ROADMAP.md, resolved during this completion).

**Test suite evidence:** 534/534 frontend (Vitest, 23 test files) + 17/17 backend (pytest) + `tsc -b && vite build` succeeds.

**What's next:** Next milestone TBD — candidates include streaming LLM responses (if corporate endpoint supports SSE), session analytics dashboard, or visual config editor. Start with `/gsd:new-milestone`.

---

## v1.0 MVP (Shipped: 2026-04-15)

**Delivered:** A three-persona AI facilitation console for live policy tabletop exercises — running the EDIP Security of Supply wargame end-to-end against a real corporate LLM, with zero browser-side credentials and a downloadable markdown debrief.

**Phases completed:** 1–8 (39 plans total)

**Key accomplishments:**

- Type-safe EDIP game engine with Zustand store, pure clamping state updater, and EDIP canonical config (2 scenarios, 4 teams, 11 cards, 4 national actions)
- Zero-leak credential proxy — FastAPI backend with configurable auth (`Authorization: Bearer` ↔ Azure `api-key`); HAR evidence confirms no browser-side credentials
- Three-column live game UI — Stitch-directional dark theme, persona-coloured chat feed (7 message types), state dashboard with delta ghosts and cell pulse
- Hardened LLM loop — 10-block system prompt, 4-layer defensive JSON parser (zero `throw` statements), sliding context window (N=2 for 8K safe ceiling), structured error recovery
- End-to-end facilitator flow — home → load or generate config → launch → 5-round game → download markdown debrief
- Verified in live run — Scenario 2 full 5-round PASS-WITH-POLISH against real corporate LLM; 515/515 frontend + 12/12 backend tests green

**Stats:**

- 233 files tracked (11,117 LOC TypeScript/TSX + 1,187 LOC Python)
- 159 commits across 8 phases / 39 plans
- Timeline: 2026-04-13 → 2026-04-15 (~2 days of concentrated execution)

**Git range:** `ed4c6b5` (docs: initialize project) → `574efe3` (docs(guides): quick-start)

**Milestone audit:** `milestones/v1.0-MILESTONE-AUDIT.md` — 75/75 requirements, 8/8 phases, 6/6 integration, 6/6 flows; tech debt accepted non-blocking.

**What's next:** Phase 9 polish backlog (DEV-seed React warning, R1 input strip, crisisState auto-advance prompt tuning) or new feature set — next milestone TBD.

---
