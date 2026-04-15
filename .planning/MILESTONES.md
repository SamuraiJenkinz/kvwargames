# Project Milestones: War Game Engine

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
