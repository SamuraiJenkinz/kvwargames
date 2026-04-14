---
phase: 05-game-screen-layout
plan: 07
subsystem: facilitator-input
tags: [react, typescript, zustand, testing, keyboard-interaction, ui]

dependency-graph:
  requires: [05-02, 05-03]
  provides: [FacilitatorInput, ActionToolbar, MessageInput]
  affects: [05-06, 06-xx]

tech-stack:
  added:
    - "@testing-library/user-event@14.6.1"
  patterns:
    - insertRef bridge (useRef for insert-at-cursor without lifting state)
    - registerInsert prop pattern (useEffect closure capture)
    - dynamic button label from store-derived nextRound

key-files:
  created:
    - src/components/game/FacilitatorInput/ActionToolbar.tsx
    - src/components/game/FacilitatorInput/MessageInput.tsx
    - src/components/game/FacilitatorInput/FacilitatorInput.test.tsx
  modified:
    - src/components/game/FacilitatorInput/FacilitatorInput.tsx
    - package.json
    - pnpm-lock.yaml

decisions:
  - "@testing-library/user-event installed via pnpm — npm failed (workspace: protocol in pnpm-lock.yaml). pnpm is the canonical package manager for this project."
  - "insertRef stores insert-at-cursor closure from MessageInput — parent (FacilitatorInput) never holds textarea value state; only the function reference. This avoids prop-drilling textarea value up to container level."
  - "registerInsert prop uses useEffect to capture the closure — effect dependency is [registerInsert] (stable reference from parent's inline function). The ref assignment happens once on mount."
  - "Quick-insert selects use uncontrolled onChange pattern (e.target.value = '' reset) rather than React-controlled value state — avoids extra state variable and re-render for a non-critical UI element."
  - "userEvent.setup() used instead of fireEvent for keyboard tests — correctly simulates browser keyboard event sequence including beforeinput/input/keydown/keyup; required for Shift+Enter newline test to work."

metrics:
  duration: "3m 37s"
  completed: "2026-04-14"
  tests-added: 15
  tests-total: 212
---

# Phase 5 Plan 07: FacilitatorInput Summary

**One-liner:** Two-row facilitator bar with dynamic Advance/Debrief buttons, insert-at-cursor quick-select, and Enter/Shift+Enter textarea wired to Zustand stubs.

## What Was Built

Replaced the Plan 05-03 `FacilitatorInput` stub with a fully-functional two-row input bar:

### ActionToolbar (`ActionToolbar.tsx`)
- **Advance to Round N+1** button: dynamic label computed from `(gameState?.round ?? 0) + 1`. Dispatches `advanceRound()`.
- **Trigger Debrief** button: covers both "End Game + Debrief" and "Request Debrief Now" from LAYOUT-04 under CONTEXT.md scope narrowing. Dispatches `triggerDebrief()`.
- **Cards quick-insert select**: maps `gameConfig.cards` to option elements; onChange calls `onInsert(value)` and resets select to "".
- **National Actions quick-insert select**: same pattern for `gameConfig.nationalActions`.
- All controls use `disabled:opacity-50 disabled:cursor-not-allowed` when `disabled=true`.

### MessageInput (`MessageInput.tsx`)
- Auto-growing `<textarea>` (`min-h-[40px] max-h-[120px] resize-none`) with `rows={1}`.
- **Enter submits**: `handleKeyDown` calls `submit()` on Enter (no shiftKey), prevents default.
- **Shift+Enter newlines**: default browser behaviour (not prevented).
- **Empty/whitespace no-op**: `submit()` returns early when `value.trim() === ''`.
- **Send button**: additionally disabled when `value.trim() === ''`.
- **registerInsert prop**: `useEffect` captures an insert-at-cursor closure and calls `registerInsert(fn)`. The closure uses `textareaRef.current.selectionStart/End` for cursor-aware insertion.

### FacilitatorInput (`FacilitatorInput.tsx`)
- Two-row container (`space-y-2`): ActionToolbar on top, MessageInput on bottom.
- Reads `loading` from store; passes as `disabled` prop to both children.
- `insertRef` (type `((text: string) => void) | null`) stored in `useRef` — bridges toolbar `onInsert` callback → MessageInput insert-at-cursor without lifting textarea value state.

## Tests (`FacilitatorInput.test.tsx`)

15 tests covering:
- Layout presence (container, textarea, Send button)
- Dynamic label ("Advance to Round 3" when round=2)
- Click Advance → round increments, 2 messages added, label updates to Round 4
- Click Trigger Debrief → 2 messages added, debrief_divider has label "DEBRIEF"
- Enter submits → message in store, textarea cleared, `loading=true`
- Shift+Enter → value becomes `"hello\n"`, no submission
- Empty/whitespace → Send button disabled; Enter is no-op
- `loading=true` → textarea, Advance, Debrief, and Send all disabled
- Quick-insert → card select value appears in textarea

All 212 tests pass (15 new + 197 existing).

## LAYOUT-04 Coverage

REQUIREMENTS.md LAYOUT-04 specifies three buttons. CONTEXT.md intentionally narrows Phase 5 scope to two stub buttons:
- Button 1: `Advance to Round N+1` → covers "Advance to Round N"
- Button 2: `Trigger Debrief` → covers both "End Game + Debrief" and "Request Debrief Now"

Phase verifier should treat LAYOUT-04 as satisfied under this two-button Phase 5 scope.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed @testing-library/user-event**

- **Found during:** Task 2 (test authoring)
- **Issue:** Plan specified `@testing-library/user-event` for keyboard interaction tests (Shift+Enter newline test requires proper keyboard event simulation). Package not present in node_modules.
- **Fix:** Installed `@testing-library/user-event@14.6.1` via pnpm. npm install failed due to `workspace:` protocol in pnpm-lock.yaml — pnpm confirmed as canonical package manager.
- **Files modified:** `package.json`, `pnpm-lock.yaml`
- **Commit:** b60681c

## Next Phase Readiness

Phase 5 plan 07 is the final wave-3 plan. Phase 5 complete (7/7 plans):
- 05-01: Mock data seeder
- 05-02: Store stubs
- 05-03: GameScreen shell
- 05-04: ChatFeed
- 05-05: ReferencePanel
- 05-06: StatePanel (parallel)
- 05-07: FacilitatorInput (this plan)

Phase 6 (LLM wiring) can now proceed with stable component contracts.
