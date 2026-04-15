# Roadmap: War Game Engine

## Milestones

- ✅ **v1.0 MVP** — Phases 1–8 (shipped 2026-04-15)
- 🚧 **v1.1 Pre-live-run hardening** — Phases 9–12 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1–8) — SHIPPED 2026-04-15</summary>

### Phase 1: Foundation
**Goal**: Type-safe EDIP game engine with Zustand store and canonical config
**Plans**: 3 plans

Plans:
- [x] 01-01: TypeScript interfaces and game state types
- [x] 01-02: Zustand store with pure clamping state updater
- [x] 01-03: EDIP canonical game config (2 scenarios, 4 teams, 11 cards)

### Phase 2: FastAPI Backend
**Goal**: Zero-leak credential proxy with configurable auth and backend tests
**Plans**: 4 plans

Plans:
- [x] 02-01: FastAPI project scaffold and LLM proxy route
- [x] 02-02: Auth-mode config (Bearer / Azure api-key)
- [x] 02-03: Config generation endpoint
- [x] 02-04: Backend test suite (12 tests)

### Phase 3: UI Design System
**Goal**: Stitch-directional dark theme with persona colour identity and design tokens
**Plans**: 4 plans

Plans:
- [x] 03-01: Google Stitch design session
- [x] 03-02: Design token implementation
- [x] 03-03: Core component library
- [x] 03-04: Theme integration

### Phase 4: Setup Screen
**Goal**: Full facilitator setup flow (home → load/generate config → review → launch)
**Plans**: 4 plans

Plans:
- [x] 04-01: Home screen and navigation
- [x] 04-02: Load config flow
- [x] 04-03: Generate from brief flow
- [x] 04-04: Review/edit JSON and launch

### Phase 5: Game Screen Layout
**Goal**: Three-column live game UI with persona chat feed and state dashboard
**Plans**: 7 plans

Plans:
- [x] 05-01: Three-column layout scaffold
- [x] 05-02: State dashboard (crisis severity, EDIP legitimacy, team resources)
- [x] 05-03: Chat feed with 7 message types
- [x] 05-04: Persona colour identity in chat
- [x] 05-05: Reference panel (cards, actions, team powers, guide)
- [x] 05-06: Facilitator input bar with action buttons
- [x] 05-07: Delta ghosts and cell pulse

### Phase 6: LLM Integration
**Goal**: Hardened LLM loop with structured JSON output and sliding context window
**Plans**: 9 plans

Plans:
- [x] 06-01: Backend Azure auth fix
- [x] 06-02: TypeScript types extension
- [x] 06-03: State updater refinement
- [x] 06-04: System prompt (10-block)
- [x] 06-05: Four-layer defensive JSON parser
- [x] 06-06: Persona routing logic
- [x] 06-07: Round advancement and inject delivery
- [x] 06-08: Context window hardening (N=2 empirical)
- [x] 06-09: LLM loop integration

### Phase 7: Debrief, Export, and Config Generation
**Goal**: Downloadable markdown debrief and config-from-brief generation
**Plans**: 4 plans

Plans:
- [x] 07-01: Debrief data bucketing and markdown export
- [x] 07-02: Config generation prompt and endpoint
- [x] 07-03: Export download flow
- [x] 07-04: Config review and editing

### Phase 8: QA and Credential Audit
**Goal**: Live-run verification and zero browser-side credential proof
**Plans**: 5 plans

Plans:
- [x] 08-01: Test suite completion (515/515 frontend)
- [x] 08-02: Scenario 2 full 5-round live run
- [x] 08-03: HAR credential audit (zero Bearer/api-key in browser)
- [x] 08-04: Windows Server scheduled-task deployment
- [x] 08-05: Debrief bucketing hotfix (halt at lastDebriefIdx)

</details>

---

### 🚧 v1.1 Pre-live-run hardening (In Progress)

**Milestone Goal:** Close operational gaps surfaced by the v1.0 live run and HTTP deploy incident — so the next live exercise starts from a known-good pipeline.

#### Phase 9: LLM Health Check — Backend

**Goal**: The backend can verify its own LLM connectivity with a cheap, authenticated round-trip and report structured results
**Depends on**: Phase 8 (backend already deployed; this extends it)
**Requirements**: HEALTH-01, HEALTH-02, HEALTH-03, HEALTH-04, HEALTH-05, HEALTH-06
**Success Criteria** (what must be TRUE):
  1. `GET /api/health/llm` returns `{ ok: true, latencyMs }` when the LLM endpoint is reachable and authenticated
  2. `GET /api/health/llm` returns `{ ok: false, status, code, hint }` when credentials are wrong or the endpoint is unreachable — the hint is human-readable (e.g., "Check LLM_API_KEY in .env")
  3. The health request uses a minimal prompt so the cost per check is negligible (target ~50 tokens)
  4. The endpoint respects the same `LLM_EXTRA_HEADERS` / auth-mode env vars as `/api/llm` — no separate credential config needed
  5. A check that hangs returns `ok: false` with a timeout hint after 15 seconds, not an unclosed connection

**Plans**: 2 (consolidated during planning)

Plans:
- [x] 09-01: `GET /api/health/llm` endpoint (success/failure shapes, auth parity, 15s timeout, 8-code taxonomy)
- [x] 09-02: Backend test coverage (success, auth failure, timeout, auth-mode parity, extra-headers parity)

---

#### Phase 10: LLM Health Check — Frontend

**Goal**: The setup screen shows the facilitator a live LLM connection status before they can launch — green means go, red means fix it first
**Depends on**: Phase 9 (backend health endpoint must exist)
**Requirements**: HEALTH-07, HEALTH-08, HEALTH-09, HEALTH-10, HEALTH-11, HEALTH-12
**Success Criteria** (what must be TRUE):
  1. Opening the setup screen automatically triggers an LLM health check — the facilitator sees a status indicator (spinner → green dot or red dot) without clicking anything
  2. When the check passes, the indicator shows a green dot and displays the measured latency (e.g., "Connected — 820ms")
  3. When the check fails, the indicator shows a red dot and displays the actionable error hint returned by the backend (status code + hint text)
  4. A "Re-check" button lets the facilitator retry at any time without refreshing the page
  5. "Launch Scenario" is disabled while the status is failed or checking — the facilitator cannot start a broken session

**Plans**: TBD (estimate 2–3 plans)

Plans:
- [x] 10-01: Health status indicator component (spinner / green / red states)
- [x] 10-02: Auto-check on mount, Re-check button, error display, Launch gate

---

#### Phase 11: Polish Bug Fixes

**Goal**: Three known v1.0 defects are gone — a React warning, a bad redirect, and a cosmetic debrief truncation
**Depends on**: Phase 8 (fixes apply to shipped codebase)
**Requirements**: ROUTE-01, ROUTE-02, DEBRIEF-01
**Success Criteria** (what must be TRUE):
  1. Navigating directly to `/game` with no loaded game state redirects to `/setup` — no blank screen, no auto-seeded DEV state
  2. The browser console is free of the "setState called during render" warning at `gameStore.ts:304` during normal facilitation use
  3. Round 1 facilitator input text in the downloaded debrief export starts with its actual first character — no "ound 1 is now live..." truncation

**Plans**: 1 plan

Plans:
- [ ] 11-01: Null-state redirect fix (ROUTE-01/02) and R1 input first-character strip fix (DEBRIEF-01)

---

#### Phase 12: Crisis State Prompt Engineering

**Goal**: The Finch persona reliably triggers crisis state auto-advance when severity thresholds are crossed, verified against the actual LLM
**Depends on**: Phase 8 (uses same LLM loop and system prompt machinery)
**Requirements**: PROMPT-01, PROMPT-02, PROMPT-03
**Success Criteria** (what must be TRUE):
  1. The system prompt includes an explicit, unambiguous transition rule telling Finch to advance `crisisState` when severity crosses the documented threshold
  2. Replaying the v1.0 Scenario 2 live run — specifically the turn where severity reached 4 — produces a response that includes the expected `crisisState` transition in its JSON output
  3. The transition rule is documented in the prompt engineering notes so future prompt edits preserve it

**Plans**: TBD (estimate 2–3 plans)

Plans:
- [ ] 12-01: Diagnose v1.0 system prompt — identify missing or ambiguous transition rule
- [ ] 12-02: Update system prompt with explicit crisisState transition rule
- [ ] 12-03: Empirical verification — replay Scenario 2 severity=4 trigger against real LLM

---

## Progress

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
| 11. Polish Bug Fixes | v1.1 | 0/1 | Not started | - |
| 12. Crisis State Prompt Engineering | v1.1 | 0/3 | Not started | - |
