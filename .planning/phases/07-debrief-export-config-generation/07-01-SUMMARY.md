---
phase: 07-debrief-export-config-generation
plan: 01
subsystem: debrief-export
tags: [zustand, immer, markdown, blob-api, typescript, vitest]

# Dependency graph
requires:
  - phase: 06-llm-integration
    provides: GameStore with messages, gameState, LLM turn orchestration
  - phase: 01-foundation
    provides: GameState, ChatMessage, GameConfig TypeScript interfaces
provides:
  - generateDebriefMarkdown() — pure markdown formatter from DebriefSnapshot
  - downloadDebrief() — imperative Blob + anchor.download file-save (Firefox-safe)
  - toKebabFilename() + buildDebriefFilename() — filename helpers
  - DebriefSnapshot interface — plain snapshot type for debrief export
  - stateSnapshots: Record<number, GameState> in GameStore
  - gameEnded: boolean in GameStore (session UI state, NOT GameState)
  - setStateSnapshot(round, state) action
  - setGameEnded(ended) action
affects:
  - 07-02 (wires Download Debrief button + End Game + Debrief semantics)
  - 08-phase-8-ops (may need gameEnded to disable send button)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "immer.current() for snapshot capture inside set() callbacks"
    - "structuredClone on post-set() plain state (not draft) for initGame seed"
    - "Blob + URL.createObjectURL + synthetic anchor.download for file save"
    - "setTimeout(fn, 0) for Firefox blob-read race prevention"
    - "reduce() for LAST-index scan (debrief_divider anchor)"
    - "vi.useFakeTimers() + vi.runAllTimers() to test deferred setTimeout"

key-files:
  created:
    - src/lib/debriefExporter.ts
    - src/lib/debriefExporter.test.ts
  modified:
    - src/lib/gameStore.ts
    - src/lib/gameStore.test.ts

key-decisions:
  - "stateSnapshots[N] = state at START of Round N (Option A keying). Seeded at initGame for N=1; captured inside advanceRound under newRound key AFTER round-advance mutations."
  - "gameEnded lives on GameStore (session UI state), NOT on GameState (simulation state). CONTEXT.md placement is overridden by this plan."
  - "## Debrief anchor = LAST debrief_divider via reduce() pattern — first-divider anchor wrongly swallows post-interim round content."
  - "initGame uses structuredClone(get().gameState) post-set() to seed stateSnapshots[1] — immer.current() only accepts draft proxies, not freshly assigned plain objects inside set()."
  - "advanceRound uses current(s.gameState) inside set() — at that point s.gameState IS a proxied draft, safe for immer.current()."
  - "PERSONA_META displayName for persona transcript rendering: 'Kent', 'Finch', 'Chen' (single name, not full surname)."
  - "ChatMessage carries no teamId field — team rendered as '—' in transcripts. Plan 07-02 may extend if needed."

patterns-established:
  - "Snapshot keying: stateSnapshots[N] = start-of-Round-N. No off-by-one. Consistent between store capture and exporter read."
  - "Debrief anchor: always last debrief_divider, never first. Implemented as messages.reduce() accumulating last index."
  - "Firefox blob safety: setTimeout(()=>URL.revokeObjectURL(url), 0) — always deferred one macrotask."

# Metrics
duration: 7min
completed: 2026-04-14
---

# Phase 7 Plan 01: Debrief Export Foundation Summary

**Pure `generateDebriefMarkdown()` formatter with last-divider anchor, `downloadDebrief()` Firefox-safe file save, and GameStore `stateSnapshots`/`gameEnded` slices with start-of-round-N keying validated by 36 new tests**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-04-14T12:47:33Z
- **Completed:** 2026-04-14T12:54:15Z
- **Tasks:** 2
- **Files modified:** 4 (2 new, 2 modified)

## Accomplishments

- Extended `GameStore` with `stateSnapshots: Record<number, GameState>`, `setStateSnapshot`, `gameEnded: boolean`, `setGameEnded` — session UI fields never on `GameState`
- `advanceRound` captures `stateSnapshots[newRound] = current(s.gameState)` AFTER round-advance mutations (Option A keying — start-of-round-N)
- `initGame` seeds `stateSnapshots[1]` via `structuredClone(get().gameState)` post-set() (plain state not draft — `immer.current()` would throw on newly assigned object)
- `debriefExporter.ts` delivers all 4 exports: `generateDebriefMarkdown`, `downloadDebrief`, `toKebabFilename`, `buildDebriefFilename`
- LAST-divider anchor proven by dedicated Group 3b test — interim debrief followed by round play followed by final debrief correctly excludes interim messages from Debrief section
- Firefox blob-read race handled via `setTimeout(() => URL.revokeObjectURL(url), 0)` — confirmed pre/post fake-timer assertions

## Task Commits

1. **Task 1: Extend gameStore with stateSnapshots, gameEnded** - `8d2f244` (feat)
2. **Task 2: Build debriefExporter.ts** - `3f10910` (feat)

**Plan metadata:** TBD (docs commit)

## Files Created/Modified

- `src/lib/gameStore.ts` — Added `import { current } from 'immer'`; added stateSnapshots/gameEnded interface fields, default values, setters, initGame seed, advanceRound capture, newGame/resetGame resets; renamed local `current` variable to `liveState` to avoid import shadow
- `src/lib/gameStore.test.ts` — 7 new tests: initGame seed, advanceRound Option-A keying (2 advances), DataCloneError guard, newGame clear, setGameEnded toggle, snapshot decoupling, resetGame clear
- `src/lib/debriefExporter.ts` — New file: DebriefSnapshot interface, toKebabFilename, buildDebriefFilename, generateDebriefMarkdown (7 sections), downloadDebrief
- `src/lib/debriefExporter.test.ts` — New file: 29 tests across 4 groups

## Decisions Made

**07-01: immer.current() requires draft proxy — initGame uses post-set structuredClone**

Inside `initGame`'s `set()` callback, `state.gameState` is assigned a freshly created plain object literal. Zustand/immer middleware wraps the *store root* as a draft, but a newly assigned sub-property is not yet re-proxied as a draft at assignment time. Calling `current(state.gameState)` throws `[Immer] 'current' expects a draft`. Fix: reset `stateSnapshots = {}` inside `set()`, then seed `stateSnapshots[1] = structuredClone(get().gameState)` in a second `set()` call after the first completes. `advanceRound` does NOT have this issue because `s.gameState` inside an existing `set()` callback IS a proxied draft.

**07-01: PERSONA_META displayName values are short names only**

`PERSONA_META.kent.displayName = 'Kent'` (not 'Kent Voss'). The plan's test example incorrectly stated `**Kent Voss` as the display name. Implementation uses the actual PERSONA_META value; tests assert on `**Kent (—):** Welcome.`.

**07-01: ChatMessage has no teamId field**

`ChatMessage` interface (types/game.ts) carries no `teamId` field. Persona transcript rendering uses `'—'` as the team code. Plan 07-02 may extend ChatMessage if persona-team mapping is needed for the debrief.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Unused `teamCode` variable in renderMessage caused TypeScript build error**

- **Found during:** Task 2 (build verification)
- **Issue:** `const teamCode = msg.text !== undefined ? '—' : '—'` was dead code — both branches identical and variable was unused. TypeScript TS6133 error blocked `pnpm build`.
- **Fix:** Removed the variable; replaced with direct `'—'` literal with a comment explaining no teamId field exists on ChatMessage.
- **Files modified:** `src/lib/debriefExporter.ts`
- **Committed in:** `3f10910` (Task 2 commit, post-fix)

**2. [Rule 1 - Bug] Local variable `current` in applyStateUpdate shadowed the `immer.current` import**

- **Found during:** Task 1 (after adding `import { current } from 'immer'`)
- **Issue:** `applyStateUpdate` had `const current = get().gameState` which shadows the module-level import. While TypeScript didn't error (the local shadows correctly in scope), it created misleading code.
- **Fix:** Renamed local variable to `liveState`.
- **Files modified:** `src/lib/gameStore.ts`
- **Committed in:** `8d2f244` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - bugs)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered

**immer.current() on freshly assigned plain object throws DataCloneError**

The plan prescribed seeding `stateSnapshots[1]` with `current(state.gameState)` inside `initGame`'s `set()` callback. This threw `[Immer] 'current' expects a draft, got: [object Object]` because the newly assigned `state.gameState` literal had not been re-proxied by Immer at that point. The RESEARCH.md mentioned both approaches (in-set and post-set); selected the post-set `structuredClone(get().gameState)` pattern which is safe (plain object from committed state). `advanceRound` correctly uses `current(s.gameState)` because `s.gameState` is a genuine draft proxy in that context.

## Test Coverage

- **Group 1 (toKebabFilename):** 5 tests — lowercase, strip/collapse, trim edges, fallback
- **Group 2 (buildDebriefFilename):** 3 tests — format, single-digit minutes, full game name kebab
- **Group 3 (generateDebriefMarkdown):** 13 tests — H1, round sections, snapshot keying (Round 2 Severity 1), transcript headers, GFM table, persona rendering, debrief section, appendix
- **Group 3b (last-divider anchor):** 1 test — two debrief_dividers, final-only in debrief section
- **Group 3c (no debrief):** 1 test — no-debrief notice
- **Group 4 (downloadDebrief):** 6 tests — Blob created, text/markdown type, anchor.download, click called, revoke deferred, revoke correct URL
- **gameStore Task 1 additions:** 7 tests — initGame seed, advanceRound 2-advance keying, DataCloneError guard, newGame clear, setGameEnded toggle, snapshot decoupling, resetGame clear

**Total new tests: 36**
**Full suite: 442/442 passing (up from 406 baseline)**

## Next Phase Readiness

- Plan 07-02 can immediately wire the "Download Debrief" button in ActionToolbar — `generateDebriefMarkdown` and `downloadDebrief` are ready
- Plan 07-02 can split `triggerDebrief` semantics (interim vs end-game sets `gameEnded = true`) — `setGameEnded` is ready
- `stateSnapshots` will be populated correctly by store at runtime — no off-by-one, keying contract locked in with tests
- No blockers for 07-02

---
*Phase: 07-debrief-export-config-generation*
*Completed: 2026-04-14*
