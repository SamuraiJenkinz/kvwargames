# War Game Engine

## What This Is

A three-persona AI-powered facilitation tool for structured policy tabletop exercises. It runs alongside a human facilitation team during live wargame sessions — three expert AI personas (Kent Valentina, Dr. Alistair Finch, Dr. Michael Chen) respond in-character to events described by the facilitator, while tracking game state across teams, resources, and crisis escalation. v1.0 shipped 2026-04-15, validated with a full 5-round Scenario 2 run against a real corporate LLM. v1.1 shipped the same day, closing the four operational gaps that run surfaced: the setup screen gates Launch on a live LLM health check, direct `/game` navigation with no loaded state redirects cleanly to `/setup`, the React setState-during-render warning is gone, and Finch reliably auto-advances `crisisState` when severity crosses the documented thresholds (verified empirically via Tier B live-LLM replay). v1.2 shipped 2026-04-19, adding a three-voice MP3 podcast for the end-of-session debrief — Kent, Finch, and Chen each read their existing `isDebrief: true` messages through distinct ElevenLabs stock voices, stitched into a single session MP3 with an inline player + Download MP3 button adjacent to the existing markdown download, graceful degradation when ElevenLabs is unreachable, and zero browser-side credentials (Tier-B live replay PASS on first call, 782,966-byte stitched MP3).

## Core Value

Three AI personas respond in-character to facilitator input with accurate, live game state tracking — the tool must enhance the human facilitation team, never slow it down or break immersion.

## Current State (post-v1.2)

- **Shipped:** v1.0 MVP + v1.1 Pre-live-run hardening (both 2026-04-15) + v1.2 Debrief Podcast (2026-04-19) (see `.planning/MILESTONES.md`)
- **v1.2 scope delivered:** 21/21 v1.2 requirements, 11 plans across 4 phases (13–16), Tier-B live ElevenLabs replay PASS on first call against Scenario-2 fixture (782,966-byte stitched MP3, three distinct voices, EDIP letter-by-letter confirmed)
- **Codebase:** TypeScript/TSX frontend + Python backend (incorporates v1.2 additions — TTSProvider ABC, FakeTTSProvider, ElevenLabsTTSProvider, text preprocessor, `POST /api/debrief/podcast` SSE endpoint, `GET /api/health/tts` health endpoint, seven React Podcast components, `usePodcastStore` Zustand, `podcastClient.ts` fetch+ReadableStream SSE consumer); 627/627 frontend (Vitest, 33 test files) + 142/142 backend (pytest) tests green; `tsc -b && vite build` succeeds
- **Audit status:** v1.2 audit `tech_debt` (non-blocking; two Low-severity items — TD-v1.2-01 WMP cosmetic duration display quirk expected consequence of no-pydub stitching with zero audio impact; TD-v1.2-02 v1.1 inherited doc-drift already resolved during v1.2 kickoff). Full audit report at `.planning/milestones/v1.2-MILESTONE-AUDIT.md`
- **Live-endpoint evidence:** Tier-B replay artifacts committed at `.planning/phases/16-live-elevenlabs-verification/16-LIVE-VERIFICATION.md` (stitched MP3 binary, per-segment offsets JSON, player screenshot, 8-row acronym deviation table)
- **Pipeline ready for next live exercise:** LLM health-gate + crisisState rule + clean routing + three-voice debrief podcast + graceful degradation + TTS health informational badge all verified end-to-end

## Next Milestone: TBD

**Candidate backlog** (carried forward from v1.2 deferred items):

- **VOICE-01** — Persona-matched custom voice audition (replaces stock defaults); no new inputs from v1.2 listen-through (all three stock voices delivered distinct intelligible audio on first pass)
- **PLAYER-01** — Download-by-persona MP3 buttons (Kent alone / Finch alone / Chen alone)
- **PLAYER-02** — Media Session API chapter metadata for OS-level media-control integration
- **PLAYER-03** — Custom playback-speed selector (if native browser right-click menu proves undiscoverable)
- **Error-banner UX polish** — truncate verbose ElevenLabs response dump in GenerationPanel (noted during Phase 15 empirical verification)
- **Dev-mode Zustand store exposure** — optionally attach stores to `window.__STORES__` for verification ergonomics (noted during Phase 15)
- Observability hardening, streaming LLM responses (SSE), session analytics dashboard, visual config editor — original v2+ candidates still available

Start next milestone with `/gsd:new-milestone`.

## Requirements

### Validated (shipped in v1.0)

- ✓ LLM proxy API through corporate endpoint with server-side credentials — v1.0
- ✓ Three visually distinct AI personas (Kent, Finch, Chen) responding in-character — v1.0
- ✓ Persona routing logic for round starts, card plays, disputes, debriefs — v1.0
- ✓ Live game state dashboard (crisis severity, EDIP legitimacy, team resources) — v1.0
- ✓ State updates from LLM responses with silent clamping — v1.0
- ✓ Game configuration via JSON (load or generate-from-brief) — v1.0
- ✓ EDIP Security of Supply Wargame as canonical first game config — v1.0
- ✓ In-session reference panels (EDIP cards, national actions, team powers, game guide) — v1.0
- ✓ Round advancement with inject delivery and key tension framing — v1.0
- ✓ Session export — downloadable markdown debrief report — v1.0
- ✓ Setup flow — home, load config, generate from brief, review/edit JSON, launch scenario — v1.0
- ✓ Facilitator input bar with action buttons (advance round, end game + debrief, request debrief) — v1.0
- ✓ Three-column game layout (state panel, chat feed, reference panel) — v1.0
- ✓ Dark-themed UI designed via Google Stitch (directional from spec) — v1.0
- ✓ Responsive layout (1280px+ primary, tablet-usable) — v1.0
- ✓ Context window hardening (N=2, measured 6724 tokens < 7500 safe ceiling) — v1.0
- ✓ Credential audit — zero browser-side Authorization / Bearer / api-key headers — v1.0
- ✓ Backend `GET /api/health/llm` with 8-code error taxonomy and 15s SLA — v1.1
- ✓ Setup-screen LLM health indicator — auto-check on mount, Re-check button, Launch gated on `healthStatus === 'ok'` — v1.1
- ✓ Null-state `/game` redirects silently to `/setup` (DEV auto-seed removed; setState-during-render warning eliminated) — v1.1
- ✓ DEBRIEF-01 regression guard — R1 facilitator input first-character preserved in debrief export (browser/OS artifact confirmed; pure-function pipeline clean) — v1.1
- ✓ crisisState auto-advance rule encoded (Block 7 Finch MUST + Block 9 subsection) — v1.1
- ✓ crisisState rule empirically verified via Tier B live-LLM replay — Finch emitted transition at severity=4 on Scenario 2 R3 — v1.1
- ✓ Generate Podcast button adjacent to Download Debrief (.md); inline `<audio controls>` loaded paused (no auto-play) — v1.2
- ✓ Three-voice MP3 in Kent → Finch → Chen order reading existing `isDebrief: true` messages verbatim (no new LLM call) — v1.2
- ✓ ~700ms silence between persona segments, no leading/trailing pad — v1.2
- ✓ Wargame-vocabulary TTS preprocessor (EDIP/PC/PO/CRM/IC/LEFS/SIEP/SoS acronyms + num2words number normalisation + markdown stripping) — v1.2
- ✓ Word-count soft ceiling confirmation dialog + in-memory cache on unchanged debrief + Re-generate button with force-fresh confirmation — v1.2
- ✓ Download MP3 filename `debrief-{kebab}-{YYYY-MM-DD-HHmm}.mp3` + collapsible transcript panel reusing existing markdown renderer — v1.2
- ✓ Three Skip-to-persona buttons + Now-playing label updating at segment boundaries via backend-returned offsets — v1.2
- ✓ Per-persona progress rows + overall progress bar + Cancel aborting in-flight generation — v1.2
- ✓ `GET /api/health/tts` parallel endpoint (8-code taxonomy, 15s SLA, always HTTP 200) + informational TtsHealthBadge never gating Launch — v1.2
- ✓ Graceful degradation empirically verified — ElevenLabs-down leaves markdown debrief fully functional (SHA-256 `b00eda86…` proof) — v1.2
- ✓ Corporate-firewall reachability proven via operational precedent + HTTP 200 preflight + Tier-B live streaming-payload evidence — v1.2
- ✓ `FakeTTSProvider` via `TTS_PROVIDER` env switch so dev and CI never consume ElevenLabs quota — v1.2

### Active

None — no current milestone. Next milestone candidates listed under "Next Milestone: TBD" above. Start with `/gsd:new-milestone` to scope and define requirements.

### Deferred (v1.3+ candidates)

- Streaming LLM responses token-by-token (if corporate endpoint supports SSE)
- Session analytics dashboard (response times, token usage, persona distribution)
- Visual config editor (form-based, not raw JSON)
- HTTPS deployment on target server (infrastructure, not app code — handled outside GSD cycle)
- Observability hardening (structured logging of 8-code health taxonomy over time, stale-localStorage detection)
- **VOICE-01** — Voice-audition phase for ElevenLabs (persona-matched voices replacing stock defaults; Phase 16 listen-through delivered clean first pass, so no new inputs from v1.2 — original scope carried forward)
- **PLAYER-01/02/03** — Per-persona MP3 download buttons + Media Session API chapter metadata + custom playback-speed selector
- Error-banner UX polish — truncate verbose ElevenLabs response dump in GenerationPanel (flagged during Phase 15 empirical verification)
- Dev-mode Zustand store exposure at `window.__STORES__` — ergonomics for future verification work
- Multi-language debrief audio (ElevenLabs `eleven_multilingual_v2` supports it; scope this only when a non-English EDIP exercise is planned)
- **Multi-tenancy / session isolation.** Current architecture: each browser's Zustand store is in-memory-only, so two users on separate browsers run independent games by accident rather than by design. What's missing for a real multi-user deployment: (a) server-side session IDs so the backend can attribute LLM calls to a specific game session, (b) optional session persistence so a mid-game refresh doesn't lose state, (c) access control (corporate SSO or a shared-secret token) so the LAN URL isn't openly addressable, (d) proxy-level rate limiting if concurrent sessions grow beyond ~10. For the parallel-facilitation use case (two tables at one workshop) the current model is sufficient; this item is only needed if the tool moves toward broader deployment or senior-facilitator review workflows.

### Out of Scope

- Multi-user real-time collaboration — single-facilitator use only
- Authentication / user accounts — handled by corporate SSO layer if needed
- Mobile-first design — facilitation tool used on laptop at a table
- Persistent game history across sessions — session-only state, ephemeral by design
- Full game automation — assists humans, does not replace them
- Pixel-perfect spec UI compliance — Stitch designs the UI using spec as directional guide
- Player-facing views, AI-generated images, drag-and-drop tokens, LLM model selection in UI, complex undo/redo

## Context

- **Detailed spec exists:** `WARGAME_ENGINE_DEV_SPEC.md` in project root — TypeScript interfaces, component specs, prompt engineering, game data, routing logic, UI design tokens
- **Domain:** European Defence Industrial Policy (EDIP) — crisis response and supply chain coordination between EU member states
- **End user:** Human facilitation team running live policy tabletop exercises; single facilitator operates the app on a laptop
- **Corporate deployment:** Runs inside corporate network hitting an internal OpenAI-compatible LLM endpoint (GPT-4o or GPT-5). Windows Server scheduled-task deployment shipped v1.0
- **Game mechanics:** 4 teams, 2 personas + unique team power each. 11 EDIP cards across 7 categories. 4 national actions. Voting (Support ≥ 3, Objections ≤ 1). Resources (PC, PO, Readiness, Stock, CRM, IC) with clamping. Crisis state escalation (No Crisis → Supply Crisis → Security-Related Supply Crisis)
- **UI approach:** Google Stitch for design system. Spec's layout structure, dark theme, persona colour identity, and information hierarchy preserved

## Constraints

- **Tech stack**: FastAPI (Python) backend + React/Vite frontend
- **LLM endpoint**: Corporate OpenAI-compatible API (GPT-4o/5) — all calls proxied server-side, no client-side API keys
- **UI design**: Google Stitch for design system — spec is directional, not prescriptive for exact pixels/hex
- **State management**: Zustand — session-only, no persistence (per spec)
- **Target resolution**: 1280px+ primary, tablet-usable
- **Persona voice**: 2-4 sentences per response, never break character, JSON structured output only
- **Context window**: HISTORY_WINDOW_N=2 (empirical — EDIP prompt is 5124 tokens; keeps 5-round session under 7500 safe ceiling)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| FastAPI + React/Vite over Next.js | User prefers Python backend; rich UI needs React anyway | ✓ Good — proxy stayed thin, frontend owned domain complexity |
| Directional UI from spec, not pixel-perfect | Stitch produces coherent design system; slavish spec copying defeats purpose | ✓ Good — tokens cascaded cleanly across phases 3-5 |
| Google Stitch for UI design | User preference; produces polished, consistent design foundation | ✓ Good |
| Spec as requirements source, GSD derives phases | Spec's phases were for Next.js build; stack change requires different build order | ✓ Good — phase ordering absorbed no rework |
| Corporate LLM (GPT-4o/5) via OpenAI-compatible proxy | Deployment target is corporate network with internal endpoint | ✓ Good — live run verified |
| TypeScript interfaces before everything else (Phase 1) | Cascade rework cost of changing GameState post-Phase 1 is high | ✓ Good — zero rework needed through Phase 8 |
| Backend built Phase 2, before UI (Phases 3-5) | Backend tests independently with curl; no stub-then-real round trip | ✓ Good |
| UI layout against mock data (Phase 5) before LLM wiring (Phase 6) | Decouples visual development from LLM iteration | ✓ Good — entire visual layer shipped before any LLM cost |
| Config generation deferred to Phase 7 | Prompt-engineering risk isolated from core game loop | ✓ Good |
| LLM auth header configurable via env (06-01) | Preserve OpenAI byte-identical default; Azure flip is env-only | ✓ Good |
| HISTORY_WINDOW_N=2 (06-08 empirical) | Measured 5124 prompt tokens forced tighter window than estimate | ✓ Good — 6724/7500 in live 5-round run |
| `structuredClone` over lodash.cloneDeep (06-03) | Node 17+ / modern browsers; zero dependency cost | ✓ Good |
| Four-layer defensive parser with zero `throw` (06-05) | Discriminated unions let consumers pattern-match without try/catch | ✓ Good — no brittle error handling at call sites |
| No server-side JSON parsing of LLM config output (02-03) | Frontend owns validation so errors reach facilitator | ✓ Good |
| Halt debrief bucketing loop at lastDebriefIdx (08-05) | Post-debrief messages were double-rendering in Round-N transcripts | ✓ Good — end-to-end verified in 08-02 live run |
| Run milestone audit before completion (v1 audit 2026-04-14) | Verify requirements coverage, integration, flows before tagging | ✓ Good — surfaced non-blocking tech debt cleanly |
| Health endpoint reuses LLM env config (v1.1) | Zero-config parity with `/api/llm`; no separate credentials | ✓ Good — Azure and OpenAI deployments both work without config drift |
| Health endpoint always returns HTTP 200, body.ok carries signal (v1.1) | Monitoring tools treating non-2xx as outage are not misled | ✓ Good — stable contract for the frontend badge |
| Exception-handler ordering load-bearing and commented (v1.1) | Later handlers are superclasses; refactor regressions must be prevented | ✓ Good — in-code comment survives linter churn |
| DEV auto-seed removed entirely, not flag-hidden (v1.1) | Dead code reintroduces the bug; ship-fast rule | ✓ Good — setState-during-render eliminated by construction |
| DEBRIEF-01 Branch B: regression test retained, no source edit (v1.1) | Test-first diagnosis showed pure-function pipeline clean; v1.0 truncation was browser/OS download artifact | ✓ Good — invariant pinned; no speculative source churn |
| Block 9 transition subsection added alongside (not replacing) clamp-range line (v1.1) | Transition documents the TRIGGER, clamp documents ALLOWED VALUES; both coexist | ✓ Good — RESEARCH.md Risk 3 resolved |
| `withinLimit` promoted from informational to hard CI assertion (v1.1) | Future prompt edits that blow past 7500-token ceiling must fail CI | ✓ Good — 642-token headroom tracked |
| Tier B replay path (a) full R1→R2→R3, not localStorage seed (v1.1) | Most-faithful replay against real endpoint; raw JSON is the PASS artifact | ✓ Good — first-call PASS, no retries; Tier B pattern now reusable |
| PODDEP-01 cleared 2026-04-17 — corporate firewall reachability to `api.elevenlabs.io` empirically proven on `MC211APT2AS5AHG` via operational precedent (separate production app) + live preflight; formal TTS streaming-payload test deferred to Phase 16 | Prove corporate firewall passes ElevenLabs TLS traffic BEFORE any production TTS code is merged; entry-gate task for v1.2 Phase 13 per CONTEXT.md; mirrors v1.1 Tier-B network-posture rule. TTS `requests.post(...)` probe superseded by stronger evidence: existing production app on same host already calls `api.elevenlabs.io` daily | ✓ Good — reachability confirmed via operational precedent + HTTP 200 preflight on 2026-04-17; plans 13-02 and 13-03 unblocked. See [phases/13-firewall-spike-mockable-backend-foundation/13-01-FIREWALL-SPIKE.md](phases/13-firewall-spike-mockable-backend-foundation/13-01-FIREWALL-SPIKE.md) |
| v1.2 Debrief Podcast milestone shipped 2026-04-19 — 21/21 requirements validated against real ElevenLabs endpoint | Tier-B evidence bundle (`16-LIVE-VERIFICATION.md`) demonstrates end-to-end three-voice MP3 generation from Scenario-2 fixture using real v0.10 voice IDs on deployment host MC211APT2AS5AHG; graceful degradation empirically verified in Phase 15 (garbage-key run, SHA-256 `b00eda86…`); firewall reachability empirically verified in Phase 13; 142 pytest + 627 vitest green at audit time | ✓ Good (with 2 low-severity tech-debt deferrals — cosmetic WMP duration display + v1.1 inherited doc-drift TD-v1.1-01 already resolved; see [milestones/v1.2-MILESTONE-AUDIT.md](milestones/v1.2-MILESTONE-AUDIT.md)) |

---
*Last updated: 2026-04-19 after v1.2 milestone completion*
