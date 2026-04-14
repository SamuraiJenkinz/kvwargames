---
phase: 05-game-screen-layout
plan: "01"
subsystem: ui
tags: [zustand, typescript, mock-data, game-state, chat-messages]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: TypeScript types in src/types/game.ts (GameState, ChatMessage, MessageType, PersonaId)
  - phase: 04-setup-screen
    provides: Zustand store with public actions setGameConfig, setGameState, addMessages, setLoading
provides:
  - src/mocks/mockGameState.ts — MOCK_GAME_STATE (Round 2 mid-game GameState) and MOCK_MESSAGES (ChatMessage[] with all 5 MessageTypes)
  - src/mocks/seedMockState.ts — seedMockState() function wiring mock data into the Zustand store
affects:
  - 05-03-game-screen-shell (call site for seedMockState in GuardedGameScreen)
  - 05-02 through 05-07 (all game screen components render against this mock)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dev-only mock module pattern: data module (mockGameState.ts) + seeder function (seedMockState.ts) — seeder is unconditional, DEV guard at call site"
    - "useGameStore.getState() for store writes outside React components (no hook call in plain function)"

key-files:
  created:
    - src/mocks/mockGameState.ts
    - src/mocks/seedMockState.ts
  modified: []

key-decisions:
  - "DEV guard excluded from seedMockState() — gate lives at call site (GuardedGameScreen in 05-03), not in seeder, for testability"
  - "EDIP_CONFIG cast as GameConfig in seeder — required because EDIP_CONFIG is declared with 'as const satisfies GameConfig' giving a narrower literal type"
  - "No chen message after Round 2 divider — intentional; tests that persona indicator dots render 2 lit / 1 dim for chen"

patterns-established:
  - "Mock files live in src/mocks/ and are never imported from production code paths"
  - "Mock state exercises edge cases: STRAINED (pc=1) and CRISIS (pc=0) teams, partial persona set after last round_divider"

# Metrics
duration: ~2min
completed: 2026-04-14
---

# Phase 5 Plan 01: Mock Game State Summary

**Dev-only mock data module with Round 2 mid-game GameState (STRAINED+CRISIS teams) and all 5 MessageTypes, plus a Zustand store seeder that sets loading=true for persona loading indicator testing**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-14T11:07:08Z
- **Completed:** 2026-04-14T11:08:27Z
- **Tasks:** 2
- **Files modified:** 2 created

## Accomplishments

- Created `MOCK_GAME_STATE` covering Round 2 mid-game with crisisSeverity=3, edipLegitimacy=+1, STRAINED team (pc=1) and CRISIS team (pc=0) for PC badge variant coverage
- Created `MOCK_MESSAGES` with all 5 MessageTypes (persona x5 across kent/finch/chen, facilitator, error, round_divider x2, debrief_divider) with intentional absence of chen post-Round-2-divider
- Created `seedMockState()` seeder wiring mock data into Zustand store via public actions + sets loading=true

## Task Commits

Each task was committed atomically:

1. **Task 1: Create mock data module** - `62c1ea9` (feat)
2. **Task 2: Create seeder function** - `379feb3` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `src/mocks/mockGameState.ts` — MOCK_GAME_STATE typed as GameState + MOCK_MESSAGES typed as ChatMessage[]
- `src/mocks/seedMockState.ts` — seedMockState() calling setGameConfig/setGameState/addMessages/setLoading

## Decisions Made

- DEV guard excluded from `seedMockState()` — gate lives at call site (GuardedGameScreen in 05-03) to keep seeder testable in isolation
- `EDIP_CONFIG as GameConfig` type assertion required because `as const satisfies GameConfig` gives a narrower literal type incompatible with `setGameConfig(cfg: GameConfig)` parameter
- No chen message after the Round 2 `round_divider` — intentional design to exercise the 2-lit/1-dim persona indicator dot state

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `src/mocks/mockGameState.ts` and `src/mocks/seedMockState.ts` are ready for 05-03 to wire `seedMockState()` into GuardedGameScreen behind `import.meta.env.DEV` guard
- All Phase 5 component plans (05-02 through 05-07) can reference MOCK_GAME_STATE and MOCK_MESSAGES as the canonical mock data source
- No blockers

---
*Phase: 05-game-screen-layout*
*Completed: 2026-04-14*
