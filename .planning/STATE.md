# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-13)

**Core value:** Three AI personas respond in-character to facilitator input with accurate, live game state tracking
**Current focus:** Phase 6 (LLM Integration) — COMPLETE. 06-09 delivered state-visibility polish (delta ghost labels + cell pulse); Phase 7 (config generation) ready to begin.

## Current Position

Phase: 6 of 8 (LLM Integration) — COMPLETE
Plan: 9 of 9 in current phase (06-01..06-09 all complete)
Status: Phase 6 complete. 06-09 delivered StatePanel delta diff + TrackBar ghost labels + TeamCard cell pulse + favourability colouring; Tailwind v4 static scan verified in built CSS bundle; 406/406 tests green (+18 over 388 baseline); typecheck clean; build succeeds. Rule 3 deviations: fixed pre-existing GameHeader.tsx .title typo and responseParser.test.ts stateUpdate shape incompatibility. Added --color-track-readiness token (#2BC48A) to unlock Tailwind scan. Ready for Phase 7.
Last activity: 2026-04-14 — Plan 06-09 complete; 3 atomic commits (feat/feat/test) + summary commit.

Progress: [█████████████] 86% (30/35 plans)

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
- 06-05: responseParser.ts uses FOUR defence layers (BOM/fence strip → JSON.parse → manual type guard → sort+dedupe) and contains zero `throw` statements — grep-verified. All failures return `{ ok: false, errorKind: 'PARSE_FAILURE' | 'VALIDATION_FAILURE', raw, detail }` with the ORIGINAL (uncleaned) input preserved for diagnostics
- 06-05: PERSONA_ORDER is parser-local (`const PERSONA_ORDER = ['kent','finch','chen']`) — intentionally NOT imported from personaConfig.ts; keeps responseParser.ts a pure utility with `@/types/llm` as its only cross-module dependency
- 06-05: Layer 4 de-dupe keeps first occurrence on duplicate speaker — alternative (merge / last-wins) would hide model confusion. First-wins makes the bug visible in the chat transcript for facilitator review
- 06-05: Fence regex `/^```(?:json)?\s*\n?|\n?\s*```$/gm` strips both opening and closing fences in a single `.replace` pass; language tag optional
- 06-05: BOM stripped via `charCodeAt(0) === 0xFEFF` (not regex) — single-codepoint check has clearer intent than a pattern
- 06-05: windowHistory adds `if (n <= 0) return []` guard — `Array.prototype.slice(-0)` returns the full array in JS (negative zero coerced to 0), which would violate the `result.length <= 2n` invariant when history is non-empty. Rule-2 fix caught by the `n = 0` invariant test on first run
- 06-05: HistoryEntry imported from `@/types/llm` and re-exported by contextWindow.ts — single source of truth in types module; 06-06 llmClient.ts depends on the type without depending on this module
- 06-06: llmClient.ts imports ONLY from `@/types/llm` — zero import of contextWindow.ts or responseParser.ts; 06-06 truly depends only on 06-02 at the type level and can be reverted independently
- 06-06: Never-throws invariant grep-verified (`grep -c "throw" src/lib/llmClient.ts` = 0) — every error path (abort, network, HTTP error, malformed body, non-Error rejection) returns a discriminated `LLMCallResult`
- 06-06: AbortError distinguished from network failure via `err instanceof DOMException && err.name === 'AbortError'` → `ABORTED`; all other catch paths → `NETWORK_ERROR`. Store can branch cleanly in 06-07
- 06-06: Known-list gate on backend codes — `(known as string[]).includes(code ?? '')` coerces unknown strings to `INTERNAL_ERROR`, keeping `LLMClientErrorCode` union tight even if backend adds new codes
- 06-06: `LLM_FRONTEND_TIMEOUT_MS = 45000` is consumed by the store (06-07), not by the client itself — store owns `AbortController`, `setTimeout(() => controller.abort(), LLM_FRONTEND_TIMEOUT_MS)`, fresh controller per call (never cached, per RESEARCH.md)
- 06-06: `error.message` fallback is `HTTP ${status}` — Phase 2 backend guarantees `code` on non-2xx but `message` is optional; client must not crash on `error: { code: 'LLM_TIMEOUT' }` without message
- 06-06: Test harness uses `vi.stubGlobal('fetch', vi.fn())` + `new Response(JSON.stringify(body), { status })` — zero new test dependencies; fetch mock module-level via beforeEach/afterEach + `vi.unstubAllGlobals()` teardown
- 06-06: Abort test mocks fetch as a Promise that listens to `signal.addEventListener('abort', ...)` and rejects with `new DOMException('aborted', 'AbortError')` — reproduces browser fetch cancellation semantics exactly
- 06-07: `runLLMTurn` is a local async closure INSIDE `create(immer(...))` — captures `get`/`set` directly, keeps LLM orchestration co-located with the store actions that invoke it. Module-level function would force prop-drilling the store APIs
- 06-07: `newGame()` aborts the controller BEFORE the `set()` call so the in-flight fetch's AbortSignal fires synchronously; `runLLMTurn` sees `errorCode === 'ABORTED'` and bails early without pushing an error bubble. The bail-out path is the only reason the plan's generic error handler was extended
- 06-07: `applyStateUpdate` computes `nextState` OUTSIDE `set()` then assigns inside — `structuredClone` in `applyStateUpdatePure` DataCloneErrors on immer draft proxies. Same pattern applied in `runLLMTurn`. Store's reduce-over-responses also runs outside set() for the same reason
- 06-07: Single `addMessages([...persona1, persona2, persona3])` with `revealDelay: i * 500` on each message — stagger is CSS-driven (`style.animationDelay`), NOT three setTimeout inserts. Sticky-bottom scroll hook from 05-04 sees ONE insert batch; CONTEXT.md pitfall #3 dodged
- 06-07: `text-persona-amber` @theme token does not exist; `PersonaMessage.flag` uses `text-amber-400` Tailwind literal. Noted for future token consolidation pass — not promoting single-consumer colour to @theme now
- 06-07: Control banner conflict resolution (both flags true → `kind='triggerDebrief'`) lives in `runLLMTurn`'s set() branch, NOT in the UI. UI reads `pendingControlBanner.kind` and renders one kind at a time; never has to pick
- 06-07: `confirmControlBanner` clears the banner state BEFORE dispatching to `advanceRound`/`triggerDebrief` — prevents re-entrancy concerns (next LLM response could legitimately re-signal, but that's a new banner, not the same one)
- 06-07: `retryLastMessage` guards on `loading` so double-clicks can't spawn two concurrent AbortControllers; same guard in `sendFacilitatorMessage` / `advanceRound` / `triggerDebrief`
- 06-07: `llmHistory` bounded at `2 * HISTORY_WINDOW_N + 1 = 13` inside `runLLMTurn`'s success set() (not in `appendHistory`, which stays a free-form slice-setter). Enforced by a 10-turn invariant test that stabilises at exactly 13
- 06-07: vi.mock of 4 external modules in gameStore.test.ts (`promptBuilder`, `contextWindow`, `llmClient`, `responseParser`) — `applyStateUpdatePure` intentionally NOT mocked so clamp-log assertions exercise real behaviour
- 06-07: FacilitatorInput tests now also mock the LLM pipeline — previously `sendFacilitatorMessage` was a stub and buttons fired no async work; now they trigger `runLLMTurn` which the mocks short-circuit with a never-resolving promise (for loading=true assertions) or happy-path defaults
- 06-07: Two debrief buttons ('Request Debrief Now' + 'End Game + Debrief') both dispatch `triggerDebrief` today. Plan 08 may split semantics (interim vs end-of-game clears cardsThisRound, etc.) if smoke test surfaces the need
- 06-08: Empirical budget measurement confirms systemPromptTokens = 5124 (via measurePromptTokens heuristic on EDIP_CONFIG + fresh GameState). With SAFE_CONTEXT_CEILING_TOKENS=7500 (gpt-4 8k), N=6 overshoots by 2424 tokens — reduced to N=2 (total 6724/7500, 776-token headroom). Reversal path documented in BUDGET.md; raise both constants once corporate context window is confirmed >8k
- 06-08: SAFE_CONTEXT_CEILING_TOKENS=7500 chosen as conservative default for gpt-4 8k; corporate deployment context size UNCONFIRMED at plan-execution time — flagged for Phase 8 ops confirmation before considering raising N back up
- 06-08: TOKENS_PER_TURN_ESTIMATE=800 pinned in test; recalibration procedure (±20% band against actual DevTools-captured response) deferred to Task 2 smoke test per plan verify clause
- 06-08: reportPromptBudget wired into gameStore.initGame behind import.meta.env.DEV — console.info on withinLimit, console.error with 'CTX-03 BUDGET EXCEEDED' tag when over-budget. Cannot silently fail (CTX-03 satisfied)
- 06-09: prevStateRef updated INSIDE useEffect (not during render) so the current render pass can read previous value — updating during render would overwrite prev with current and always yield zero deltas. First render prevStateRef.current === null → no ghost labels anywhere
- 06-09: Zero delta is explicit no-op (`hasDelta = delta != null && delta !== 0`) — re-rendering same gameState object or a same-value clone produces no visual noise
- 06-09: Ghost-label colour via LITERAL ternary (`isFavourable ? 'text-track-readiness' : 'text-crisis-security'`) — Tailwind v4 static source scanner drops dynamically composed class names; the two literals appear verbatim in StatePanel.tsx (2×), TeamCard.tsx (3×), and TrackBar.tsx; build-output grep confirms both classes emit to dist/assets/*.css
- 06-09: Added `--color-track-readiness: #2BC48A;` to @theme — plan mandated the class name but no matching token existed; #2BC48A matches resource-readiness and crisis-none for canonical "favourable green" semantic consistency
- 06-09: Favourability map is a module-level Record<string, 'up'|'down'> constant (FAVORABILITY in StatePanel, FAVOURABILITY in TeamCard) — crisisSeverity is the ONLY 'down' field (lower is better); edipLegitimacy, pc, po, readiness, stock, crm, ic are all 'up'
- 06-09: Ghost label text format — prepend '+' for positive deltas (`+1`), rely on natural '-' for negatives (`-2`); matches mental model of signed delta
- 06-09: @keyframes cellPulse + @keyframes ghostFade live inside @theme alongside existing messageIn (src/styles/index.css) — animation-system co-location keeps keyframes discoverable in one place; used via animate-[name_duration_easing_fill] arbitrary-value syntax (no animate-* token needed since only this component uses them)
- 06-09: TrackBar ghost uses stable key `${label}-${delta}-${value}` — forces animation restart when delta genuinely changes, avoids spurious resets on unrelated prop flips
- 06-09: Plan referenced `src/index.css` but actual file is `src/styles/index.css` — used the correct path (confirmed via Glob). Future plans should reference the real path
- 06-09: [Rule 3 unblock] `GameHeader.tsx` was using `gameConfig?.title` (non-existent on GameConfig interface); replaced with `.name` per 05-03 decision. Pre-existing regression discovered during `pnpm build` verify
- 06-09: [Rule 3 unblock] `responseParser.test.ts` stateUpdate round-trip test used a bogus shape `{teams: {...}}` incompatible with StateUpdate type; cast through `as unknown as PersonaResponse['stateUpdate']` since the parser deliberately doesn't validate the inner shape (only "non-null object")

### Pending Todos

None.

### Blockers/Concerns

- Phase 6 research flag: Corporate LLM endpoint response structure may deviate from standard OpenAI format — make extraction path configurable in `config.py` before hardcoding; verify against actual endpoint
- Phase 6 research flag (MEASURED 06-04, RESOLVED 06-08): Token budget for system prompt is **5124 tokens** on the EDIP config. 06-08 Task 1 reduced HISTORY_WINDOW_N 6 → 2 against gpt-4 8k assumption (total 6724 / 7500 safe ceiling). See .planning/phases/06-llm-integration/06-08-BUDGET.md. Remaining Phase 8 follow-up: confirm actual corporate context window with ops; if >8k, raise SAFE_CONTEXT_CEILING_TOKENS + HISTORY_WINDOW_N accordingly
- Phase 6 research flag: Corporate proxy timeout (est. 30s) vs LLM generation time (25–35s) — verify actual timeout with ops team before Phase 6 completes
- Phase 7 research flag: Config generation prompt needs testing against 3 brief types to establish reliability threshold

## Session Continuity

Last session: 2026-04-14 — Plan 06-09 complete (state-visibility polish); Phase 6 closed out
Stopped at: Plan 06-09 complete — StatePanel delta diff + TrackBar ghost labels + TeamCard cell pulse + favourability colouring. `src/styles/index.css` gained `@keyframes cellPulse` (800ms), `@keyframes ghostFade` (2500ms), and `--color-track-readiness: #2BC48A` token. 3 atomic commits (78ac275 feat StatePanel+TrackBar+keyframes, 48b8812 feat TeamCard+track-readiness token+GameHeader Rule 3 fix, bc3cda3 test StatePanel+TeamCard+responseParser Rule 3 fix). 406/406 tests passing (+18 over 388 baseline); typecheck clean; `pnpm build` succeeds; both favourability classes present in dist/assets/*.css. Resume: Phase 7 (config generation) — `/gsd:plan-phase 07` to seed the phase plans. Deferred: number-tick interpolation on track readouts (low-value polish, revisit in Phase 8 if facilitator feedback requests it); manual visual spot-check via dev seed (recommended before Phase 7 kicks off).
Resume file: None
