# Requirements: War Game Engine

**Defined:** 2026-04-13
**Core Value:** Three AI personas respond in-character to facilitator input with accurate, live game state tracking

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Foundation

- [x] **FOUND-01**: TypeScript interfaces define all data models (GameConfig, GameState, TeamState, ChatMessage, PersonaResponse, LLMRequest/Response)
- [x] **FOUND-02**: EDIP game config exists as canonical hardcoded constant matching GameConfig interface (2 scenarios, 4 teams, 11 cards, 4 national actions)
- [x] **FOUND-03**: Zustand store manages all session state (app phase, game config, game state, chat messages, LLM history, UI state)
- [x] **FOUND-04**: Store initializes game from config + scenario index (team starting values, round 1, clear messages/history)
- [x] **FOUND-05**: Store resets cleanly when starting a new game

### LLM Proxy

- [x] **LLM-01**: FastAPI backend serves POST /api/llm endpoint that proxies requests to corporate OpenAI-compatible endpoint
- [x] **LLM-02**: API keys and LLM credentials are read from environment variables server-side, never sent to browser
- [x] **LLM-03**: LLM endpoint URL, API key, model name, max tokens, and extra headers are all configurable via .env
- [x] **LLM-04**: LLM proxy returns raw text response; JSON parsing happens client-side
- [x] **LLM-05**: LLM proxy returns meaningful error responses (status code + error text) on failure
- [x] **LLM-06**: FastAPI backend serves POST /api/generate-config endpoint for config generation from text brief

### Prompt Engineering

- [x] **PROMPT-01**: Prompt builder constructs system prompt from game config + live game state (10 required blocks: game context, live state, team identities, national actions, EDIP cards, key mechanics, persona definitions, routing rules, JSON format, absolute rules)
- [x] **PROMPT-02**: Three personas have distinct voice and constraints: Kent (structured, inclusive, question-led), Finch (precise, data-driven, consequential), Chen (grounding, procedurally rigorous, challenging)
- [x] **PROMPT-03**: Routing rules encoded in prompt determine which persona speaks for which trigger (round start, card play, national action, unique action, EO response, dispute, threshold warning, debrief)
- [x] **PROMPT-04**: LLM returns structured JSON with responses array containing speaker, message (2-4 sentences), stateUpdate (or null), and flag (or null)
- [x] **PROMPT-05**: Negative constraints prevent persona bleed (each persona defined by what they must NOT do)

### State Management

- [x] **STATE-01**: State updater applies LLM state deltas to game state with clamping (crisisSeverity 0-5, edipLegitimacy -2 to +2, PC 0-6, PO -2 to +2, readiness 0-5, stock/crm/ic 0-99)
- [x] **STATE-02**: Team updates match by team ID, not array index
- [x] **STATE-03**: Only changed fields are included in state updates; unchanged fields are omitted
- [x] **STATE-04**: Crisis state transitions are tracked (No Crisis -> Supply Crisis -> Security-Related Supply Crisis)

### Response Handling

- [x] **RESP-01**: Client-side JSON parsing strips markdown code fences before parsing
- [x] **RESP-02**: Defensive parsing handles malformed LLM responses gracefully (error message in chat, not session crash)
- [x] **RESP-03**: Parsed persona responses are added to chat as individual messages with correct speaker, colour, timestamp
- [x] **RESP-04**: State updates from parsed responses are applied to game state via state updater
- [x] **RESP-05**: Flag field (when not null) renders as amber facilitator-facing banner below the persona message

### Setup Screen

- [x] **SETUP-01**: Home screen offers two paths: "Load Config / EDIP Default" and "Generate from Brief"
- [x] **SETUP-02**: Load panel shows editable JSON textarea pre-loaded with EDIP config
- [x] **SETUP-03**: Valid JSON shows parsed summary with "Launch Scenario N" buttons for each scenario
- [ ] **SETUP-04**: Brief panel accepts free-text description and calls /api/generate-config to produce JSON config
- [ ] **SETUP-05**: Generated config goes to review mode (same as load panel, pre-populated)
- [x] **SETUP-06**: Invalid JSON shows clear validation error

### Game Layout

- [ ] **LAYOUT-01**: Three-column layout: StatePanel (left ~210px), ChatFeed (center flex), ReferencePanel (right ~252px)
- [ ] **LAYOUT-02**: GameHeader sticky top bar shows app wordmark, game name, scenario name, round counter, crisis state badge, new game button
- [ ] **LAYOUT-03**: FacilitatorInput bottom bar with text input (full width) + send button
- [ ] **LAYOUT-04**: Action buttons: "Advance to Round N" / "End Game + Debrief" and "Request Debrief Now"
- [ ] **LAYOUT-05**: Send on Enter (not Shift+Enter), disable input and buttons when loading

### Chat Feed

- [ ] **CHAT-01**: Chat feed renders messages in order, auto-scrolls to bottom on new messages
- [ ] **CHAT-02**: Persona messages show avatar (initials KV/AF/MC with persona colour), name, title, timestamp, tinted message bubble
- [ ] **CHAT-03**: Facilitator messages show right-aligned dark bubble with "FACILITATOR" label and timestamp
- [ ] **CHAT-04**: Round dividers show full-width horizontal rule with round label badge
- [ ] **CHAT-05**: Debrief divider shows amber-coloured variant
- [ ] **CHAT-06**: Error messages show red-tinted bubble
- [ ] **CHAT-07**: Loading indicator (animated dots) shows when waiting for LLM response

### State Dashboard

- [ ] **DASH-01**: Severity track bar (0-5, red) with numeric display
- [ ] **DASH-02**: Legitimacy track bar (-2 to +2, blue) with signed numeric display
- [ ] **DASH-03**: Four team cards each showing 3x2 resource grid (PC, PO, RDY, STK, CRM, IC) with colour-coded values
- [ ] **DASH-04**: PC warning badge on team cards: "STRAINED" (PC=1) amber, "CRISIS" (PC=0) red
- [ ] **DASH-05**: Track bar transitions animate (0.5s ease)
- [ ] **DASH-06**: Persona indicators (three coloured dots with names)

### Reference Panel

- [ ] **REF-01**: Three tabs: CARDS, ACTIONS, GUIDE
- [ ] **REF-02**: CARDS tab shows list view (card ID coloured by category, name, timing) with click-to-detail (ID, category badge, name, timing, requirements, effect)
- [ ] **REF-03**: ACTIONS tab shows National Actions section (4 cards with name, summary, cost) and Unique Team Powers section (4 entries with team letter, action text)
- [ ] **REF-04**: GUIDE tab shows Objective, Red Lines & PC Thresholds, Voting Rule, Resource Tokens, EO Response Mechanic, Facilitator Input Guide

### Game Flow

- [x] **FLOW-01**: Facilitator types event description, sends to LLM, receives persona responses
- [x] **FLOW-02**: "Advance to Round N" triggers round divider + LLM call with round inject, Finch delivers inject, Kent frames round
- [x] **FLOW-03**: "End Game + Debrief" triggers debrief divider + LLM debrief call, all three personas respond
- [x] **FLOW-04**: "Request Debrief Now" available mid-game for interim debrief
- [x] **FLOW-05**: New Game button navigates to setup, triggers store reset

### Debrief & Export

- [ ] **DEB-01**: Debrief export generates downloadable markdown report from chat messages
- [ ] **DEB-02**: Report includes game metadata (game name, scenario, date), all persona messages, state snapshots, debrief section
- [ ] **DEB-03**: Download triggers as file save (not new tab)

### UI Design

- [x] **UI-01**: Dark themed UI designed via Google Stitch, directional from spec
- [x] **UI-02**: Persona colour identity preserved: Kent=blue (#5B9BD5), Finch=amber (#DFA02A), Chen=green (#2BC48A)
- [x] **UI-03**: Three Google fonts loaded: Syne (display), DM Sans (body), IBM Plex Mono (data/monospace)
- [x] **UI-04**: Custom scrollbars (thin, subtle)
- [x] **UI-05**: Card category colours mapped (Crisis State=red, Monitoring=blue, Prioritisation Soft=amber, Prioritisation Hard=coral, Demand Coordination=green, Production Acceleration=teal, Transfers=purple)
- [x] **UI-06**: Responsive layout functional at 1280px+, usable on tablet
- [x] **UI-07**: Crisis state badge colours: No Crisis=green, Supply Crisis=amber, Security-Related=red

### Context Management

- [x] **CTX-01**: LLM history accumulates full session conversation for persona continuity
- [x] **CTX-02**: History windowing strategy prevents context overflow in long scenarios (5-round Scenario 2)
- [x] **CTX-03**: System prompt + history fit within corporate LLM context window

### Infrastructure

- [x] **INFRA-01**: .env.example file documents all required environment variables with descriptions
- [x] **INFRA-02**: FastAPI serves React/Vite dist/ build as static files for single-process production deployment
- [x] **INFRA-03**: Vite dev server proxies /api/* to FastAPI for local development (no CORS issues)
- [x] **INFRA-04**: Tailwind v4 CSS-first configuration with custom design tokens

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Enhanced Interaction

- **ENH-01**: Streaming LLM responses token-by-token (if corporate endpoint supports SSE)
- **ENH-02**: Keyboard shortcuts beyond Enter/Send (Escape to clear, Ctrl+Enter for advance round)
- **ENH-03**: Multiple simultaneous games in browser tabs

### Analytics

- **ANLY-01**: Session analytics dashboard (response times, token usage, persona distribution)
- **ANLY-02**: Game state timeline visualization (resource changes over rounds)

### Advanced Config

- **ACFG-01**: Visual config editor (form-based, not raw JSON)
- **ACFG-02**: Config validation with detailed error reporting per field
- **ACFG-03**: Config versioning and diff view

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Multi-user real-time collaboration | Single-facilitator use; adds WebSocket + auth complexity for zero value |
| User accounts / authentication | Corporate SSO handles this at network layer |
| Mobile-first design | Laptop facilitation tool; 1280px primary target |
| Persistent game history across sessions | Ephemeral by design; sensitive geopolitical content |
| Full game automation / AI-driven teams | AI assists humans, does not replace them |
| Player-facing views | Players are at a physical table, not screens |
| AI-generated images | Token cost + latency for no facilitation value |
| Drag-and-drop token simulation | Resources are numbers, not virtual tokens |
| LLM model selection in UI | Infrastructure decision via .env, not facilitator decision |
| Complex undo/redo | Facilitator corrects via subsequent input |
| Chat history persistence | Debrief export covers the legitimate use case |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 1 | Complete |
| FOUND-02 | Phase 1 | Complete |
| FOUND-03 | Phase 1 | Complete |
| FOUND-04 | Phase 1 | Complete |
| FOUND-05 | Phase 1 | Complete |
| LLM-01 | Phase 2 | Complete |
| LLM-02 | Phase 2 | Complete |
| LLM-03 | Phase 2 | Complete |
| LLM-04 | Phase 2 | Complete |
| LLM-05 | Phase 2 | Complete |
| LLM-06 | Phase 2 | Complete |
| PROMPT-01 | Phase 6 | Complete |
| PROMPT-02 | Phase 6 | Complete |
| PROMPT-03 | Phase 6 | Complete |
| PROMPT-04 | Phase 6 | Complete |
| PROMPT-05 | Phase 6 | Complete |
| STATE-01 | Phase 6 | Complete |
| STATE-02 | Phase 6 | Complete |
| STATE-03 | Phase 6 | Complete |
| STATE-04 | Phase 6 | Complete |
| RESP-01 | Phase 6 | Complete |
| RESP-02 | Phase 6 | Complete |
| RESP-03 | Phase 6 | Complete |
| RESP-04 | Phase 6 | Complete |
| RESP-05 | Phase 6 | Complete |
| SETUP-01 | Phase 4 | Complete |
| SETUP-02 | Phase 4 | Complete |
| SETUP-03 | Phase 4 | Complete |
| SETUP-04 | Phase 7 | Complete |
| SETUP-05 | Phase 7 | Complete |
| SETUP-06 | Phase 4 | Complete |
| LAYOUT-01 | Phase 5 | Complete |
| LAYOUT-02 | Phase 5 | Complete |
| LAYOUT-03 | Phase 5 | Complete |
| LAYOUT-04 | Phase 5 | Complete |
| LAYOUT-05 | Phase 5 | Complete |
| CHAT-01 | Phase 5 | Complete |
| CHAT-02 | Phase 5 | Complete |
| CHAT-03 | Phase 5 | Complete |
| CHAT-04 | Phase 5 | Complete |
| CHAT-05 | Phase 5 | Complete |
| CHAT-06 | Phase 5 | Complete |
| CHAT-07 | Phase 5 | Complete |
| DASH-01 | Phase 5 | Complete |
| DASH-02 | Phase 5 | Complete |
| DASH-03 | Phase 5 | Complete |
| DASH-04 | Phase 5 | Complete |
| DASH-05 | Phase 5 | Complete |
| DASH-06 | Phase 5 | Complete |
| REF-01 | Phase 5 | Complete |
| REF-02 | Phase 5 | Complete |
| REF-03 | Phase 5 | Complete |
| REF-04 | Phase 5 | Complete |
| FLOW-01 | Phase 6 | Complete |
| FLOW-02 | Phase 6 | Complete |
| FLOW-03 | Phase 6 | Complete |
| FLOW-04 | Phase 6 | Complete |
| FLOW-05 | Phase 6 | Complete |
| DEB-01 | Phase 7 | Complete |
| DEB-02 | Phase 7 | Complete |
| DEB-03 | Phase 7 | Complete |
| UI-01 | Phase 3 | Complete |
| UI-02 | Phase 3 | Complete |
| UI-03 | Phase 3 | Complete |
| UI-04 | Phase 3 | Complete |
| UI-05 | Phase 3 | Complete |
| UI-06 | Phase 3 | Complete |
| UI-07 | Phase 3 | Complete |
| CTX-01 | Phase 6 | Complete |
| CTX-02 | Phase 6 | Complete |
| CTX-03 | Phase 6 | Complete |
| INFRA-01 | Phase 1 | Complete |
| INFRA-02 | Phase 2 | Complete |
| INFRA-03 | Phase 1 | Complete |
| INFRA-04 | Phase 1 | Complete |

**Coverage:**
- v1 requirements: 75 total
- Mapped to phases: 75
- Unmapped: 0

**Phase breakdown:**
- Phase 1 (Foundation): FOUND-01..05, INFRA-01, INFRA-03, INFRA-04 — 8 requirements
- Phase 2 (FastAPI Backend): LLM-01..06, INFRA-02 — 7 requirements
- Phase 3 (UI Design System): UI-01..07 — 7 requirements
- Phase 4 (Setup Screen): SETUP-01..03, SETUP-06 — 4 requirements
- Phase 5 (Game Screen Layout): LAYOUT-01..05, CHAT-01..07, DASH-01..06, REF-01..04 — 22 requirements
- Phase 6 (LLM Integration): PROMPT-01..05, STATE-01..04, RESP-01..05, FLOW-01..05, CTX-01..03 — 22 requirements
- Phase 7 (Debrief, Export & Config Generation): DEB-01..03, SETUP-04..05 — 5 requirements
- Phase 8 (QA & Credential Audit): 0 new requirements (validates all prior phases)

---
*Requirements defined: 2026-04-13*
*Last updated: 2026-04-13 — traceability populated after roadmap creation*
