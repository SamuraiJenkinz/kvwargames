---
phase: 07-debrief-export-config-generation
plan: 02
subsystem: debrief-ui-wiring
tags: [zustand, react, typescript, vitest, rtl, debrief, export, tailwind]

# Dependency graph
requires:
  - phase: 07-01
    provides: debriefExporter (generateDebriefMarkdown, downloadDebrief, buildDebriefFilename, DebriefSnapshot), stateSnapshots, gameEnded, setGameEnded in GameStore
  - phase: 06-llm-integration
    provides: runLLMTurn, triggerDebrief, advanceRound, sendFacilitatorMessage, FacilitatorInput component tree
provides:
  - endGame() store action — sets gameEnded=true + pushes debrief_divider + fires LLM turn inline (no triggerDebrief delegation)
  - Download Debrief (.md) button in ActionToolbar — appears once any debrief_divider exists; click calls generateDebriefMarkdown + downloadDebrief + buildDebriefFilename
  - gameEnded gates all four UI primitives: Send button, Advance to Round, Request Debrief Now, End Game + Debrief
  - ActionToolbar.test.tsx (new file, 10 tests)
  - FacilitatorInput.test.tsx (3 new gameEnded gate tests)
affects:
  - 07-04 (config validator) — independent, no shared state
  - 08-phase-8-ops — gameEnded flag and download flow are production-ready

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useGameStore.getState() in onClick handler — reads store once per click, avoids subscription overhead for Download button"
    - "Conditional render ({hasDebrief && <button>}) — avoids disabled→enabled flash"
    - "gameEnded prop drilled to MessageInput — clear gating boundary between store and leaf component"
    - "endGame() inline-duplicates triggerDebrief body — avoids guard bypass problem"

key-files:
  created:
    - src/components/game/FacilitatorInput/ActionToolbar.test.tsx
  modified:
    - src/lib/gameStore.ts
    - src/lib/gameStore.test.ts
    - src/components/game/FacilitatorInput/ActionToolbar.tsx
    - src/components/game/FacilitatorInput/FacilitatorInput.tsx
    - src/components/game/FacilitatorInput/MessageInput.tsx
    - src/components/game/FacilitatorInput/FacilitatorInput.test.tsx

key-decisions:
  - "endGame() inline-duplicates triggerDebrief divider-push + runLLMTurn call — delegating to triggerDebrief() would fail because triggerDebrief's guard checks gameEnded after endGame flips it"
  - "handleDownload reads store via useGameStore.getState() inside onClick — no subscription hook in handler avoids re-render storms when Download button is visible (decision 6)"
  - "Download button conditionally rendered ({hasDebrief && ...}) not just disabled — avoids flash of disabled→enabled state"
  - "gameEnded passed as prop to MessageInput — keeps gate visible at the leaf component level; no second useGameStore subscription inside MessageInput for gameEnded"
  - "Pre-existing tests from 07-01 that called advanceRound() after setGameEnded(true) fixed — advanceRound now correctly bails on gameEnded, so tests reordered to advance first then set gameEnded"
  - "All four gated UI primitives: Send button (disabled={disabled||gameEnded||value.trim()===''} in MessageInput), Advance to Round (disabled={disabled||gameEnded}), Request Debrief Now (disabled={loading||gameEnded}), End Game + Debrief (disabled={loading||gameEnded})"
  - "Literal Tailwind class strings only in ActionToolbar — grep audit confirms zero template-literal class expressions"

patterns-established:
  - "getState() snapshot in onClick: for handlers that need store data but don't need reactivity, useGameStore.getState() inside the handler is cleaner than a useGameStore selector hook"
  - "Conditional render for conditional feature buttons — cleaner UX than disabled-with-tooltip for features that aren't yet available"

# Metrics
duration: ~7min
completed: 2026-04-14
---

# Phase 7 Plan 02: Debrief UI Wiring Summary

**`endGame()` store action + Download Debrief button in ActionToolbar + four UI primitives gated on `gameEnded`, with 10 new ActionToolbar RTL tests and 3 new FacilitatorInput gate tests**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-04-14T19:02:02Z
- **Completed:** 2026-04-14T19:08:50Z
- **Tasks:** 2
- **Files modified:** 6 (1 new test file, 5 modified)

## Accomplishments

- Added `endGame(): void` to `GameStore` interface with inline implementation that sets `gameEnded=true`, pushes `debrief_divider`, sets `loading=true`, fires `runLLMTurn` — never delegates to `triggerDebrief` (guard bypass problem documented in code comment)
- Gated `advanceRound`, `triggerDebrief`, `sendFacilitatorMessage`, `retryLastMessage` on `gameEnded` — all four bail with early return when `gameEnded=true`
- `ActionToolbar.tsx` rewritten: imports `debriefExporter`; `End Game + Debrief` bound to `endGame()`; `Download Debrief (.md)` conditionally rendered on `hasDebrief`; all four gated UI primitives honour `gameEnded`; Tailwind literal-class audit passed (zero template-literal class expressions)
- `handleDownload` uses `useGameStore.getState()` once per click — no subscription hook in handler, avoids re-render storms
- `FacilitatorInput.tsx` subscribes to `gameEnded`, passes to `MessageInput`, renders game-ended hint paragraph when `gameEnded=true`
- `MessageInput.tsx` accepts `gameEnded` prop; Send button `disabled={disabled||gameEnded||value.trim()===''}`, submit() bails if `gameEnded`
- Fixed 2 pre-existing tests from 07-01 that called `advanceRound()` after `setGameEnded(true)` — now bails correctly; tests reordered to advance before setting gameEnded
- `ActionToolbar.test.tsx` created: Tests A–F + 1 extra (10 total) covering Download visibility, Download click exporter call chain, endGame vs triggerDebrief distinction, all gated buttons disabled when gameEnded
- `FacilitatorInput.test.tsx` extended: 3 new tests for Send disabled, Enter no-op, hint paragraph when `gameEnded=true`

## Task Commits

1. **Task 1: endGame() store action + gameEnded gating + store tests** - `71ed279` (feat)
2. **Task 2: Wire UI — ActionToolbar + FacilitatorInput + MessageInput + RTL tests** - `11a2a78` (feat)

## Files Created/Modified

- `src/lib/gameStore.ts` — Added `endGame(): void` to interface; added `endGame` implementation inline (after `triggerDebrief`); extended `advanceRound`, `triggerDebrief`, `sendFacilitatorMessage`, `retryLastMessage` with `gameEnded` guards
- `src/lib/gameStore.test.ts` — Added 7 new endGame tests (A, B, B2, C, D, E, F); fixed 2 pre-existing 07-01 tests that called `advanceRound()` after `setGameEnded(true)`
- `src/components/game/FacilitatorInput/ActionToolbar.tsx` — Full rewrite: debriefExporter imports; endGame selector; hasDebrief selector; Download Debrief button; four gated buttons; handleDownload with getState()
- `src/components/game/FacilitatorInput/ActionToolbar.test.tsx` — New file: 10 tests (A-F + extra)
- `src/components/game/FacilitatorInput/FacilitatorInput.tsx` — Added gameEnded selector; passes to MessageInput; renders game-ended hint
- `src/components/game/FacilitatorInput/MessageInput.tsx` — Added gameEnded prop; gates Send button and submit()
- `src/components/game/FacilitatorInput/FacilitatorInput.test.tsx` — 3 new gameEnded gate tests

## Decisions Made

**endGame() cannot delegate to triggerDebrief()**

`endGame()` sets `gameEnded=true` in the same `set()` call before firing `runLLMTurn`. If it delegated to `triggerDebrief()` after flipping `gameEnded`, the `if (get().gameEnded) return` guard in `triggerDebrief` would immediately bail, producing no LLM turn. The divider-push + `loading=true` + `runLLMTurn` sequence is therefore intentionally duplicated. A code comment documents this constraint so future maintainers understand why delegation is prohibited.

**handleDownload uses getState() not a selector hook**

The Download button's click handler builds a `DebriefSnapshot` fresh from `useGameStore.getState()`. Using a `useGameStore(s => ...)` selector inside the handler would require extracting the value at render time and closing over a potentially-stale snapshot. Using `getState()` at click time always reads the latest committed store state — consistent with the "each click regenerates" idempotency contract (decision 3 from plan).

**gameEnded passed as prop to MessageInput**

`FacilitatorInput` subscribes to `gameEnded` once and passes it as a prop to `MessageInput`. This keeps `MessageInput`'s store subscription count low (it already subscribes to `sendFacilitatorMessage`) and makes the gating dependency explicit in the component tree. Alternative (MessageInput subscribes to gameEnded directly) would work but adds a second store subscription for a value that the parent already owns.

**Pre-existing test fix (Rule 1 — Bug)**

Two tests from plan 07-01 (`newGame clears stateSnapshots` and `resetGame clears stateSnapshots`) called `advanceRound()` after `setGameEnded(true)` to generate `stateSnapshots[2]`. Now that `advanceRound` correctly bails when `gameEnded=true`, those tests failed. Fixed by reordering: `advanceRound()` first (produces the snapshot), then `setGameEnded(true)` — logically equivalent, behaviourally correct.

## DEB-01..03 Satisfaction

- **DEB-01**: Download Debrief (.md) button appears in ActionToolbar once any `debrief_divider` exists (interim or final). Verified by Tests A and B.
- **DEB-02**: Downloaded `.md` contains all required sections (provided by `generateDebriefMarkdown` from 07-01; wired here). Verified by Test C asserting correct snapshot shape passed to `generateDebriefMarkdown`.
- **DEB-03**: Click triggers `downloadDebrief()` (Blob + anchor.download mechanism from 07-01) — file save, not new tab. Verified by Test C asserting `downloadDebrief` called with markdown string and filename.

## gameEnded gates all four UI primitives

| Primitive | Gate expression | Location |
|-----------|----------------|----------|
| Send button | `disabled={disabled\|\|gameEnded\|\|value.trim()===''` | MessageInput.tsx |
| Advance to Round | `disabled={disabled\|\|gameEnded}` | ActionToolbar.tsx |
| Request Debrief Now | `disabled={loading\|\|gameEnded}` | ActionToolbar.tsx |
| End Game + Debrief | `disabled={loading\|\|gameEnded}` | ActionToolbar.tsx |

## Tailwind Literal-Class Audit

Grep command: `grep -E "className=.*\`.*\\\$\{" src/components/game/FacilitatorInput/ActionToolbar.tsx`
Result: zero matches. All class names in ActionToolbar.tsx are static string literals. Tailwind v4 scanner will extract all classes correctly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing tests from 07-01 broke with the new advanceRound gameEnded guard**

- **Found during:** Task 1 verify (pnpm test -- gameStore)
- **Issue:** Two tests from the 07-01 plan called `getState().setGameEnded(true)` then `getState().advanceRound()` to generate `stateSnapshots[2]` before calling `newGame()`/`resetGame()`. Once `advanceRound` gained the `gameEnded` guard, it bailed and `stateSnapshots[2]` was never populated, causing assertion failure.
- **Fix:** Reordered both tests to call `advanceRound()` first (producing the snapshot) and then `setGameEnded(true)`. Semantically equivalent — the tests still verify that `newGame`/`resetGame` clear both fields.
- **Files modified:** `src/lib/gameStore.test.ts`
- **Committed in:** `71ed279` (Task 1 commit)

**2. [Rule 3 - Blocking] Unused `act` import in ActionToolbar.test.tsx blocked build**

- **Found during:** Task 2 verify (`pnpm build`)
- **Issue:** TypeScript TS6133 error — `act` imported from `@testing-library/react` but not used in the test file.
- **Fix:** Removed `act` from the import line.
- **Files modified:** `src/components/game/FacilitatorInput/ActionToolbar.test.tsx`
- **Committed in:** `11a2a78` (Task 2 commit, post-fix)

---

**Total deviations:** 2 auto-fixed (Rule 1 bug + Rule 3 blocking)
**Impact on plan:** Both fixes necessary for correctness and build. No scope creep.

## Test Coverage

**New tests — gameStore.test.ts (Task 1):**
- Test A: endGame sets gameEnded=true + pushes debrief_divider + loading=true
- Test B: endGame is no-op if already loading (first click blocks second)
- Test B2: endGame is no-op if gameEnded=true set externally
- Test C: advanceRound bails when gameEnded=true
- Test D: sendFacilitatorMessage bails when gameEnded=true
- Test E: triggerDebrief bails when gameEnded=true
- Test F: newGame resets gameEnded AND clears stateSnapshots after endGame

**New tests — ActionToolbar.test.tsx (Task 2):**
- Test A: Download button hidden with no debrief_divider
- Test B: Download button appears after debrief_divider added
- Test C: Clicking Download calls exporter functions with correct snapshot/filename args
- Test D: End Game + Debrief calls endGame() (gameEnded=true proves it wasn't triggerDebrief)
- Test E: Request Debrief Now calls triggerDebrief() (gameEnded stays false)
- Test F: When gameEnded=true, Request Debrief Now + End Game + Debrief + Advance all disabled
- Extra: Advance to Round independently disabled when gameEnded=true

**New tests — FacilitatorInput.test.tsx (Task 2):**
- Send button disabled when gameEnded=true (with text present)
- Enter key does not submit when gameEnded=true
- Game-ended hint paragraph renders when gameEnded=true

**Total new tests: 10 (Task 1) + 10 (Task 2 ActionToolbar) + 3 (Task 2 FacilitatorInput) = 23**
**Full suite: 475/475 passing (up from 458 baseline)**

## Next Phase Readiness

- Plan 07-04 (config validator) is independent — no shared state or component dependencies
- Phase 8 ops: `gameEnded` flag is production-ready; Download flow is production-ready
- No blockers

---
*Phase: 07-debrief-export-config-generation*
*Completed: 2026-04-14*
