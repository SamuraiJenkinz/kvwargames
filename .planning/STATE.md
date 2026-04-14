# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-13)

**Core value:** Three AI personas respond in-character to facilitator input with accurate, live game state tracking
**Current focus:** Phase 6 (LLM Integration) — backend Azure auth unblocked, types seeded, downstream wiring plans queued

## Current Position

Phase: 6 of 8 (LLM Integration)
Plan: 4 of 9 in current phase (06-01 + 06-02 + 06-03 + 06-04 complete; 06-05 landed in parallel wave)
Status: In progress — prompt builder shipped with deterministic 10-block system prompt and empirical 5124-token baseline on EDIP config
Last activity: 2026-04-14 — Completed 06-04-prompt-builder-PLAN.md; 28/28 new tests pass, full suite 310/310, typecheck clean

Progress: [██████████] 74% (26/35 plans)

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
- 05-01: DEV guard excluded from seedMockState() — gate lives at call site (GuardedGameScreen in 05-03) for testability; seeder is unconditional
- 05-01: EDIP_CONFIG cast as GameConfig in seeder — required because 'as const satisfies GameConfig' gives narrower literal type incompatible with setGameConfig parameter
- 05-01: No chen message after Round 2 round_divider in MOCK_MESSAGES — intentional; exercises 2-lit/1-dim persona indicator dot state
- 05-02: REQUIREMENTS.md CHAT-02 KV/AF/MC initials override CONTEXT.md single-letter K/F/C — documented in personaConfig.ts comments
- 05-02: PERSONA_META bubbleClass pre-baked as literal Tailwind strings (not template-literal generation) — Tailwind v4 purges non-literal class references
- 05-02: advanceRound captures newRound before calling get().addMessages — avoids reading from immer draft after set() completes
- 05-02: sendFacilitatorMessage does NOT trigger LLM call — Phase 6 replaces this stub; signature is the stable Phase 6 entry point
- 05-03: gameConfig.name used as game title (not .title) — GameConfig interface has 'name' not 'title'; plan pseudocode was illustrative
- 05-03: vi.stubEnv('DEV', false) pattern for production-path tests — isolates redirect invariant test from DEV seed without global env changes
- 05-03: Three-column layout uses h-screen flex-col + min-h-0 overflow-hidden on column row — prevents page scroll, enables per-column independent scroll
- 05-04: No cn/clsx utility in project — Array.join(' ') used for conditional class concatenation in message renderers
- 05-04: getLoadingSpeaker is a module-level pure function (not a hook) — first PERSONA_ORDER member absent from getPersonasThisRound; defaults to 'chen'
- 05-04: scrollIntoView not in jsdom — stubbed via beforeEach in ChatFeed.test.tsx; 05-05 moved to setup.ts globally
- 05-04: DEBRIEF amber class assertion uses querySelectorAll + toContain — avoids fragile first-match when Finch name spans also carry text-persona-finch
- 05-05: useGameStore(s => s.gameConfig) not s.gameConfig?.cards ?? [] as selector — unstable [] reference causes Zustand infinite rerender loop when gameConfig is null
- 05-05: setSelectedId(null) never called inside render — call in onClick handler only; calling setState in render body triggers React's max update depth protection
- 05-05: scrollIntoView global mock in src/test/setup.ts — jsdom doesn't implement scrollIntoView; affects any test that renders ChatFeed (useStickyBottomScroll hook)
- 05-05: Pre-baked CAT_CHIP_CLASS lookup (same pattern as PERSONA_META.bubbleClass from 05-02) — Tailwind v4 purges template-literal class names
- 05-06: CSS text-transform:uppercase not applied by jsdom — tests assert against DOM text ('Severity' not 'SEVERITY'); comment explains discrepancy
- 05-06: getAllByText used for values that collide across multiple TeamCards (e.g. '+1' appears on legitimacy track + two team PO fields)
- 05-06: No @theme additions needed — bg-track-severity, bg-track-legitimacy, all text-resource-* tokens pre-existed from Phase 3
- 05-07: @testing-library/user-event installed via pnpm (npm fails on workspace: protocol) — required for keyboard interaction tests (Shift+Enter newline)
- 05-07: insertRef bridge pattern — useRef stores insert-at-cursor closure from MessageInput; parent passes it to ActionToolbar via handleInsert; avoids lifting textarea value state
- 05-07: registerInsert prop uses useEffect with [registerInsert] dependency — closure captured once on mount; stable reference from parent inline function
- 06-01: LLM auth header configurable via `LLM_AUTH_HEADER_NAME` + `LLM_AUTH_VALUE_PREFIX` env vars — default `Authorization` + `Bearer ` (trailing space intentional) preserves OpenAI behaviour byte-identically; Azure flip is `api-key` + empty prefix
- 06-01: Trailing-space Bearer default + `.strip()` produces a single branchless code path for both auth styles — `f"{prefix}{key}".strip()` yields `"Bearer <key>"` when prefix is `"Bearer "` and `"<key>"` when prefix is `""`
- 06-01: `LLM_API_VERSION` query-string injection NOT added this plan — Research flagged, but deferred; operators embed `?api-version=...` directly in `LLM_ENDPOINT_URL` for now
- 06-01: Backend test harness uses `httpx.MockTransport` (built-in) not `respx`/`pytest-httpx` — zero new deps; pattern: `with TestClient(app)` swap `app.state.http_client` inside block, restore before exit so lifespan shutdown closes cleanly
- 06-01: `backend/tests/conftest.py` provides `env_base` fixture + autouse `get_settings.cache_clear()` — template for all future backend tests; pydantic-settings lru_cache would otherwise leak env state between tests
- 06-01: `backend/.env.example` created (did not exist previously) — documents every backend env var with commented Azure OpenAI example block; ops can flip without reading code
- 06-02: HistoryEntry defined in src/types/llm.ts (not contextWindow.ts) — sibling modules 06-05 and 06-06 both import from shared types module, breaking would-be type-level dependency between them
- 06-02: All new ChatMessage fields (rawResponse, errorCode, retryInput, revealDelay) are optional — Phase 5 callers satisfy the interface unchanged; only Phase 6 producers set the new fields
- 06-02: ParseResult and LLMCallResult use discriminated { ok: true | false } unions rather than throwing — consumers pattern-match without try/catch and error metadata rides the value channel
- 06-02: ParseErrorKind uses string literal union ('PARSE_FAILURE' | 'VALIDATION_FAILURE') matching eventual ChatMessage.errorCode strings — trivial serialization, no enum indirection
- 06-02: LLMStructuredResponse.control conflict rule documented in JSDoc — store prefers triggerDebrief over advanceRound when both true; never auto-applies either (non-blocking confirmation banner owns the decision)
- 06-03: applyStateUpdatePure returns { nextState, clampLog } tuple — matches CONTEXT.md "clamping is silent but logged"; store forwards clampLog to dev console in 06-07 without surfacing to users
- 06-03: structuredClone (native) over lodash.cloneDeep — Node 17+ and modern browsers; zero dependency cost
- 06-03: CLAMP_RANGES is single-source-of-truth `as const` object iterated by TEAM_CLAMP_FIELDS — adding a numeric field = one line in CLAMP_RANGES + TEAM_CLAMP_FIELDS, no magic numbers elsewhere
- 06-03: clampLog field path format is bare name for top-level ('crisisSeverity') and 'teams[ID].field' for team entries — readable in dev console, machine-parseable by bracket for future tooling
- 06-03: Unknown team IDs still produce a new state reference via unconditional structuredClone — contract is always-pure always-returns-new, no store branch assigns the same reference back
- 06-03: gameStore.ts intentionally untouched in this plan — 06-07 is the wiring plan; keeping store unchanged means 06-03 can be reverted independently if the contract needs to change before 06-07 lands
- 06-03: REFACTOR step folded into GREEN implementation — applyTeamUpdate helper extraction was trivial once tests pinned the behaviour; no separate refactor commit needed, suite stayed green throughout
- 06-04: promptBuilder.ts does NOT import EDIP_CONFIG — config passed only via parameter; Phase 7 generated configs work identically with zero module change
- 06-04: PERSONA_PROMPT_DEFS kept module-private (not exported) — voice tuning remains a single-file edit; no downstream code couples to the literal persona shape
- 06-04: Block 9 embeds clamp ranges inline (crisisSeverity 0–5, pc 0–6, etc.) — nudges the LLM to produce in-range values and removes one validation round-trip at a ~300-char prompt cost
- 06-04: Block 9 documents the advanceRound/triggerDebrief conflict rule (triggerDebrief wins) — mirrors 06-02 LLMStructuredResponse JSDoc so both the model and the store see the same tie-break
- 06-04: Block 2 renders `scenario.injects[round - 1]` with deterministic fallback when round exceeds injects.length — tests stay stable across scenario-end edge cases
- 06-04: Empirical prompt size on EDIP config is 5124 tokens / 20496 chars — logged by a dedicated test so Plan 06-08 has the baseline without re-running. Exceeds the STATE.md-flagged 3K–4K estimate; windowing must be tight
- 06-04: Tests isolate block content via `indexOf(heading) + slice(next heading)` — assertions scope correctly even if block order changes; drop-in robustness for future voice edits
- 06-04: Test fixture casts EDIP_CONFIG as unknown as GameConfig (same pattern as 05-01 seedMockState) — the `as const satisfies GameConfig` narrows too literally for the `GameConfig` parameter type

### Pending Todos

None.

### Blockers/Concerns

- Phase 6 research flag: Corporate LLM endpoint response structure may deviate from standard OpenAI format — make extraction path configurable in `config.py` before hardcoding; verify against actual endpoint
- Phase 6 research flag (MEASURED 06-04): Token budget for system prompt is **5124 tokens (20496 chars)** on the EDIP config via measurePromptTokens — exceeds the original 3K-4K estimate. Plan 06-08 must verify corporate LLM endpoint context window vs this number; with an 8K cap, history + response share only ~3K and windowing must be aggressive
- Phase 6 research flag: Corporate proxy timeout (est. 30s) vs LLM generation time (25–35s) — verify actual timeout with ops team before Phase 6 completes
- Phase 7 research flag: Config generation prompt needs testing against 3 brief types to establish reliability threshold

## Session Continuity

Last session: 2026-04-14 — Completed Phase 6 plan 06-04 (prompt builder)
Stopped at: 06-04 done; buildSystemPrompt + measurePromptTokens exported from src/lib/promptBuilder.ts; 10-block deterministic prompt with kent/finch/chen voice + MUST NOT; 28 structural tests + empirical 5124-token baseline logged. gameStore untouched. Remaining Wave 2: 06-05 (response parser + context window, already landed in parallel); Wave 3: 06-06 (llm client, depends on 06-04 + 06-05); Wave 4: 06-07 (store + ui wiring, consumes 06-03 + 06-04 + 06-05 + 06-06).
Resume file: None
