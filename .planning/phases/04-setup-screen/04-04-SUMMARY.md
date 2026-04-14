---
phase: 04-setup-screen
plan: "04"
subsystem: ui
tags: [react, react-router, zustand, vitest, testing-library, json-validation]

# Dependency graph
requires:
  - phase: 04-01
    provides: GuardedGameScreen null-state redirect in App.tsx
  - phase: 04-03
    provides: LoadConfigPanel with debounced parse, JsonEditor gutter, Launch buttons
provides:
  - Polished inline validation error block (border, bg, line/col, message)
  - Disabled-not-hidden Launch buttons with tooltip when JSON is invalid
  - useRef-based lastValidScenarioCount to preserve button count across invalid states
  - AppRoutes split from App.tsx for test-friendly routing
  - Two regression tests: disabled-Launch-on-invalid-JSON, /game guard redirect
  - Human-verified Phase 4 end-to-end acceptance walkthrough (9 steps)
affects: [05-game-screen, 07-config-generation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useRef for last-known-valid derived count — avoids hiding UI elements during transient invalid states"
    - "AppRoutes exported separately from App — route table has no Router wrapper, enabling MemoryRouter in tests"
    - "vi.useFakeTimers() + vi.advanceTimersByTime(350) for deterministic debounce testing"

key-files:
  created:
    - src/components/setup/LoadConfigPanel.test.tsx
  modified:
    - src/components/setup/LoadConfigPanel.tsx
    - src/App.tsx

key-decisions:
  - "Launch buttons are disabled (not hidden) when JSON is invalid — aligns with CONTEXT.md locked decision; buttons disappearing was the 04-03 starting point that this plan corrects"
  - "useRef (not useState) for lastValidScenarioCount — value is purely for rendering, not reactive; avoids unnecessary re-renders"
  - "AppRoutes split chosen (option a) over RequireGameState extraction (option b) — exposes the full route table to tests, giving broader coverage with one component import"
  - "Error alert placed below JsonEditor (not above) — flex column natural read order: editor, then error, then buttons"

patterns-established:
  - "Error alert pattern: role=alert div with crisis-colour border/bg, semibold title, message body, line/col footer"
  - "Disabled button pattern: disabled + aria-disabled + title tooltip + cursor-not-allowed + muted colour treatment"

# Metrics
duration: ~5min
completed: 2026-04-14
---

# Phase 4 Plan 04: Validation Polish Summary

**Structured JSON error alert with line/col, disabled-not-hidden Launch buttons via useRef scenario count, AppRoutes split for test-friendly routing, and 9-step human-verified Phase 4 acceptance**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-14
- **Completed:** 2026-04-14
- **Tasks:** 2 auto + 1 checkpoint (human-verify)
- **Files modified:** 3

## Accomplishments

- Replaced one-liner error `<p>` with a structured `role="alert"` block showing error title, message, and line/col
- Changed Launch buttons from conditionally-hidden to always-rendered-but-disabled when JSON is invalid, using `useRef` to persist last valid scenario count
- Split `AppRoutes` out of `App.tsx` (no Router wrapper) so tests can import it under `MemoryRouter`
- Added two regression tests covering the disabled-Launch behaviour and the `/game` null-state guard redirect
- Human walkthrough confirmed all 9 Phase 4 acceptance steps

## Task Commits

1. **Task 1: Polish validation error UI and disable Launch buttons** - `1909720` (feat)
2. **Task 2: Add guard redirect and disabled-Launch tests** - `2430242` (test)
3. **Task 3: Manual Phase 4 acceptance walkthrough** - (checkpoint, no code change — user approved)

## Files Created/Modified

- `src/components/setup/LoadConfigPanel.tsx` — Structured error alert block, disabled Launch buttons, `useRef` lastValidScenarioCount
- `src/App.tsx` — Extracted `AppRoutes` exported component; `App` delegates to it; `GuardedGameScreen` unchanged
- `src/components/setup/LoadConfigPanel.test.tsx` — Two tests: disabled-Launch-on-invalid and /game guard redirect

## Final Error-Alert Markup

```tsx
{parseResult && !parseResult.ok && (
  <div
    role="alert"
    className="rounded-md border border-[var(--color-category-crisis)]/50 bg-[var(--color-category-crisis)]/10 p-3"
  >
    <div className="text-sm font-semibold text-[var(--color-category-crisis)]">
      JSON parse error
    </div>
    <div className="mt-1 text-sm text-[var(--color-text-primary)]">
      {parseResult.error.message}
    </div>
    <div className="mt-1 text-xs text-[var(--color-text-secondary)]">
      Line {parseResult.error.line}, column {parseResult.error.col}
    </div>
  </div>
)}
```

Placed directly below `<JsonEditor>` in the left column flex stack.

## Refactor Choice: AppRoutes Split (Option A)

`App.tsx` now exports `AppRoutes` as a named component containing `<Routes>` with no Router wrapper. `App` (default export) simply renders `<AppRoutes />`. `main.tsx` wraps in `<BrowserRouter>` as before.

This lets the guard test import `AppRoutes` directly under `<MemoryRouter initialEntries={['/game']}>` without any BrowserRouter conflict, and gives broader route-table coverage than isolating only `RequireGameState`.

## Test Execution Output

```
pnpm test src/components/setup/LoadConfigPanel.test.tsx --reporter=verbose

 RUN  v4.1.4 C:/KVWarGame

 ✓ src/components/setup/LoadConfigPanel.test.tsx > LoadConfigPanel > disables Launch buttons when JSON is invalid 126ms
 ✓ src/components/setup/LoadConfigPanel.test.tsx > AppRoutes > redirects /game to /setup when gameState is null 8ms

 Test Files  1 passed (1)
      Tests  2 passed (2)
   Start at  21:28:30
   Duration  1.30s (transform 134ms, setup 73ms, import 275ms, tests 136ms, environment 670ms)
```

## Manual Walkthrough — Phase 4 Acceptance (Task 3)

All 9 steps confirmed approved by user:

1. **Home screen, two paths visible** — Both cards render; "Generate from Brief" dimmed with Phase 7 badge; clicking shows inline message without screen change.
2. **Load Config opens pre-populated** — JSON appears matching `EDIP_CONFIG`; scenario summary shows both scenarios.
3. **Live parse** — Editing `"name"` value updates summary heading within 300ms.
4. **Launch works** — "Launch Scenario 1" navigates to `/game`; `gameState.scenarioIndex === 0`, `round === 1` in DevTools.
5. **Browser back returns to setup with state intact** — URL `/setup`, JSON edits preserved.
6. **Invalid JSON disables Launch (visibly)** — Delete a `}`: error alert block appears (bordered, line/col), gutter highlights, Launch buttons grey out and are `disabled`. Hover tooltip shows.
7. **Recovery** — Restore `}`: alert disappears, Launch re-enables within 300ms.
8. **Direct /game guard** — New tab to `http://localhost:5173/game` redirects to `/setup`; back button does NOT bounce back (Navigate `replace`).
9. **Catch-all guard** — `/anything-else` redirects to `/setup`.

No deviations from expected behaviour. Console clean.

## Phase 4 Closeout — Success Criteria Status

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Home screen with Load Config and Generate from Brief paths | DONE (04-02) |
| 2 | Load Config panel with live JSON editing and scenario summary | DONE (04-03) |
| 3 | Launch scenario populates Zustand store and navigates to `/game` | DONE (04-03) |
| 4 | Malformed JSON shows clear inline validation error; Launch buttons disabled until JSON valid | DONE (04-04) |
| 5 | Direct `/game` navigation without launched scenario redirects to `/setup`; covered by automated test | DONE (04-04) |

**Phase 4 ships.**

## Decisions Made

1. **Disabled-not-hidden Launch buttons** — CONTEXT.md locked decision. 04-03's initial implementation hid the buttons; this plan corrected that to always-visible-but-disabled, matching the spec.

2. **useRef for lastValidScenarioCount** — On invalid JSON, the component needs to know how many buttons to render (so they appear disabled rather than disappearing). Using `useRef` avoids an extra reactive render cycle since the value is display-only, not state that drives other logic.

3. **AppRoutes split (option a)** — Extracting the route table as a no-Router component makes the guard testable with any Router wrapper. The alternative (isolated RequireGameState component) would only test one guard, not the full routing behaviour.

4. **Error alert below editor** — Natural read order in the flex column: editor content first, then error context, then action buttons. Placing it above would require the user to scroll past the alert to see the broken line.

## Deviations from Plan

None — plan executed exactly as written. The `AppRoutes` refactor was explicitly offered as option (a) in the plan's Task 2 action block; it is not a deviation.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 4 setup screen complete and human-verified
- `AppRoutes` export available for any future routing tests in Phase 5+
- `LoadConfigPanel` error UX meets production quality bar — no further polish planned
- Phase 5 (Game Screen) can proceed; it imports `GameScreen` which currently renders a placeholder

---
*Phase: 04-setup-screen*
*Completed: 2026-04-14*
