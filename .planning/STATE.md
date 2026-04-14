# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-13)

**Core value:** Three AI personas respond in-character to facilitator input with accurate, live game state tracking
**Current focus:** Phase 3 — UI Design System

## Current Position

Phase: 4 of 8 (Setup Screen)
Plan: 4 of 4 in current phase
Status: Phase complete
Last activity: 2026-04-14 — Completed 04-04-PLAN.md (Validation Polish) — Phase 4 ships

Progress: [█████░░░░░] 43% (15/35 plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 7
- Average duration: ~2m 20s
- Total execution time: ~15 minutes

**By Phase:**

| Phase | Plans | Completed | Avg/Plan |
|-------|-------|-----------|----------|
| 01-foundation | 4 | 3 | 3m 27s |
| 02-fastapi-backend | 4 | 4 | ~2m |
| 03-ui-design-system | 4 | 4 | ~1m |

**Recent Trend:**
- Last 5 plans: 02-04 (3m), 03-01 (~1m), 03-02 (~1m), 03-03 (~1m)
- Trend: UI design phase fast-executing; React component tasks complete under 2 minutes

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
- 02-03: No server-side JSON parsing of LLM config output — frontend owns validation so it can display meaningful errors to facilitators
- 02-03: Error-handling chain in config_gen.py kept as explicit duplication of llm.py — refactor to shared helper deferred to future phase
- 02-03: CONFIG_GEN_SYSTEM_PROMPT is a functional placeholder (~200 words); Phase 7 owns prompt refinement
- 02-04: SPAStaticFiles subclasses StaticFiles, catches 404 and returns index.html — no third-party dep for SPA routing
- 02-04: app.mount("/") is the final statement in main.py — enforced by comment; SPA catch-all must never precede API routers
- 02-04: vite.config.ts must import defineConfig from vitest/config (not vite) for vitest 4.x — type augmentation approach removed in v4
- 02-04: noUncheckedSideEffectImports set to false in tsconfig.app.json — CSS side-effect imports are valid in Vite projects
- 03-01: Stitch MCP tools unavailable in execution environment — SKIPPED.md created per plan fallback; all tokens authoritative from spec
- 03-02: @keyframes blink placed inside @theme alongside --animate-blink token — co-location is valid in Tailwind v4 and keeps animation self-contained
- 03-02: Google Fonts loaded via HTML link tag (not CSS @import) — avoids render-blocking; preconnect links added for performance
- 03-03: Zero hardcoded hex rule enforced at component level — all colours from Tailwind utility classes resolving @theme tokens
- 03-03: Opacity modifiers (/8, /20, /30, /50) on custom @theme colours work natively in Tailwind v4 — no configuration needed
- 03-03: Dev components isolated to src/components/dev/ — kept separate from production game/setup component trees
- 03-04: Applied flex-wrap to Persona Colours row (was the only horizontal row missing it)
- 03-04: Reduced outer padding and section spacing at mobile breakpoint for better density; kept max-w-4xl container width
- 03-04: Human verification confirmed all tokens render correctly at 1280px and 768px — Phase 3 design system foundation complete
- 04-01: react-router v7 uses consolidated "react-router" package (react-router-dom merged in v7) — no imports from react-router-dom anywhere in src/
- 04-01: GuardedGameScreen is an inline function component in App.tsx (not a separate file) — route guard with no exported contract; separate file adds overhead for no gain
- 04-01: AppPhase type retained in types/game.ts post-store-removal — no store references remain, but Phase 5 may want 'debrief' distinction within /game
- 04-01: All router redirects use replace prop — prevents history entry pollution on null gameState guard and catch-all routes
- 04-02: Disabled card uses aria-disabled (not disabled attr) — preserves keyboard focus so screen readers can hear the disabled state
- 04-02: Load placeholder inlined in SetupScreen switch case (no stub file) — plan 04-03 replaces the JSX in-place via TODO(04-03) comment
- 04-02: briefMessageVisible state lives in HomeScreen component (not store) — purely transient UI state with no cross-component lifetime
- 04-03: parseConfigJson called eagerly on mount via useState(() => parseConfigJson(configJson)) — summary visible immediately, no 300ms blank state on first render
- 04-03: Regex /at position (\d+)/ used for V8 JSON.parse error offset extraction — falls back to line 1 col 1 when regex doesn't match
- 04-03: Launch handler re-parses synchronously at click time — guards against 300ms debounce window where debounced parseResult may be stale
- 04-03: ParseResult lives in local component state only — store holds raw configJson string; derived parse state is not persisted to Zustand
- 04-04: useRef (not useState) for lastValidScenarioCount — preserves button count across invalid states without extra re-renders; purely display value
- 04-04: AppRoutes split from App.tsx (option a) — exported named component with no Router wrapper; enables MemoryRouter in tests without BrowserRouter conflict; App delegates to AppRoutes
- 04-04: Launch buttons are disabled-not-hidden on invalid JSON — CONTEXT.md locked decision corrected from 04-03's hide-on-invalid starting point

### Pending Todos

None.

### Blockers/Concerns

- Phase 6 research flag: Corporate LLM endpoint response structure may deviate from standard OpenAI format — make extraction path configurable in `config.py` before hardcoding; verify against actual endpoint
- Phase 6 research flag: Token budget for system prompt needs measurement before choosing windowed history N — estimated 3,000–4,000 tokens but depends on actual EDIP card count
- Phase 6 research flag: Corporate proxy timeout (est. 30s) vs LLM generation time (25–35s) — verify actual timeout with ops team before Phase 6 completes
- Phase 7 research flag: Config generation prompt needs testing against 3 brief types to establish reliability threshold

## Session Continuity

Last session: 2026-04-14
Stopped at: Completed 04-04-PLAN.md (Validation Polish) — Phase 4 complete (4/4 plans), ready for Phase 5
Resume file: None
