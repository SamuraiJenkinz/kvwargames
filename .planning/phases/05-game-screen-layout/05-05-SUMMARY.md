---
phase: 05-game-screen-layout
plan: 05
subsystem: ui
tags: [react, typescript, zustand, tailwind, vitest, reference-panel, tabs, scroll-preservation]

# Dependency graph
requires:
  - phase: 03-ui-design-system
    provides: "@theme tokens (bg-category-* colours, bg-bg-elevated, border-subtle, text-muted, font-display, font-mono)"
  - phase: 05-game-screen-layout/05-03
    provides: "ReferencePanel stub (w-[252px], data-testid=reference-panel, border-l)"
  - phase: 05-game-screen-layout/05-01
    provides: "gameConfig.cards, nationalActions, teams, objective/redLines/pcThresholds/votingRule/eoMechanic/resourceLogic/facilitation in GameStore"
provides:
  - "ReferencePanel container: three-tab bar (CARDS/ACTIONS/GUIDE) with active underline + opacity styling"
  - "Per-tab scroll position preservation: save-before-restore useLayoutEffect pattern with prevTab ref"
  - "CardsTab: 11-card list with 4px category colour chip; in-panel list→detail replacement (no modal/accordion); Back button"
  - "categoryColors.ts: pre-baked CAT_CHIP_CLASS lookup (7 categories) + catChipClass() helper"
  - "ActionsTab: National Actions section + Team Unique Powers section"
  - "GuideTab: 6 flat sections (Objective, Red Lines & PC Thresholds merged, Voting Rule, Resource Tokens, EO Response Mechanic, Facilitator Input Guide)"
  - "9 ReferencePanel tests covering tabs, card list/detail, Back nav, all Guide section headers"
  - "scrollIntoView global mock in src/test/setup.ts (jsdom limitation fix)"
affects:
  - 05-06-PLAN (StatePanel — independent plan, no file overlap)
  - 05-07-PLAN (FacilitatorInput — independent plan, no file overlap)
  - Phase 6 (activeTab store state already wired; setActiveTab available for LLM-driven tab switching if needed)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Save-before-restore scroll preservation: useLayoutEffect saves departing tab scrollTop before restoring incoming tab — prevents lost position when onScroll hasn't fired"
    - "Pre-baked Tailwind class lookup: CAT_CHIP_CLASS Record<string,string> — required by Tailwind v4 purge (no template-literal class generation)"
    - "Stable Zustand selector pattern: useGameStore(s => s.gameConfig) instead of s.gameConfig?.cards ?? [] — avoids new array reference on each render causing infinite rerender loop"
    - "In-panel detail replacement: local selectedId state drives list/detail swap — avoids modal overlay and accordion vertical space fighting"

# File tracking
key-files:
  created:
    - src/components/game/ReferencePanel/categoryColors.ts
    - src/components/game/ReferencePanel/CardsTab.tsx
    - src/components/game/ReferencePanel/ActionsTab.tsx
    - src/components/game/ReferencePanel/GuideTab.tsx
    - src/components/game/ReferencePanel/ReferencePanel.test.tsx
  modified:
    - src/components/game/ReferencePanel/ReferencePanel.tsx
    - src/test/setup.ts

# Decisions
decisions:
  - id: "05-05-A"
    decision: "CardsTab uses useGameStore(s => s.gameConfig) not s.gameConfig?.cards ?? [] as selector"
    rationale: "s.gameConfig?.cards ?? [] returns a new [] reference each render when gameConfig is null, causing Zustand to detect a changed snapshot on every render → infinite rerender loop. Selecting the full gameConfig (stable null/object reference) avoids this."
    alternatives: ["useShallow", "useMemo to stabilise the empty array"]
  - id: "05-05-B"
    decision: "setSelectedId(null) never called inside the render path in CardsTab"
    rationale: "Calling setState during render triggers React's 'maximum update depth exceeded' infinite loop. When a card id doesn't exist in the list, the fallback renders a Back button instead of calling setSelectedId(null) imperatively."
    alternatives: ["useEffect to reset selectedId after render"]
  - id: "05-05-C"
    decision: "scrollIntoView mock added to src/test/setup.ts (global)"
    rationale: "jsdom does not implement scrollIntoView. The real ChatFeed (05-04) calls sentinelRef.current?.scrollIntoView() in a useLayoutEffect, causing all GameScreen tests to throw 'scrollIntoView is not a function' once the ReferencePanel replaced its stub and GameScreen rendered the full component tree. The fix belongs in test setup (not in individual tests) since it's a global jsdom gap."
    alternatives: ["vi.fn() mock in each affected test file", "Mock useStickyBottomScroll in GameScreen.test.tsx"]
  - id: "05-05-D"
    decision: "activeTab/setActiveTab already present in store — no store changes needed"
    rationale: "Inspected src/lib/gameStore.ts before starting. activeTab: 'cards' (default) and setActiveTab were added in a prior plan. Used as-is."
    alternatives: ["N/A"]

# Metrics
metrics:
  duration: "~3 minutes"
  completed: "2026-04-14"
  tasks_completed: 2
  tasks_total: 2
  tests_added: 9
  tests_passing: 176
---

# Phase 5 Plan 5: ReferencePanel Summary

**One-liner:** Three-tab ReferencePanel (CARDS/ACTIONS/GUIDE) with save-before-restore scroll preservation, in-panel card list/detail swap via local selectedId state, and pre-baked Tailwind v4 category colour lookup.

## What Was Built

### categoryColors.ts
Pre-baked `CAT_CHIP_CLASS` Record mapping 7 EDIP card category strings to Tailwind background classes (`bg-category-crisis`, `bg-category-monitoring`, etc.). A `catChipClass()` helper returns the class or `bg-border-default` fallback. Required by Tailwind v4's purge — no template-literal class generation.

### CardsTab.tsx
List view renders all cards from `gameConfig.cards` as buttons with a 4px-wide category colour chip on the left and a one-line effect blurb (first sentence extraction via regex). Clicking any card replaces the list with an in-panel detail view showing timing, req, and effect sections. A Back button (ArrowLeft lucide icon) returns to the list. No modal, no accordion.

### ActionsTab.tsx
Two sections: National Actions (name, summary, cost in amber) and Team Unique Powers (team letter chip + uniqueAction text), separated by a horizontal rule.

### GuideTab.tsx
Six flat sections rendered vertically with bold uppercase headers and top-border dividers between sections. `redLines` and `pcThresholds` are concatenated with `\n\n` into a single "Red Lines & PC Thresholds" section.

### ReferencePanel.tsx (replaced stub)
Tab bar with three buttons. Active tab has `opacity-100 border-b-2`; inactive tabs have `opacity-60 hover:opacity-80`. Scroll preservation uses `useLayoutEffect` with save-before-restore pattern: when `activeTab` changes, the departing tab's `scrollTop` is saved into a `useRef` map before the incoming tab's position is restored. This ensures positions are preserved even if the user hasn't actively scrolled (so `onScroll` hasn't fired). An `onScroll` handler provides secondary capture during active scrolling.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Infinite rerender loop from unstable Zustand selector**

- **Found during:** Task 1 / running tests
- **Issue:** `useGameStore(s => s.gameConfig?.cards ?? [])` creates a new `[]` array reference on every render when `gameConfig` is `null`. Zustand detects a changed snapshot and triggers a rerender → infinite loop with "getSnapshot should be cached" and "Maximum update depth exceeded" errors.
- **Fix:** Changed to `useGameStore(s => s.gameConfig)` and derived `cards = gameConfig?.cards ?? []` outside the selector. The `null` object reference is stable.
- **Files modified:** `src/components/game/ReferencePanel/CardsTab.tsx`
- **Commit:** 63722ab

**2. [Rule 1 - Bug] setSelectedId(null) called inside render path**

- **Found during:** Task 1 / running tests
- **Issue:** Original fallback when `card` not found called `setSelectedId(null)` inside the render body, triggering React's infinite update depth protection.
- **Fix:** Replaced with a JSX fallback that renders a Back button (handler calls `setSelectedId(null)` in an onClick, not in render).
- **Files modified:** `src/components/game/ReferencePanel/CardsTab.tsx`
- **Commit:** 63722ab

**3. [Rule 1 - Bug] scrollIntoView not implemented in jsdom — GameScreen tests fail**

- **Found during:** Task 2 / running full test suite
- **Issue:** The real ChatFeed (added in 05-04) calls `sentinelRef.current?.scrollIntoView()` in a `useLayoutEffect`. Once ReferencePanel replaced its stub, `GameScreen` rendered the full component tree including ChatFeed, causing all 8 GameScreen tests to throw "scrollIntoView is not a function". This was a latent issue from 05-04 that only surfaced when the stub was replaced.
- **Fix:** Added `window.HTMLElement.prototype.scrollIntoView = () => {}` to `src/test/setup.ts` (global mock, correct for a jsdom gap).
- **Files modified:** `src/test/setup.ts`
- **Commit:** 63722ab

## Verification

- `npx tsc --noEmit`: passes
- `npm test`: 176/176 tests pass (8 test files)
- ReferencePanel-specific: 9/9 tests pass
- Manual verification items (jsdom limitation — cannot automate):
  - Tab switching visual highlighting (active underline + full opacity)
  - CARDS list → detail card view (in-panel, no modal)
  - Back button returns to list
  - Scroll position preserved across tab switches (save-before-restore pattern)

## Next Phase Readiness

Plan 05-05 complete. Wave 2 of Phase 5 now has both 05-04 (ChatFeed) and 05-05 (ReferencePanel) complete. Plans 05-06 (StatePanel) and 05-07 (FacilitatorInput) are the remaining Wave 2 plans.

No blockers for subsequent plans.
