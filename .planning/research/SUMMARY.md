# Project Research Summary

**Project:** KV War Game Engine
**Domain:** AI-powered policy tabletop exercise facilitation tool
**Researched:** 2026-04-13
**Confidence:** HIGH

## Executive Summary

The KV War Game Engine is a single-facilitator facilitation tool that uses a three-persona LLM system to run structured policy exercises. It is not a chatbot, not a traditional game engine, and not a multi-user collaboration platform. The correct mental model is a purpose-built facilitator console that uses a corporate GPT-4o/5 endpoint to voice three specialist personas (Kent, Finch, Chen) who react to live facilitator input, update a shared game state, and produce a structured debrief at session end. The recommended implementation is a thin FastAPI backend (credential proxy only) fronting a React/Vite SPA that holds all game logic, state, and persona routing in the browser. The architecture is intentionally lopsided: the backend has two endpoints and zero game logic; the frontend carries the entire domain.

The stack is well-suited and low-risk. FastAPI 0.135.x + Pydantic v2 + httpx covers the backend in roughly 150 lines of code. React 19 + Zustand 5 + Tailwind v4 covers the frontend. No database, no auth layer, no WebSockets, no queues -- all explicitly out of scope and must stay out of scope. The LLM proxy pattern (frontend sends `{systemPrompt, messages, maxTokens}`; backend injects credentials and forwards) is the single most important architectural decision and is already well-specified. The primary technical risk is not the stack -- it is the LLM integration layer: JSON parsing robustness, context window accumulation, persona drift, and state clamping correctness. All four can silently break a live facilitation session and all four require deliberate hardening, not optimistic happy-path implementation.

The recommended build order follows a strict dependency chain: TypeScript interfaces first (everything else depends on them), then Zustand store, then UI layout with mock data, then backend + LLM integration with hardened error handling, then polish and debrief export. Config generation from a text brief should be treated as a Phase 5 feature -- it has high prompt-engineering risk and the EDIP default config covers the launch use case without it. A full 5-round scenario QA run against real LLM credentials must precede any live exercise use; this is the only way to surface context accumulation and persona drift failures.

---

## Key Findings

### Recommended Stack

The stack is entirely predetermined by the project spec and confirmed by research. FastAPI 0.135.x is the current stable with built-in async, OpenAPI, and Pydantic-native validation -- ideal for a two-endpoint credential proxy. The LLM call uses `httpx.AsyncClient` rather than the OpenAI SDK because the corporate endpoint requires custom headers (`LLM_EXTRA_HEADERS`) that the SDK opinionates against. On the frontend, React 19 + Vite 6 + Zustand 5 + Tailwind v4 is the current stable combination. The only non-obvious version decisions are Tailwind v4 (CSS-first config via `@theme {}` -- no `tailwind.config.js`) and Zustand 5 (named exports -- `import { create } from 'zustand'`, not default import). Explicit do-not-use list: no SQLAlchemy, no Redis/Celery, no WebSockets, no React Query, no Docker for dev, no JWT/auth inside the app.

**Core technologies:**
- Python 3.11+ / FastAPI 0.135.x: async credential proxy -- async-native, minimal surface area, serves Vite build as static files
- Pydantic v2.9+ / pydantic-settings: request validation and typed env var management -- required by FastAPI 0.135.2+
- httpx 0.27+: async LLM proxy client -- FastAPI transitive dep, supports custom headers, non-blocking
- React 19 / TypeScript 5 / Vite 6: SPA runtime -- current stable, fast HMR, clean SPA build for FastAPI to serve
- Zustand 5: game state store -- flat store pattern matches GameStore shape, no boilerplate, session-only (no persistence needed)
- Tailwind CSS v4 + @tailwindcss/vite: utility styling -- CSS-first `@theme {}` supports the custom design token system (Syne, DM Sans, IBM Plex Mono)

### Expected Features

The feature landscape has unusually high confidence because the authoritative spec (`WARGAME_ENGINE_DEV_SPEC.md`) defines scope precisely. There are no discovery-phase unknowns about what the product needs to do.

**Must have (table stakes -- MVP blocking):**
- Three-column game layout (state panel, chat feed, reference panel) -- the product's primary visual contract
- Three visually distinct AI personas with routing logic -- if voices look or sound identical, the value proposition collapses
- Live game state dashboard (crisis severity track, EDIP legitimacy track, four team resource grids) -- facilitator situational awareness
- Round counter and round advancement with inject delivery -- primary temporal anchor for the exercise
- Facilitator input handler producing persona responses -- the core interaction loop
- Structured JSON state updates applied to live game state -- closes the loop between AI narrative and game mechanics
- Reference panel (CARDS / ACTIONS / GUIDE tabs) -- facilitators cannot memorise 11 cards
- Debrief trigger and markdown export -- the client deliverable; sessions without exports produce no artifact
- LLM proxy with credentials server-side only -- non-negotiable security requirement
- Error states visible in chat feed, not silent -- LLM calls fail; silence is worse than a visible error

**Should have (differentiators -- post-MVP):**
- Persona flag banners (amber warnings from LLM `flag` field) -- procedural warnings without breaking persona voice
- PC threshold warning badges (STRAINED/CRISIS) -- prevents facilitators missing a strained team state
- Config generation from text brief -- high facilitation value but high prompt-engineering risk
- Keyboard shortcuts (Enter to send, Escape to clear) -- polish for experienced facilitators

**Defer (post-MVP):**
- Config generation from text brief -- complex to prompt-engineer reliably; EDIP config covers the launch case
- Responsive tablet layout -- primary target is 1280px laptop
- Config JSON editing in review mode -- load-only is sufficient for MVP

**Hard anti-features (never build):**
- Multi-user real-time collaboration, persistent session history, user accounts
- Streaming token-by-token LLM responses
- Player-facing views or mobile-first layout
- LLM model selection in the UI

### Architecture Approach

The architecture is a thin-backend, fat-client pattern with a strict security boundary. The FastAPI backend is a pure credential-protecting proxy -- it reads `LLM_API_KEY` from environment, validates the request shape via Pydantic, forwards to the corporate OpenAI-compatible endpoint via httpx, and returns raw `{text: str}`. It has zero game logic and zero state. All domain complexity lives in the React frontend: `promptBuilder.ts` assembles the full system prompt on every LLM call (including serialized live `GameState`), `stateUpdater.ts` applies clamped state deltas, and the Zustand store holds the entire session. `LLMStructuredResponse` is parsed client-side so JSON errors surface gracefully in the chat feed rather than as backend 500s.

**Major components:**
1. FastAPI backend (`routers/llm.py`, `routers/config_gen.py`) -- credential proxy; two POST endpoints; stateless
2. Zustand store (`src/lib/gameStore.ts`) -- single source of truth for phase, gameConfig, gameState, messages, llmHistory, UI state
3. `promptBuilder.ts` -- rebuilds full system prompt on every call; encodes game engine, routing rules, live state, JSON output schema
4. `stateUpdater.ts` -- applies LLM state deltas with hard clamping; all valid bounds enforced here; null/undefined = no-op
5. `llmClient.ts` -- fetch wrapper to `/api/llm`; strips markdown fences; parses JSON with try/catch; produces error chat messages on failure
6. GameScreen components -- three-column layout shell composing StatePanel, ChatFeed, ReferencePanel, FacilitatorInput
7. Shared primitives -- TrackBar, StatusBadge, LoadingDots

**Key patterns to follow:**
- Thin backend, fat client: prompt engineering, persona routing, and state management belong in the frontend
- Prompt-as-configuration: system prompt is the game engine; loading a new `GameConfig` changes the game without code deployment
- Optimistic message append: facilitator message displays immediately; loading dots during LLM call
- Single LLM history thread: one flat `llmHistory[]` for all personas sharing context; setup config gen uses separate stateless call
- Clamped state application: `applyStateUpdate` enforces hard bounds before writing to store

### Critical Pitfalls

1. **Undefended LLM JSON parsing (C-1)** -- A single malformed LLM response crashes the session and destroys ephemeral state. Wrap all `JSON.parse` in try/catch that produces an error chat message. Validate parsed structure before applying. Set `maxTokens` at 1500+ to prevent truncation mid-JSON. Must be hardened in Phase 4 before any live testing.

2. **Context window accumulation (C-3)** -- Full `llmHistory` passed on every call. By Round 4, conversation history plus 3,000-4,000 token system prompt saturates most context windows. Late-game personas lose character, JSON format breaks, and the debrief degrades. Implement windowed history (keep last N=6 message pairs). This is a Phase 4 design decision, not a Phase 5 fix.

3. **State clamping gaps (C-2)** -- LLM returns out-of-range values; without clamping, track bars overflow and crisis state logic corrupts. Clamp ALL numeric fields in `applyStateUpdate`. Treat `null`/`undefined` as "no change", not 0. Unit test with boundary values for every field including `edipLegitimacy` (-2/+2) and `po` (-2/+2).

4. **Persona drift (C-4)** -- After several rounds the LLM bleeds persona roles: Kent quotes numbers, Chen facilitates, multiple personas produce conflicting `stateUpdate`. Add explicit negative constraints per persona in system prompt. Document state update precedence rules (Finch owns crisisSeverity; Chen owns card corrections). Test with multi-trigger inputs in Phase 6.

5. **Credentials in browser (C-5)** -- Any `VITE_LLM_API_KEY` or direct client-side fetch to the LLM endpoint is a corporate audit failure. First QA step (not last): DevTools > Network > confirm no Authorization header on browser-originated requests.

---

## Implications for Roadmap

Based on the dependency graph from ARCHITECTURE.md and the MVP scope from FEATURES.md, the natural phase structure is six phases. The constraint is hard: TypeScript interfaces must be finalized before anything else; changing types after Phase 1 causes cascading rework. The LLM integration layer (Phase 4) is the highest-risk phase and must receive the most implementation time.

### Phase 1: Foundation -- Types, Data, and Store

**Rationale:** `src/types/game.ts` and `src/types/llm.ts` are the contract between all layers. Every component, lib file, and Pydantic model depends on them. They must be stable before any other work begins. Zero dependencies, zero risk -- produces no UI but unblocks everything.
**Delivers:** TypeScript interfaces (GameConfig, GameState, TeamState, ChatMessage, LLMRequest, LLMStructuredResponse, PersonaResponse, StateUpdate), EDIP config constant, Zustand store with all state slices and actions.
**Addresses:** P0 foundational work
**Avoids:** Cascading type rework later; make clamping treat `undefined` as "no change" explicit in type definitions from the start
**Research flag:** Skip -- standard TypeScript + Zustand patterns, well-documented

### Phase 2: Setup Screen

**Rationale:** Can be built and fully tested without a running backend. Uses the EDIP config constant from Phase 1. Validates config loading and parsing before the game screen depends on them.
**Delivers:** Setup flow -- Home, Load Config (JSON textarea with parse validation), Generate Brief (stubbed), Scenario selection, Launch to game. Null gameState guard (redirect to `/setup` before game screen renders).
**Addresses:** P2 features: config loading, scenario selection
**Avoids:** M-5 (null gameState crash on direct `/game` URL navigation), Phase-2 pitfall (JSON validation before enabling Launch button)
**Research flag:** Skip -- standard React form + JSON validation patterns

### Phase 3: Game Screen Layout (Mock Data)

**Rationale:** The three-column layout, persona message rendering, track bars, and reference panel can all be built and styled against mock data injected into the Zustand store. Decouples visual development from LLM integration. This is where the Google Stitch design system is implemented.
**Delivers:** Full GameScreen with GameHeader (round counter, crisis badge), StatePanel (TrackBar for severity/legitimacy, team resource grids), ChatFeed (all message types, persona colours, loading dots, smart auto-scroll), ReferencePanel (CARDS/ACTIONS/GUIDE tabs, card detail drill-down), FacilitatorInput (buttons wired to store actions, LLM call stubbed).
**Addresses:** P0 features: three-column layout, persona message rendering, state dashboard, reference panel
**Avoids:** Mi-1 (smart auto-scroll -- only snap to bottom if already at bottom or message just sent), Phase-3 pitfall (legitimacy -2/+2 bar rendering unit tested for all five states)
**Research flag:** Skip -- standard React component + Tailwind patterns; design tokens defined in STACK.md

### Phase 4: Backend + LLM Integration (Highest Risk)

**Rationale:** Core value delivery phase and highest-risk phase. Backend can be built and tested with curl independently before wiring to frontend. The three hardening decisions -- windowed history, defensive JSON parsing, clamped state application -- must be made here, not retrofitted later. Rushing this phase produces a tool that works in demos but fails in live exercises.
**Delivers:** Full FastAPI backend (main.py, config.py, routers/llm.py, routers/config_gen.py, Pydantic models). Frontend: promptBuilder.ts (full system prompt with persona routing, live state injection, JSON output schema), llmClient.ts (defensive JSON parse, error message production, AbortController timeout), stateUpdater.ts (all fields clamped, null/undefined = no-op), FacilitatorInput wired to real LLM flow, round start auto-trigger, advance round action.
**Addresses:** P0/P1 features: LLM proxy, prompt builder, persona routing, state updates, round advancement with inject delivery, facilitator input handler
**Avoids:** C-1 (defensive JSON parsing), C-2 (all fields clamped with unit tests), C-3 (windowed history design decision made before wiring), C-4 (negative persona constraints in system prompt), C-5 (credentials never in browser), M-2 (AbortController timeout + retry UX), M-3 (buildSystemPrompt called fresh on every invocation), Phase-4 pitfall (corporate endpoint response structure -- make extraction path configurable)
**Research flag:** Needs prompt engineering iteration against real LLM credentials. Windowed history N needs token budget measurement. Corporate endpoint response structure must be verified before hardcoding extraction path.

### Phase 5: Polish, Debrief Export, and Config Generation

**Rationale:** Completes the MVP with the session-closing deliverable (debrief export), adds UX polish that reduces facilitator friction in live sessions, and implements config generation in a controlled way.
**Delivers:** debriefExporter.ts (all `isDebrief: true` messages across session, markdown format, browser download), PC threshold warning badges (STRAINED/CRISIS on team cards), error states in ChatFeed with retry support, GenerateBriefPanel wired to real `/api/generate-config`, generated config schema validation with specific field error messages, elapsed time under loading spinner after 5s, keyboard shortcuts.
**Addresses:** P1 features: debrief export; P2: PC warning badges, error states; P3: config generation
**Avoids:** Mi-4 (debrief export collects all `isDebrief: true` across full session, not just latest segment), M-4 (schema validation on generated config), Mi-5 (startup validation for missing env vars)
**Research flag:** Config generation prompt engineering needs iteration; test with 3 brief types (cyber, logistics, political crisis) to establish reliability threshold

### Phase 6: QA and Credential Audit

**Rationale:** The only way to surface context accumulation failures, persona drift in multi-trigger scenarios, and late-game JSON degradation is a full end-to-end scenario run against real LLM credentials. This is functional validation, not optional polish.
**Delivers:** Full 5-round Scenario 2 run (longest scenario, guaranteed to expose context limits), multi-trigger input test (simultaneous round-start + card + dispute), credential audit (DevTools Network confirms zero Authorization header on browser requests), stateUpdater unit test suite (boundary values for all fields), history window verification (`llmHistory.length` never exceeds 2xN+1 entries), error injection tests (malformed LLM response, timeout, missing env var).
**Addresses:** All "Looks Done But Isn't" checklist items from PITFALLS.md
**Research flag:** Skip -- execution phase, not research

### Phase Ordering Rationale

- Types before everything: cascade rework cost of changing `GameState` after Phase 1 is high; the lock-in is intentional and necessary
- UI before backend (Phases 2-3): all frontend visual work can proceed against mock data; enables parallel development and early design review
- Backend + integration together in Phase 4: build both and wire once rather than stub-then-real requiring two integration rounds
- Hardening decisions in Phase 4 not Phase 5: windowed history, defensive parsing, and clamping are architectural decisions that get expensive to retrofit
- Config generation last: differentiator but not MVP-blocking; its prompt engineering is independent of the core game loop

### Research Flags

**Phases needing deeper research or iteration during planning:**

- **Phase 4:** Prompt engineering for persona routing, JSON output schema enforcement, and windowed history token budgeting requires iteration against the target corporate LLM. The routing table needs empirical testing, not just spec-reading. Corporate endpoint response structure may deviate from standard OpenAI format -- verify before hardcoding the extraction path.
- **Phase 5:** Config generation prompt needs testing against multiple brief types to establish reliability threshold. A generated config that passes JSON schema validation but has semantically wrong game design (contradictory voting rules) is harder to catch automatically.

**Phases with standard patterns (skip research-phase):**
- **Phases 1, 2, 3:** TypeScript interfaces, Zustand store, React component layout -- well-documented, low ambiguity
- **Phase 6:** QA execution -- test plan follows directly from pitfall checklist

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | FastAPI 0.135.x, Pydantic 2.9+, React 19, Tailwind v4 all verified against official sources. Zustand 5 and Vite 6 confirmed via transitive documentation references. |
| Features | HIGH | Derived from authoritative WARGAME_ENGINE_DEV_SPEC.md. No competitor product research available (WebSearch unavailable) but irrelevant -- product scope is defined, not discovered. |
| Architecture | HIGH | Derived from spec + FastAPI official docs. Thin-backend pattern, Vite proxy, static file serving, CORS config all verified. |
| Pitfalls | HIGH | LLM JSON parsing failures, context accumulation, and state clamping are well-established production LLM integration failure modes confirmed by multiple sources. |

**Overall confidence:** HIGH

### Gaps to Address

- **Corporate LLM response structure:** The corporate endpoint may return a non-standard response envelope (`result.output` instead of `choices[0].message.content`). Make the response field extraction path configurable in `config.py` (e.g., `LLM_RESPONSE_PATH` env var). Verify against actual endpoint before Phase 4 completion.
- **Token budget for system prompt:** Estimated at 3,000-4,000 tokens but depends on actual EDIP config card count. Measure the actual prompt token count before choosing windowed history window size N, to ensure system prompt + N history entries stays within the model's practical context window.
- **Corporate network timeout:** PITFALLS.md flags a 30-second corporate proxy timeout against 25-35 second LLM generation times. The recommended AbortController timeout of 45 seconds is a starting point -- verify the actual corporate proxy timeout with the IT/ops team before going live.
- **LLM_EXTRA_HEADERS format:** Clarify the expected format (JSON string? comma-separated key=value?) and document in `.env.example` with a worked example before Phase 4.

---

## Sources

### Primary (HIGH confidence)
- `C:/KVWarGame/WARGAME_ENGINE_DEV_SPEC.md` -- authoritative implementation spec; all feature, architecture, and pitfall findings grounded here
- `C:/KVWarGame/.planning/PROJECT.md` -- requirements and constraints
- FastAPI release notes (verified 2026-04-01): https://fastapi.tiangolo.com/release-notes/
- FastAPI CORS / static files / settings / testing / async tests docs: https://fastapi.tiangolo.com/
- Tailwind CSS v4 blog + install docs: https://tailwindcss.com/blog/tailwindcss-v4
- React 19 release blog: https://react.dev/blog/2024/12/05/react-19
- Pydantic-settings docs: https://docs.pydantic.dev/latest/concepts/pydantic_settings/

### Secondary (MEDIUM confidence)
- Zustand 5 named export change -- confirmed in docs; version confirmed via Tailwind docs referencing Vite 6 examples
- Vite 6 Node 18+ requirement -- confirmed via @tailwindcss/vite installation docs
- TypeScript 5.x current stable -- training knowledge; widely adopted
- Python 3.11 recommendation -- training data + corporate deployment patterns; 3.12 is stable alternative

### Tertiary (LOW confidence / inference)
- Competitor landscape -- WebSearch unavailable; no verified competitor product research. No known product combines multi-persona AI, live state tracking, and policy exercise facilitation at this scope.
- Corporate proxy timeout defaults -- 30-second estimate is a common corporate default; must be verified with target deployment environment

---
*Research completed: 2026-04-13*
*Ready for roadmap: yes*
