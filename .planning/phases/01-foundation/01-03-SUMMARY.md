---
phase: 01-foundation
plan: 03
subsystem: state-management
tags: [zustand, immer, devtools, vitest, game-store, clamping]

# Dependency graph
requires:
  - phase: 01-01
    provides: TypeScript type definitions (GameConfig, GameState, StateUpdate, ChatMessage, AppPhase, SetupMode)
  - phase: 01-02
    provides: EDIP_CONFIG constant used as configJson initial value and test fixture
provides:
  - Zustand store (useGameStore) with all session state and actions for the game application
  - Zustand v5 double-call mock (__mocks__/zustand.ts) for test isolation
  - 62 comprehensive store behavior tests
affects:
  - All UI phases (03-05): components read from useGameStore
  - Phase 02 (backend): applyStateUpdate is the entry point for LLM state changes
  - Phase 06 (LLM wiring): llmHistory and appendHistory back the conversation context
  - Phase 07 (config generation): configJson and briefText fields back the setup screen

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Zustand v5 double-call syntax: create<T>()(devtools(immer(...)))"
    - "devtools outer, immer inner middleware stack"
    - "Resource clamping via inline clamp helper in applyStateUpdate"
    - "Team matching by id string, not array index"
    - "Vanilla store access pattern (useGameStore.getState()) in tests"
    - "vi.mock('zustand') + __mocks__/zustand.ts for automatic afterEach reset"

key-files:
  created:
    - src/lib/gameStore.ts
    - src/lib/gameStore.test.ts
    - __mocks__/zustand.ts
  modified: []

key-decisions:
  - "Used != null (catches both null and undefined) for optional field guards in applyStateUpdate"
  - "Zustand v5 double-call mock wraps create<T>()() to register reset callbacks — single-call mock pattern does not work with v5"
  - "vi.mock('zustand') required explicitly in test file; __mocks__ directory alone insufficient for Vitest without automock: true in config"

patterns-established:
  - "Store reset: __mocks__/zustand.ts + vi.mock('zustand') + afterEach storeResetFns pattern"
  - "Test access: useGameStore.getState() for reads and action calls (no renderHook needed)"

# Metrics
duration: 3min 19s
completed: 2026-04-13
---

# Phase 1 Plan 3: Zustand Store Summary

**Zustand v5 game store with devtools+immer, all session state and actions, applyStateUpdate clamping (all resource fields), and 62 behavior tests with automatic afterEach isolation**

## Performance

- **Duration:** 3m 19s
- **Started:** 2026-04-13T18:56:37Z
- **Completed:** 2026-04-13T19:00:16Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Full `useGameStore` with all spec Section 8 fields and actions using Zustand v5 devtools+immer middleware
- `applyStateUpdate` with clamp safety boundary for all resource fields — prevents LLM hallucinations from corrupting game state
- Zustand v5-compatible test mock (`__mocks__/zustand.ts`) that registers reset functions and clears state between tests via `afterEach`
- 62 tests covering initial state, `initGame` (incl. idempotent re-init across scenarios), `resetGame`, clamping boundaries for all fields, team matching by id, and simple setters — all passing with zero cross-test pollution

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement Zustand store with all state and actions** - `5eaf0e3` (feat)
2. **Task 2: Create Zustand test mock and comprehensive store tests** - `80db30c` (test)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `src/lib/gameStore.ts` — Zustand store with all GameStore state, actions, and middleware
- `src/lib/gameStore.test.ts` — 62 behavior tests for store initialization, reset, clamping, and setters
- `__mocks__/zustand.ts` — Vitest-compatible Zustand v5 mock with storeResetFns for automatic isolation

## Decisions Made
- Used `!= null` (not `!== null`) for optional field guards in `applyStateUpdate` — catches both `null` and `undefined` from LLM-produced StateUpdate payloads
- Zustand v5 double-call pattern (`create<T>()()`) required a new mock structure — the standard single-call mock from the official docs fails at `store.getState()` because `actualCreate<T>()` returns a factory function, not a store
- `vi.mock('zustand')` must be explicit in each test file; Vitest does not auto-apply `__mocks__/` without `automock: true` in vite.config.ts (avoided adding global automock to prevent side effects on edipConfig tests)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Zustand v5 mock incompatibility with double-call syntax**
- **Found during:** Task 2 (Zustand test mock creation)
- **Issue:** Official Zustand `__mocks__/zustand.ts` pattern uses `actualCreate(stateCreator)` (single-call), but our store uses `create<GameStore>()()` (v5 double-call). `actualCreate()` returns a factory function, not a store — calling `.getState()` on it throws `TypeError: store.getState is not a function`
- **Fix:** Rewrote mock to use double-call pattern: `originalCreate<T>()(stateCreator)`, wrapping the inner factory so `getState()` is available for snapshot capture
- **Files modified:** `__mocks__/zustand.ts`
- **Verification:** All 62 tests pass; zero cross-test pollution confirmed by running full suite (113 tests across 2 files)
- **Committed in:** `80db30c` (Task 2 commit)

**2. [Rule 3 - Blocking] vi.mock required for Vitest mock resolution**
- **Found during:** Task 2 (first test run)
- **Issue:** `__mocks__/zustand.ts` was not picked up automatically by Vitest — `afterEach` reset not running, causing `addMessage` state to leak into `addMessages` test
- **Fix:** Added `vi.mock('zustand')` at top of `gameStore.test.ts`
- **Files modified:** `src/lib/gameStore.test.ts`
- **Verification:** All 62 tests pass with no state pollution; prior test state correctly reset between each `it` block
- **Committed in:** `80db30c` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes required for test isolation correctness. The mock rewrite is a direct consequence of Zustand v5's API change. No scope creep.

## Issues Encountered
- Zustand v5 `create<T>()()` double-call syntax broke the standard mock pattern from the official docs — required understanding that `actualCreate<T>()` in v5 returns a curried factory, not a store instance

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Store is the complete session state layer. All UI components and backend services can now import `useGameStore`
- `applyStateUpdate` is production-ready with clamping — backend (Phase 2) can parse LLM JSON and call this without risk of out-of-range values
- `llmHistory` / `appendHistory` ready for Phase 6 LLM wiring
- `configJson` / `briefText` fields ready for Phase 7 config generation

---
*Phase: 01-foundation*
*Completed: 2026-04-13*
