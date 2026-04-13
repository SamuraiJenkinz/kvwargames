# Roadmap: War Game Engine

## Overview

Build a three-persona AI facilitation console for live policy tabletop exercises. The dependency chain is strict: TypeScript contracts and Zustand store must be stable before any other layer is built. The backend is a thin credential proxy; all domain complexity lives in the React frontend. The LLM integration phase (Phase 6) is the highest-risk phase and must receive the most implementation time — context windowing, defensive JSON parsing, and state clamping correctness are architectural decisions made here, not retrofitted later. Config generation from a text brief is deliberately deferred to Phase 7 because its prompt-engineering risk is independent of the core game loop.

## Phases

**Phase Numbering:**
- Integer phases (1–8): Planned milestone work
- Decimal phases (N.N): Urgent insertions via `/gsd:insert-phase`

- [x] **Phase 1: Foundation** — TypeScript interfaces, EDIP data constant, Zustand store, dev scaffolding
- [x] **Phase 2: FastAPI Backend** — Credential proxy, both LLM endpoints, static file serving
- [ ] **Phase 3: UI Design System** — Google Stitch design, Tailwind v4 tokens, persona colours, fonts
- [ ] **Phase 4: Setup Screen** — Home, load config, JSON validation, scenario launch (brief gen stubbed)
- [ ] **Phase 5: Game Screen Layout** — Three-column layout, chat feed, state dashboard, reference panel (all mock data)
- [ ] **Phase 6: LLM Integration** — Prompt builder, persona routing, state updater, response handling, context windowing (highest risk)
- [ ] **Phase 7: Debrief, Export & Config Generation** — Markdown debrief export, wire generate-from-brief to backend
- [ ] **Phase 8: QA & Credential Audit** — Full 5-round scenario run, credential audit, boundary value testing

## Phase Details

### Phase 1: Foundation
**Goal**: All TypeScript data contracts, EDIP game data, and Zustand store exist and are stable — every subsequent layer can build against them without rework.
**Depends on**: Nothing (first phase)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05, INFRA-01, INFRA-03, INFRA-04
**Success Criteria** (what must be TRUE when this phase completes):
  1. TypeScript interfaces for GameConfig, GameState, TeamState, ChatMessage, PersonaResponse, LLMRequest, and LLMStructuredResponse compile with zero errors
  2. EDIP game config constant passes runtime validation against the GameConfig interface (2 scenarios, 4 teams, 11 cards, 4 national actions)
  3. Zustand store initializes a game from the EDIP config and a scenario index — team resources, round, and message history are all in expected starting state
  4. Store resets cleanly: a second `initGame` call from a different scenario produces correct fresh state with no residue from the first
  5. `vite.config.ts` proxy routes `/api/*` to FastAPI dev server with zero CORS errors; `.env.example` documents all required environment variables
**Plans:** 3 plans

Plans:
- [x] 01-01-PLAN.md — Scaffold Vite/React/TS project, all config, Tailwind v4 tokens, TypeScript interfaces
- [x] 01-02-PLAN.md — EDIP canonical game config constant with validation tests
- [x] 01-03-PLAN.md — Zustand store with all state slices, actions, and comprehensive tests

### Phase 2: FastAPI Backend
**Goal**: The credential proxy backend is running, tested with curl, and ready for the frontend to wire against — LLM API keys never leave the server.
**Depends on**: Phase 1 (Pydantic models derived from TypeScript interfaces)
**Requirements**: LLM-01, LLM-02, LLM-03, LLM-04, LLM-05, LLM-06, INFRA-02
**Success Criteria** (what must be TRUE when this phase completes):
  1. `POST /api/llm` accepts a request with `systemPrompt`, `messages`, and `maxTokens`; forwards to corporate endpoint with credentials injected from environment; returns `{text: string}` — no API key appears in any browser network tab
  2. `POST /api/generate-config` accepts a text brief and returns a raw LLM text response (JSON parsing happens client-side)
  3. All LLM connection parameters (endpoint URL, API key, model, max tokens, extra headers) are configurable exclusively via `.env` — changing them requires no code change
  4. A missing or wrong API key returns a meaningful error with status code and descriptive text, not an unhandled 500
  5. FastAPI serves the React `dist/` build as static files — navigating to `http://localhost:8000` in production serves the SPA
**Plans**: TBD

Plans:
- [x] 02-01: FastAPI project structure, settings (`config.py` with pydantic-settings), main application entry point
- [x] 02-02: LLM proxy router (`routers/llm.py`) — `/api/llm` endpoint with httpx async client
- [x] 02-03: Config generation router (`routers/config_gen.py`) — `/api/generate-config` endpoint
- [x] 02-04: Static file serving, error handling, `.env.example` backend section, curl integration test

### Phase 3: UI Design System
**Goal**: The design system is defined in Tailwind v4 CSS tokens and validated in a component reference — all subsequent phases build against a coherent visual language without guessing hex values or font names.
**Depends on**: Phase 1 (Tailwind v4 configured in Phase 1 scaffolding)
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07
**Success Criteria** (what must be TRUE when this phase completes):
  1. Google Stitch has produced a dark-themed layout reference directional from the spec; design tokens (colours, fonts, spacing) are extracted and committed
  2. Tailwind v4 `@theme {}` block defines all custom tokens: persona colours (Kent blue #5B9BD5, Finch amber #DFA02A, Chen green #2BC48A), card category colours, crisis badge colours, and all three font families
  3. A rendered component reference page shows all token-dependent primitives — persona colour swatches, crisis state badges, card category colour chips — all resolving from Tailwind tokens, not hardcoded values
  4. Custom scrollbars (thin, subtle) are applied globally
  5. Layout renders at 1280px without horizontal scroll; a 768px browser viewport is usable (no overlap or cut-off content)
**Plans**: TBD

Plans:
- [ ] 03-01: Google Stitch session — generate dark-themed game layout screens directional from spec; extract design tokens
- [ ] 03-02: Tailwind v4 `@theme {}` token block — all colours, fonts (Syne, DM Sans, IBM Plex Mono), custom scrollbars
- [ ] 03-03: Primitive component reference — StatusBadge, TrackBar shell, persona colour chips, category colour chips
- [ ] 03-04: Responsive breakpoint validation — 1280px and 768px visual review

### Phase 4: Setup Screen
**Goal**: A facilitator can load the EDIP default config, review the JSON, select a scenario, and launch into the game — the complete pre-game flow works end-to-end without a running LLM.
**Depends on**: Phase 1 (store, EDIP config), Phase 3 (design system)
**Requirements**: SETUP-01, SETUP-02, SETUP-03, SETUP-06
**Success Criteria** (what must be TRUE when this phase completes):
  1. The home screen presents two paths: "Load Config / EDIP Default" and "Generate from Brief" (brief generation is visibly stubbed, not hidden)
  2. The Load Config panel opens with the EDIP JSON pre-populated; the JSON is editable and the parsed summary updates live
  3. Valid EDIP JSON shows scenario selection with "Launch Scenario 1" and "Launch Scenario 2" buttons; clicking one initialises the store and navigates to the game screen
  4. Pasting malformed JSON shows a clear inline validation error; the Launch buttons are disabled until the JSON is valid again
  5. Navigating directly to `/game` without having launched a scenario redirects to the setup screen (null gameState guard)
**Plans**: TBD

Plans:
- [ ] 04-01: Router setup, app shell, `AppPhase` navigation (setup / game screens)
- [ ] 04-02: Home screen — two-path landing with stubbed "Generate from Brief" panel
- [ ] 04-03: Load Config panel — JSON textarea, live parse, scenario summary, Launch buttons
- [ ] 04-04: JSON validation error states, null gameState guard for `/game` route

### Phase 5: Game Screen Layout
**Goal**: The complete three-column game interface renders correctly against mock data — every visual component, message type, and interactive element is built and styled before any real LLM is wired in.
**Depends on**: Phase 1 (store), Phase 3 (design system), Phase 4 (app navigation shell)
**Requirements**: LAYOUT-01, LAYOUT-02, LAYOUT-03, LAYOUT-04, LAYOUT-05, CHAT-01, CHAT-02, CHAT-03, CHAT-04, CHAT-05, CHAT-06, CHAT-07, DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06, REF-01, REF-02, REF-03, REF-04
**Success Criteria** (what must be TRUE when this phase completes):
  1. The game screen shows three columns at 1280px: StatePanel fixed left (~210px), ChatFeed flexible center, ReferencePanel fixed right (~252px); GameHeader sticks to top; FacilitatorInput sticks to bottom
  2. All seven chat message types render correctly from mock data: Kent/Finch/Chen persona bubbles (correct avatar initials, colours, tinted bubble), facilitator bubble (right-aligned), round divider, debrief divider (amber), error bubble (red), loading indicator (animated dots)
  3. StatePanel shows severity track bar (0–5 red), legitimacy track bar (−2 to +2 blue), four team resource grids (PC, PO, RDY, STK, CRM, IC), PC warning badges ("STRAINED" amber, "CRISIS" red), persona indicator dots, and track bar animations — all driven by mock Zustand state
  4. ReferencePanel CARDS tab shows list with category colours; clicking a card shows full detail. ACTIONS tab shows 4 national actions and 4 unique team powers. GUIDE tab shows all six guide sections.
  5. FacilitatorInput send button and action buttons are present and wired to store stub actions; Enter submits; input and buttons disable during a loading state
**Plans**: TBD

Plans:
- [ ] 05-01: GameScreen shell — three-column layout, GameHeader, mock data injection into store
- [ ] 05-02: ChatFeed component — all seven message types, auto-scroll behaviour
- [ ] 05-03: StatePanel — TrackBar (severity + legitimacy), team resource grid cards, PC warning badges, persona dots, animations
- [ ] 05-04: ReferencePanel — three-tab shell, CARDS list + detail view, ACTIONS section
- [ ] 05-05: ReferencePanel GUIDE tab, FacilitatorInput bar — action buttons, Enter-to-send, loading disable state

### Phase 6: LLM Integration
**Goal**: The facilitator can type an event, press Enter, and receive in-character persona responses that update the live game state — the complete LLM loop is hardened against JSON parse failures, context overflow, out-of-range state values, and credential leakage.
**Depends on**: Phase 1 (store, types), Phase 2 (backend running), Phase 5 (game screen UI)
**Requirements**: PROMPT-01, PROMPT-02, PROMPT-03, PROMPT-04, PROMPT-05, STATE-01, STATE-02, STATE-03, STATE-04, RESP-01, RESP-02, RESP-03, RESP-04, RESP-05, FLOW-01, FLOW-02, FLOW-03, FLOW-04, FLOW-05, CTX-01, CTX-02, CTX-03
**Success Criteria** (what must be TRUE when this phase completes):
  1. Typing a facilitator message and pressing Enter produces 1–3 in-character persona responses in the chat feed within the corporate LLM timeout window; each response is visually attributed to the correct persona with correct colour
  2. Persona routing is correct: round-start triggers Kent framing + Finch inject; card play triggers the card-relevant persona; debrief triggers all three — verified across at least three distinct trigger types
  3. LLM state deltas are applied to the StatePanel with correct clamping — a response that pushes crisisSeverity above 5 or edipLegitimacy outside −2/+2 is silently clamped, not rejected or crashed
  4. A malformed or truncated LLM JSON response produces a red error bubble in the chat feed; the session state is intact and the facilitator can send the next message without refreshing
  5. After 4+ rounds of a live scenario, the system prompt + windowed history stays within the model's context window — persona voice and JSON format hold for Round 4 and beyond; `llmHistory.length` never exceeds 2×N+1 entries
**Plans**: TBD

Plans:
- [ ] 06-01: `promptBuilder.ts` — full 10-block system prompt construction from live GameConfig + GameState
- [ ] 06-02: Persona definitions, routing rules, negative constraints, JSON output schema in prompt
- [ ] 06-03: `llmClient.ts` — fetch to `/api/llm`, markdown fence stripping, defensive JSON parse, error bubble on failure, AbortController timeout
- [ ] 06-04: `stateUpdater.ts` — all fields clamped with explicit bounds, null/undefined = no-op, team match by ID
- [ ] 06-05: Wire FacilitatorInput → llmClient → stateUpdater → store; round advance action; debrief trigger; FLOW-01..05
- [ ] 06-06: Context windowing — `CTX-02` windowed history (N=6 message pairs), token budget measurement, `CTX-03` validation

### Phase 7: Debrief, Export & Config Generation
**Goal**: The session ends with a downloadable debrief artifact, and a facilitator can generate a game config from a plain-text brief — completing the two remaining user-facing workflows.
**Depends on**: Phase 6 (LLM integration, `/api/generate-config` backend endpoint from Phase 2)
**Requirements**: DEB-01, DEB-02, DEB-03, SETUP-04, SETUP-05
**Success Criteria** (what must be TRUE when this phase completes):
  1. Clicking "End Game + Debrief" or triggering a debrief produces a "Download Debrief" button; clicking it saves a `.md` file to the user's machine (not a new browser tab)
  2. The downloaded markdown report includes game metadata (name, scenario, date), all persona messages with speaker attribution, state snapshots at round boundaries, and the debrief section
  3. The "Generate from Brief" path on the setup screen accepts free text, calls `/api/generate-config`, returns JSON to the review panel pre-populated, and the facilitator can launch from that generated config
  4. A generated config that fails JSON schema validation shows a specific field-level error, not a generic "invalid JSON" message
**Plans**: TBD

Plans:
- [ ] 07-01: `debriefExporter.ts` — collect all debrief messages, format markdown report, browser file download
- [ ] 07-02: Wire debrief export button to exporter; DEB-01..03 end-to-end test
- [ ] 07-03: GenerateBriefPanel wired to `/api/generate-config` — loading state, error handling, result piped to review mode
- [ ] 07-04: Generated config schema validation with field-level error messages (SETUP-04, SETUP-05)

### Phase 8: QA & Credential Audit
**Goal**: The tool survives a full 5-round live scenario without context degradation, persona drift, or credential leakage — confirmed by structured tests, not assumption.
**Depends on**: Phase 7 (all features complete)
**Requirements**: (No new requirements — validates all prior phases against production-grade conditions)
**Success Criteria** (what must be TRUE when this phase completes):
  1. A full Scenario 2 run (5 rounds, maximum history depth) completes with correct persona voice, valid JSON structure, and accurate state values in Round 4 and Round 5 — no persona bleed, no JSON truncation
  2. DevTools Network tab confirms zero `Authorization` header on any browser-originated request — credentials travel only server-to-LLM
  3. Injecting a malformed LLM response (manually patched backend response) produces a red error bubble; the session continues; the next facilitator message produces a valid response
  4. `stateUpdater` unit tests pass for all boundary values: crisisSeverity 0/5/6, edipLegitimacy −2/+2/+3, PC 0/6/7, PO −2/+2, readiness 0/5, all treating null/undefined as no-op
  5. A simultaneous multi-trigger input (round-start + card play + dispute in one message) routes to the correct personas without overlap or duplicate state updates
**Plans**: TBD

Plans:
- [ ] 08-01: `stateUpdater` unit test suite — all fields, all boundary values, null/undefined no-op cases
- [ ] 08-02: Full 5-round Scenario 2 live run — persona voice check, JSON format check, context window validation
- [ ] 08-03: Credential audit — DevTools Network review, confirm no client-side LLM headers
- [ ] 08-04: Error injection tests — malformed JSON response, timeout, missing env var startup behaviour
- [ ] 08-05: Multi-trigger input test, persona routing edge cases, debrief export end-to-end artifact review

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/3 | ✓ Verified | 2026-04-13 |
| 2. FastAPI Backend | 4/4 | ✓ Verified | 2026-04-13 |
| 3. UI Design System | 0/4 | Not started | - |
| 4. Setup Screen | 0/4 | Not started | - |
| 5. Game Screen Layout | 0/5 | Not started | - |
| 6. LLM Integration | 0/6 | Not started | - |
| 7. Debrief, Export & Config Generation | 0/4 | Not started | - |
| 8. QA & Credential Audit | 0/5 | Not started | - |
