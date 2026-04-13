# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-13)

**Core value:** Three AI personas respond in-character to facilitator input with accurate, live game state tracking
**Current focus:** Phase 2 — FastAPI Backend

## Current Position

Phase: 2 of 8 (FastAPI Backend)
Plan: 2 of 4 in current phase
Status: In progress
Last activity: 2026-04-13 — Completed 02-02-PLAN.md (LLM proxy endpoint)

Progress: [████░░░░░░] 14% (5/35 plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 3
- Average duration: 3m 27s
- Total execution time: ~10 minutes

**By Phase:**

| Phase | Plans | Completed | Avg/Plan |
|-------|-------|-----------|----------|
| 01-foundation | 4 | 3 | 3m 27s |
| 02-fastapi-backend | 4 | 2 | ~1m |

**Recent Trend:**
- Last 5 plans: 01-02 (3m 19s), 01-03 (3m 19s), 02-01 (1m 30s), 02-02 (54s)
- Trend: Accelerating — simpler implementation tasks running under 1m

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: TypeScript interfaces before everything else — cascade rework cost of changing `GameState` post-Phase 1 is high; the lock-in is intentional
- Roadmap: Backend built Phase 2, before UI (Phases 3–5) — backend tests independently with curl; no stub-then-real round trip
- Roadmap: UI layout against mock data (Phase 5) before LLM wiring (Phase 6) — decouples visual development from LLM iteration
- Roadmap: Config generation deferred to Phase 7 — its prompt-engineering risk is independent of the core game loop
- Roadmap: SETUP-04/05 (generate-from-brief wiring) moved to Phase 7, not Phase 4 — setup screen ships with stubbed brief panel
- 01-01: TypeScript 6 deprecated `baseUrl` — added `ignoreDeprecations:"6.0"` to tsconfig.json and tsconfig.app.json; zero behavioral change, @/ alias intact
- 01-01: Tailwind v4 CSS-first confirmed — `@import "tailwindcss"` + `@theme` in index.css, no tailwind.config.ts
- 01-02: Used `as const satisfies GameConfig` for EDIP_CONFIG — provides literal type narrowing (e.g. CrisisState) while enforcing interface compliance at compile time
- 01-03: Zustand v5 double-call mock requires `originalCreate<T>()(stateCreator)` — single-call pattern fails because `actualCreate<T>()` returns a factory, not a store
- 01-03: `vi.mock('zustand')` must be explicit in test files — Vitest does not auto-apply `__mocks__/` without `automock: true` in vite.config
- 02-01: asynccontextmanager lifespan preferred over deprecated @app.on_event in FastAPI 0.93+
- 02-01: RequestValidationError overridden to 400 (not 422) for consistent {error: {code, message}} shape across all endpoints
- 02-01: llm_extra_headers parsed lazily in get_extra_headers() method — avoids pydantic validator complexity
- 02-01: No CORS middleware — Vite proxy handles dev; production same-origin via Plan 02-04 static mount
- 02-02: httpx.TimeoutException caught before httpx.RequestError — TimeoutException is a subclass; order ensures 504 not 502 for timeouts
- 02-02: JSONResponse used for all returns (success and error) — gives full control over status code and body shape

### Pending Todos

None.

### Blockers/Concerns

- Phase 6 research flag: Corporate LLM endpoint response structure may deviate from standard OpenAI format — make extraction path configurable in `config.py` before hardcoding; verify against actual endpoint
- Phase 6 research flag: Token budget for system prompt needs measurement before choosing windowed history N — estimated 3,000–4,000 tokens but depends on actual EDIP card count
- Phase 6 research flag: Corporate proxy timeout (est. 30s) vs LLM generation time (25–35s) — verify actual timeout with ops team before Phase 6 completes
- Phase 7 research flag: Config generation prompt needs testing against 3 brief types to establish reliability threshold

## Session Continuity

Last session: 2026-04-13
Stopped at: Completed 02-02-PLAN.md — LLM proxy endpoint with credential injection and error handling
Resume file: None
