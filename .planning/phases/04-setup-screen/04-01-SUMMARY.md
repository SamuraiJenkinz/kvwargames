---
phase: 04-setup-screen
plan: 01
subsystem: ui
tags: [react-router, zustand, vite, react, typescript]

# Dependency graph
requires:
  - phase: 03-ui-design-system
    provides: Tailwind v4 design tokens (bg-bg-base, text-text-primary, etc.) used in placeholder screens
  - phase: 01-foundation
    provides: GameStore with gameState field used for /game route guard
provides:
  - react-router v7 installed and BrowserRouter mounted in main.tsx
  - Flat route table — /setup → SetupScreen, /game → guarded GameScreen, / and * → Navigate to /setup replace
  - SetupScreen placeholder component (real content added in 04-02/04-03)
  - GameScreen placeholder component (real content added in Phase 5) with dev scenarioIndex readout
  - Store cleaned of redundant phase field — URL is now the sole navigation source of truth
affects:
  - 04-02 (mounts content inside /setup route)
  - 04-03 (mounts more content inside /setup route)
  - 04-04 (navigation between /setup and /game)
  - 05-game-screen (replaces GameScreen placeholder)

# Tech tracking
tech-stack:
  added:
    - react-router@7.14.1
  patterns:
    - BrowserRouter in main.tsx wraps entire app — single mount point for all route consumers
    - GuardedGameScreen inline component pattern — reads store selector, returns Navigate or component
    - navigate-replace for all redirects — prevents extra history entries and back-button loops
    - URL-is-navigation-truth — store owns intra-/setup state (setupMode) but never /setup vs /game

key-files:
  created:
    - src/components/setup/SetupScreen.tsx
    - src/components/game/GameScreen.tsx
  modified:
    - src/main.tsx
    - src/App.tsx
    - src/lib/gameStore.ts
    - src/lib/gameStore.test.ts
    - src/data/edipConfig.test.ts

key-decisions:
  - "react-router v7 consolidated package used (not react-router-dom — merged in v7)"
  - "GuardedGameScreen defined as inline component in App.tsx (not separate file) — minimal surface, no exported contract yet"
  - "AppPhase type retained in types/game.ts (unused by store) — reserved for Phase 5 debrief distinction within /game"
  - "All redirects use replace prop — prevents history loop on null gameState guard"
  - "Pre-existing no-non-null-assertion lint errors fixed (! → ?. in test files, guard+throw in main.tsx)"

patterns-established:
  - "Route guard pattern: inline component reads store selector, returns Navigate replace or the real component"
  - "BrowserRouter wraps App in main.tsx — child components use hooks (useNavigate, useLocation) freely"
  - "import.meta.env.DEV blocks for dev-only store readouts in placeholder screens"

# Metrics
duration: 3min
completed: 2026-04-13
---

# Phase 4 Plan 01: Router Scaffold and Phase Removal Summary

**React Router v7 mounted with /setup, /game (store-guarded), and catch-all routes; redundant `phase` field removed from Zustand store**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-13T10:42:09Z
- **Completed:** 2026-04-13T10:45:12Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Installed react-router 7.14.1 and wired BrowserRouter in main.tsx; App.tsx now owns the full flat route table
- Created SetupScreen and GameScreen placeholder components using existing design tokens
- Removed `phase`/`setPhase` from the Zustand store — URL is now the only navigation source of truth
- Deleted 4 phase-related tests; 109 tests remain, all passing
- Fixed 18 pre-existing `no-non-null-assertion` lint errors (all three source files now lint-clean)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install react-router v7 and scaffold router shell** - `726b2f5` (feat)
2. **Task 2: Remove phase from store and update tests** - `13963ff` (feat)

**Plan metadata:** `[see final commit below]` (docs: complete plan)

## Files Created/Modified
- `src/main.tsx` — Added BrowserRouter wrapper; replaced `!` non-null assertion with guard+throw
- `src/App.tsx` — Replaced TokenReference render with flat Routes table; GuardedGameScreen inline component
- `src/components/setup/SetupScreen.tsx` — Created: placeholder with app title and Tailwind tokens
- `src/components/game/GameScreen.tsx` — Created: placeholder with dev scenarioIndex readout
- `src/lib/gameStore.ts` — Removed phase field, setPhase action, AppPhase import; removed phase mutations from initGame/resetGame
- `src/lib/gameStore.test.ts` — Removed 4 phase-related tests; fixed 1 non-null assertion
- `src/data/edipConfig.test.ts` — Fixed 16 pre-existing non-null assertions (`!.` → `?.`)

## Decisions Made
- **react-router v7 consolidated package**: In v7 `react-router` and `react-router-dom` were merged. The plan specified `"react-router"` explicitly — confirmed correct.
- **GuardedGameScreen inline in App.tsx**: Kept as a local function component rather than a separate file. It's a route guard with no exported interface; separating it would add file overhead for no gain.
- **AppPhase type retained**: `src/types/game.ts` still exports `AppPhase = 'setup' | 'game' | 'debrief'`. Nothing in the store uses it post-removal, but Phase 5 may want it for debrief state within `/game`. Retention is harmless; deletion can happen when Phase 5 clarifies scope.
- **All redirects use `replace`**: Both the `/game` guard and the `/` + `*` catch-alls use `replace` to avoid polluting history.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed 18 pre-existing no-non-null-assertion lint errors**
- **Found during:** Task 2 verification (pnpm lint run)
- **Issue:** `edipConfig.test.ts` had 16 instances of `!.` on `.find()` results; `gameStore.test.ts` had 1; `main.tsx` had 1. All pre-dated this plan (confirmed via git stash comparison — same 18 errors before any changes).
- **Fix:** Replaced `!.` with `?.` in test files (tests still fail as expected when values are missing — they get `undefined` vs the expected value). Replaced `getElementById('root')!` in main.tsx with explicit guard-then-throw pattern.
- **Files modified:** `src/data/edipConfig.test.ts`, `src/lib/gameStore.test.ts`, `src/main.tsx`
- **Verification:** `pnpm lint` exits 0; `pnpm test` still 109 passed
- **Committed in:** `13963ff` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - pre-existing lint bug)
**Impact on plan:** No scope creep. Lint gate now clean, which unblocks future plan verification steps.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Router shell is in place: `/setup` renders SetupScreen, `/game` guards on `gameState`, all catch-alls redirect to `/setup`
- Plans 04-02 and 04-03 can mount content inside `SetupScreen` with no routing changes needed
- Plan 04-04 can wire launch buttons that call `initGame()` then `navigate('/game')` — the guard will pass because `gameState` will be non-null
- Phase 5 can replace `GameScreen.tsx` body with the three-column layout

---
*Phase: 04-setup-screen*
*Completed: 2026-04-13*
