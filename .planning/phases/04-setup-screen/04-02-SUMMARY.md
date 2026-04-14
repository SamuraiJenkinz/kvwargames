---
phase: 04-setup-screen
plan: 02
subsystem: ui
tags: [react, typescript, tailwind, zustand, accessibility]

# Dependency graph
requires:
  - phase: 03-ui-design-system
    provides: Tailwind v4 @theme tokens (bg-bg-base, bg-bg-panel, text-text-primary, etc.) used for card layout
  - phase: 04-setup-screen/01
    provides: SetupScreen placeholder component and setupMode store field (SetupMode type, setSetupMode action)
provides:
  - HomeScreen.tsx — two-card landing view with active Load card and disabled Brief stub
  - Updated SetupScreen.tsx — thin delegator that renders child screens by setupMode value
  - Load card triggers setSetupMode('load'), swapping to the load slot (placeholder pending 04-03)
  - Disabled Brief card is visible, dimmed, focusable, aria-disabled, with inline Phase 7 message on click
affects:
  - 04-03 (replaces the 'load' placeholder div in SetupScreen with real LoadConfigPanel)
  - 04-04 (Launch buttons inside LoadConfigPanel navigate to /game)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Thin-shell router pattern for SetupScreen — exhaustive switch over SetupMode, each case renders a full-page child
    - Disabled-but-visible card pattern — aria-disabled on button, opacity-60, cursor-not-allowed, sr-only text, inline message state
    - TODO(04-03) comment co-located with placeholder — makes the handoff point obvious for the next plan

key-files:
  created:
    - src/components/setup/HomeScreen.tsx
  modified:
    - src/components/setup/SetupScreen.tsx

key-decisions:
  - "Load placeholder inlined in SetupScreen switch case (not a stub file) — cleaner file ownership; 04-03 replaces JSX in place"
  - "Disabled card uses aria-disabled not disabled attribute — keeps card keyboard-focusable so screen readers hear the disabled state and sr-only explanation"
  - "briefMessageVisible state lives inside HomeScreen, not the store — it is purely transient UI state with no cross-component lifetime"
  - "SetupScreen is a thin shell with no layout of its own — child screens (HomeScreen, future LoadConfigPanel) own their full-page layouts"
  - "Recommended badge on Load card uses persona-kent blue colour (border-border-dim + text-persona-kent) to signal it is the preferred action"

patterns-established:
  - "Exhaustive switch pattern for setupMode: covers home/load/brief/review — TypeScript is happy, no default fallthrough"
  - "Inline placeholder JSX with TODO(plan) annotation for plan-to-plan handoff points"

# Metrics
duration: ~1min
completed: 2026-04-13
---

# Phase 4 Plan 02: HomeScreen Two-Path Cards Summary

**HomeScreen with active Load Config card and visible disabled Brief stub; SetupScreen delegating to child views by setupMode**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-04-13T20:49:21Z
- **Completed:** 2026-04-13T20:50:05Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created `HomeScreen.tsx` — full-page landing with two equal-weight cards in responsive grid (stacked mobile, `lg:grid-cols-2`)
- Active Load Config card: keyboard-focusable `<button>`, onClick fires `setSetupMode('load')`, Recommended badge in persona-kent blue
- Disabled Generate from Brief card: `aria-disabled`, `opacity-60`, `cursor-not-allowed`, `sr-only` accessibility text, Phase 7 badge, inline message appears on click without touching setupMode
- Rewrote `SetupScreen.tsx` as a thin delegator shell — exhaustive switch over all four `SetupMode` values; 'load' slot has inline placeholder with `TODO(04-03)` comment ready for plan 04-03 to replace

## Task Commits

1. **Task 1: Build HomeScreen with two-path cards** - `263186d` (feat)
2. **Task 2: Wire SetupScreen to delegate by setupMode** - `4272864` (feat)

**Plan metadata:** `[see docs commit below]` (docs: complete plan)

## Files Created/Modified
- `src/components/setup/HomeScreen.tsx` — Created: two-card landing; app title + subtitle header; Load Config active button; Brief stub disabled button with briefMessageVisible state
- `src/components/setup/SetupScreen.tsx` — Replaced placeholder body with exhaustive switch on setupMode; imports HomeScreen; inline placeholders for load/brief/review

## Layout Details

**Outer wrapper:** `min-h-screen bg-bg-base text-text-primary flex flex-col items-center justify-center px-6 py-12`

**Header:** Centred `<h1>` with `font-display` + `text-3xl font-semibold tracking-tight`; subtitle `text-text-secondary mt-2 text-sm`

**Cards grid:** `mt-10 grid w-full max-w-5xl gap-6 grid-cols-1 lg:grid-cols-2`

**Active card:** `group flex flex-col items-start gap-3 rounded-2xl border border-border-default bg-bg-panel p-8 text-left transition min-h-[180px] hover:border-border-muted hover:bg-bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-persona-kent)]`

**Disabled card:** Same base minus hover styles + `opacity-60 cursor-not-allowed`

**Phase 7 badge:** `shrink-0 rounded-full bg-bg-elevated px-2 py-0.5 text-xs text-text-secondary` (top-right of Brief card)

**Recommended badge:** `rounded-full bg-bg-elevated px-2 py-0.5 text-xs text-persona-kent border border-border-dim`

## Accessibility Decisions

- Both cards are `<button>` elements — keyboard navigable with Tab, both reachable by screen readers
- Disabled card uses `aria-disabled="true"` rather than the `disabled` HTML attribute, preserving focus and allowing screen readers to hear the element
- `<span className="sr-only">Disabled — coming in Phase 7</span>` is inside the disabled button — screen readers announce this after the button label
- Both card titles use `<h2>` — document outline is: h1 (app title) → h2 (Load Config) / h2 (Generate from Brief)
- `briefMessageVisible` message is rendered as a `<p>` adjacent to the button (in an outer div), not inside the button — avoids nested interactive content issues

## Load Placeholder Approach

Inlined the placeholder `<div>` directly inside the `'load'` switch case in `SetupScreen.tsx`. Did NOT create a stub `LoadConfigPanel.tsx` file. This keeps file ownership clean — plan 04-03 will import and use its own `LoadConfigPanel.tsx`; it will find the `TODO(04-03)` comment in the switch case and replace the JSX in place.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- HomeScreen is complete: two-card landing renders at `/setup`, Load card switches `setupMode → 'load'`
- Plan 04-03 can mount `<LoadConfigPanel />` by replacing the placeholder div in the `'load'` case of `SetupScreen.tsx`
- The `'brief'` and `'review'` cases are exhaustive stubs — TypeScript happy, no dead code warnings
- Plan 04-04 can wire the Launch buttons inside `LoadConfigPanel` to call `initGame()` then `navigate('/game')`

---
*Phase: 04-setup-screen*
*Completed: 2026-04-13*
