---
phase: 05-game-screen-layout
plan: 03
subsystem: ui
tags: [react, typescript, zustand, tailwind, vitest, game-screen, layout, animation]

# Dependency graph
requires:
  - phase: 03-ui-design-system
    provides: "@theme tokens (bg-panel, bg-base, border-subtle, text-primary, text-muted, crisis-*, animate-blink pattern)"
  - phase: 04-setup-screen
    provides: "GuardedGameScreen in App.tsx, AppRoutes split, react-router v7 Navigate"
  - phase: 05-game-screen-layout/05-01
    provides: "src/mocks/mockGameState.ts (MOCK_GAME_STATE, MOCK_MESSAGES), src/mocks/seedMockState.ts (seedMockState)"
provides:
  - "Three-column GameScreen shell: StatePanel slot (~210px), ChatFeed slot (flex-1), ReferencePanel slot (~252px)"
  - "GameHeader: wordmark, game title, scenario name, round counter, crisis badge (token-coloured), New Game button"
  - "Four stub child components with data-testids: state-panel, chat-feed, reference-panel, facilitator-input"
  - "--animate-message-in keyframe (messageIn, 180ms ease-out both) in @theme for ChatFeed consumption"
  - "Dev-only GuardedGameScreen seed: navigating to /game with null gameState calls seedMockState() in DEV mode"
affects:
  - 05-04-PLAN (ChatFeed — consumes --animate-message-in token and chat-feed testid)
  - 05-05-PLAN (ReferencePanel — replaces reference-panel stub)
  - 05-06-PLAN (StatePanel — replaces state-panel stub)
  - 05-07-PLAN (FacilitatorInput — replaces facilitator-input stub)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Three-column game layout: h-screen flex-col with min-h-0 overflow-hidden on column row — prevents page scroll, enables per-column scroll"
    - "Stub components: data-testid + visible label, default export — enables layout verification and test assertions before real content arrives"
    - "Crisis badge: inline helper maps CrisisState to Tailwind token classes with opacity modifiers (/20 background, /30 border)"
    - "DEV seed: seedMockState() called in render-phase guard, returns null to trigger synchronous re-render with state"
    - "Test env stubbing: vi.stubEnv('DEV', false) to test production redirect path without DEV seed interference"

key-files:
  created:
    - src/components/game/GameHeader.tsx
    - src/components/game/GameScreen.tsx
    - src/components/game/GameScreen.test.tsx
    - src/components/game/ChatFeed/ChatFeed.tsx
    - src/components/game/StatePanel/StatePanel.tsx
    - src/components/game/ReferencePanel/ReferencePanel.tsx
    - src/components/game/FacilitatorInput/FacilitatorInput.tsx
  modified:
    - src/App.tsx (GuardedGameScreen DEV seed + seedMockState import)
    - src/styles/index.css (--animate-message-in keyframe in @theme)
    - src/components/setup/LoadConfigPanel.test.tsx (vi.stubEnv DEV=false fix)

key-decisions:
  - "GameHeader reads gameConfig?.name (not .title) as primary fallback — GameConfig interface uses 'name' not 'title'"
  - "vi.stubEnv('DEV', false) + vi.unstubAllEnvs() in existing AppRoutes guard test — tests production redirect invariant without contaminating other tests"
  - "seedMockState.ts created by this plan (not 05-01) — 05-01 partial run only produced mockGameState.ts; documented as deviation"

patterns-established:
  - "Crisis badge pattern: crisisBadgeClasses() helper returns full Tailwind string based on CrisisState union — reusable in future plans"
  - "Test env isolation: vi.stubEnv/vi.unstubAllEnvs pattern for import.meta.env.DEV dependent guards"

# Metrics
duration: 3min
completed: 2026-04-14
---

# Phase 5 Plan 03: Game Screen Shell Summary

**h-screen three-column flex shell with sticky GameHeader (crisis badge, round counter, New Game) and four stub child components; dev-only mock seeding via seedMockState() on /game navigation**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-14T11:07:45Z
- **Completed:** 2026-04-14T11:10:50Z
- **Tasks:** 3/3
- **Files modified:** 10

## Accomplishments

- Three-column layout shell renders at h-screen with no page scroll (min-h-0 + overflow-hidden on column row)
- GameHeader shows all required fields: KV WAR GAME wordmark, game name, scenario name, Round N counter, crisis state badge with token-based colours, New Game button wired to resetGame()
- Dev navigation to /game auto-seeds mock state without going through Launch flow; production preserves /setup redirect
- --animate-message-in keyframe added to @theme for ChatFeed Plan 05-04 consumption

## Task Commits

1. **Task 1: Stub child components + messageIn keyframe** - `fa38f06` (feat)
2. **Task 2: GameHeader + GameScreen three-column shell** - `f06ac28` (feat)
3. **Task 3: Wire dev-only mock seeding into GuardedGameScreen** - `77e5a24` (feat)

## Files Created/Modified

- `src/components/game/GameHeader.tsx` - Sticky header with wordmark, game/scenario name, round, crisis badge, New Game
- `src/components/game/GameScreen.tsx` - Replaced Phase 4 placeholder with h-screen three-column shell
- `src/components/game/GameScreen.test.tsx` - 8 tests: all panels, round counter, crisis badge, New Game reset, wordmark, scenario name
- `src/components/game/ChatFeed/ChatFeed.tsx` - Stub with data-testid="chat-feed"
- `src/components/game/StatePanel/StatePanel.tsx` - Stub with data-testid="state-panel", w-[210px]
- `src/components/game/ReferencePanel/ReferencePanel.tsx` - Stub with data-testid="reference-panel", w-[252px]
- `src/components/game/FacilitatorInput/FacilitatorInput.tsx` - Stub with data-testid="facilitator-input"
- `src/App.tsx` - GuardedGameScreen DEV seed path added
- `src/styles/index.css` - --animate-message-in + @keyframes messageIn in @theme
- `src/components/setup/LoadConfigPanel.test.tsx` - vi.stubEnv fix for AppRoutes guard test

## Decisions Made

- `gameConfig?.name` used as game title (not `.title`) — GameConfig interface defines `name` not `title`; the plan's pseudocode said `gameConfig?.title || 'Untitled Game'` but the actual type has `.name`; fallback to 'Untitled Game' retained
- `vi.stubEnv('DEV', false)` scoped to the AppRoutes redirect test — isolates production invariant test from DEV seed behaviour without requiring a global env change

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] vi.stubEnv DEV=false fix for existing AppRoutes guard test**
- **Found during:** Task 3 (Wire dev-only mock seeding)
- **Issue:** Existing test `redirects /game to /setup when gameState is null` breaks in DEV test environment because `seedMockState()` now runs (seeds state, renders GameScreen instead of redirecting)
- **Fix:** Added `vi.stubEnv('DEV', false)` + `vi.unstubAllEnvs()` to the existing test to simulate the production environment for that specific assertion
- **Files modified:** `src/components/setup/LoadConfigPanel.test.tsx`
- **Verification:** `npm test` — 152 tests pass (was 1 fail before fix)
- **Committed in:** `77e5a24` (Task 3 commit)

**2. [Rule 3 - Blocking] Created seedMockState.ts (05-01 partial run only produced mockGameState.ts)**
- **Found during:** Task 3 (Wire dev-only mock seeding)
- **Issue:** `src/mocks/seedMockState.ts` did not exist — 05-01 was a partial run. `App.tsx` import `@/mocks/seedMockState` would fail to resolve.
- **Fix:** Created `seedMockState.ts` matching the exact spec from 05-01-PLAN.md (setGameConfig, setGameState, addMessages, setLoading); no env guard inside per spec
- **Files modified:** `src/mocks/seedMockState.ts` (created)
- **Verification:** TypeScript passes; all tests pass; file matches 05-01 spec exactly so merge will be a no-op
- **Committed in:** `77e5a24` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 bug fix, 1 blocking unblock)
**Impact on plan:** Both fixes necessary for correctness and compilation. No scope creep.

## Issues Encountered

- `gameConfig.title` referenced in plan pseudocode does not exist on `GameConfig` interface — actual field is `.name`. Fixed inline (used `.name`); no interface change needed.

## Next Phase Readiness

- Three-column shell is visible at `/game` in DEV mode with full mock state seeded
- All four stub testids ready for Plans 05-04 through 05-07 to assert against
- `--animate-message-in` token available in @theme for ChatFeed Plan 05-04
- GameHeader crisis badge pattern (`crisisBadgeClasses` helper) ready for reuse

---
*Phase: 05-game-screen-layout*
*Completed: 2026-04-14*
