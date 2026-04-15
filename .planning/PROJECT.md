# War Game Engine

## What This Is

A three-persona AI-powered facilitation tool for structured policy tabletop exercises. It runs alongside a human facilitation team during live wargame sessions — three expert AI personas (Kent Valentina, Dr. Alistair Finch, Dr. Michael Chen) respond in-character to events described by the facilitator, while tracking game state across teams, resources, and crisis escalation. v1.0 shipped 2026-04-15 and has been validated with a full 5-round Scenario 2 run against a real corporate LLM.

## Core Value

Three AI personas respond in-character to facilitator input with accurate, live game state tracking — the tool must enhance the human facilitation team, never slow it down or break immersion.

## Current State (post-v1.0)

- **Shipped:** v1.0 MVP on 2026-04-15 (see `.planning/MILESTONES.md`)
- **Scope delivered:** 75/75 v1 requirements, 39 plans across 8 phases, PASS-WITH-POLISH on Scenario 2 live run
- **Deployment:** Windows Server scheduled-task deployment committed (`4c388e2`); facilitator guides committed (`574efe3`)
- **Codebase:** 11.1K LOC TypeScript/TSX (frontend) + 1.2K LOC Python (backend); 515/515 frontend + 12/12 backend tests green
- **Audit status:** `tech_debt` (non-blocking; items logged in `.planning/milestones/v1.0-MILESTONE-AUDIT.md`)
- **Post-v1.0 hotfix:** `crypto.randomUUID` fallback for non-secure (HTTP) contexts — Send button broken on HTTP deploy (commit `474c1f6`, 2026-04-15)

## Current Milestone: v1.1 Pre-live-run hardening

**Goal:** Close the operational gaps surfaced by the v1.0 live run and the HTTP deploy incident — so the next live exercise starts from a known-good pipeline.

**Target features:**
- LLM health indicator on setup screen (full auth round-trip; auto on mount + manual re-check; blocks Launch + shows actionable error on failure)
- Remove DEV-seed setState-during-render warning at `gameStore.ts:304` (redirect `/game` with null state to `/setup` unconditionally)
- R1 facilitator input first-character strip fix (debrief export cosmetic — "ound 1 is now live...")
- `crisisState` auto-advance prompt-engineering review (severity reached 4 in live run but state never transitioned)

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

### Active (v1.1 scope)

- [ ] LLM health indicator on setup screen — full auth round-trip, auto + manual re-check, blocks Launch with actionable error
- [ ] Fix DEV-seed setState-during-render warning at `gameStore.ts:304`
- [ ] R1 input first-character strip cosmetic fix in debrief export
- [ ] `crisisState` auto-advance prompt-engineering review

### Deferred (v2+ candidates, not in v1.1)

- Streaming LLM responses token-by-token (if corporate endpoint supports SSE)
- Session analytics dashboard (response times, token usage, persona distribution)
- Visual config editor (form-based, not raw JSON)
- HTTPS deployment on target server (infrastructure, not app code — handled outside GSD cycle)

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

---
*Last updated: 2026-04-15 after v1.1 milestone start*
