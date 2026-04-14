---
phase: 05-game-screen-layout
plan: 06
subsystem: ui
tags: [react, typescript, zustand, tailwind, vitest, state-panel, track-bar, pc-badge, persona-dots, team-card]

# Dependency graph
requires:
  - phase: 03-ui-design-system
    provides: "@theme tokens (bg-track-severity, bg-track-legitimacy, bg-crisis-security, bg-persona-finch, resource colours, --animate-blink)"
  - phase: 05-game-screen-layout/05-02
    provides: "getPcBadge, getPersonasThisRound from pcThresholds; PERSONA_ORDER, PERSONA_META from personaConfig"
  - phase: 05-game-screen-layout/05-03
    provides: "StatePanel stub (w-[210px] left column shell)"
  - phase: 05-game-screen-layout/05-01
    provides: "MOCK_GAME_STATE, MOCK_MESSAGES in @/mocks/mockGameState"
provides:
  - "TrackBar: simple (left-growing) + center-zero modes; transition-[width] duration-300 ease-out; signed display for legitimacy"
  - "PcBadge: CRISIS (red + var(--animate-blink) inline style) / STRAINED (amber static) / null"
  - "PersonaDots: PERSONA_ORDER dots with data-testid + data-lit attributes; lit via getPersonasThisRound"
  - "TeamCard: short label 'Team {id}' + PcBadge + 6-field grid (PC/PO/RDY/STK/CRM/IC) in grid-cols-2"
  - "StatePanel: replaces stub; null-guards on gameState; severity+legitimacy tracks, PersonaDots, 4 TeamCards"
  - "21 StatePanel tests covering all mock values, PC badge states, persona dot data-lit, CRISIS blink style, null guard"
affects:
  - Phase 6 (StatePanel wired to useGameStore; will update live when LLM state updates applied via applyStateUpdate)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Array.join(' ') for conditional class concatenation (no cn/clsx in project)"
    - "Inline style={{ animation: 'var(--animate-blink)' }} for CRISIS badge — CSS custom property referencing @keyframes in @theme"
    - "CSS uppercase via Tailwind class (not rendered as uppercase in jsdom — tests match actual DOM text)"
    - "center-zero TrackBar: absolute positioning of fill with left% + width% calculated from signed value"

# File tracking
key-files:
  created:
    - src/components/game/StatePanel/TrackBar.tsx
    - src/components/game/StatePanel/PcBadge.tsx
    - src/components/game/StatePanel/PersonaDots.tsx
    - src/components/game/StatePanel/TeamCard.tsx
    - src/components/game/StatePanel/StatePanel.test.tsx
  modified:
    - src/components/game/StatePanel/StatePanel.tsx

# Decisions
decisions:
  - id: "05-06-A"
    choice: "CSS uppercase in TrackBar renders 'Severity'/'Legitimacy' in DOM — jsdom doesn't apply text-transform"
    why: "Tests assert against actual DOM text, not CSS-transformed text; test comments explain the discrepancy for future maintainers"
  - id: "05-06-B"
    choice: "getAllByText used for '+1' and numeric values that collide across multiple TeamCards"
    why: "Mock data has po=1 on Teams B and D, and legitimacy=+1 on track; getByText would throw on multiple matches"
  - id: "05-06-C"
    choice: "No track or resource colour tokens needed — all were pre-existing in @theme"
    why: "bg-track-severity, bg-track-legitimacy, and all text-resource-* tokens confirmed present in src/styles/index.css from Phase 3"

# Metrics
metrics:
  duration: "2m 25s"
  completed: "2026-04-14"
  tests_added: 21
  tests_total: 197
---

# Phase 5 Plan 6: StatePanel Summary

**One-liner:** Left-column StatePanel with severity/legitimacy TrackBars (center-zero mode), CRISIS/STRAINED PcBadges with blink animation, PersonaDots from message history, and 4 TeamCards with 6-field resource grids.

## What Was Built

Five new files replacing the StatePanel stub:

- **TrackBar.tsx** — Dual-mode track bar. Simple mode grows from left; center-zero mode (legitimacy) calculates fill as absolute `left%` + `width%` from the midpoint. Both animate via `transition-[width] duration-300 ease-out` (CONTEXT.md's 300ms override of REQUIREMENTS.md DASH-05's 0.5s).
- **PcBadge.tsx** — Reads pc value via `getPcBadge()` from pcThresholds. CRISIS returns red span with `style={{ animation: 'var(--animate-blink)' }}`; STRAINED returns static amber span; null returns nothing.
- **PersonaDots.tsx** — Iterates PERSONA_ORDER; each dot uses `meta.dotClass` with `opacity-100` (lit) or `opacity-25` (dim) based on `getPersonasThisRound(messages).has(id)`. Includes `data-testid` and `data-lit` for test assertions.
- **TeamCard.tsx** — Compact card with short name (`Team {id}`), PcBadge in header, and 6-field grid (PC/PO/RDY/STK/CRM/IC). PO formatted with explicit sign (+0/+1/-1).
- **StatePanel.tsx** — Replaces stub. Null-guards on gameState. Assembles severity track, legitimacy track, "Personas this round" section with PersonaDots, divider, then 4 TeamCards from `gameState.teams`.

## Verification Results

- `npx tsc --noEmit`: pass
- `npm test -- StatePanel`: 21/21 pass
- `npm test` (full suite): 197/197 pass

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test assertions matched CSS-transformed text instead of DOM text**

- **Found during:** Task 2 test run
- **Issue:** Tests used `getByText('SEVERITY')` and `getByText('LEGITIMACY')` but TrackBar renders `'Severity'` and `'Legitimacy'` — CSS `text-transform: uppercase` is not applied by jsdom. Test would always fail.
- **Fix:** Changed assertions to `getByText('Severity')` and `getByText('Legitimacy')` with comments explaining jsdom limitation.
- **Files modified:** `StatePanel.test.tsx`

**2. [Rule 1 - Bug] getByText('+1') threw on multiple matches**

- **Found during:** Task 2 test run
- **Issue:** Mock state has `edipLegitimacy: 1` (shows "+1" in TrackBar) and Teams B+D have `po: 1` (each shows "+1" in resource grid). `getByText` threw "Found multiple elements".
- **Fix:** Changed to `getAllByText('+1')` and asserted `length >= 1`.
- **Files modified:** `StatePanel.test.tsx`

## Track/Resource Token Check

No @theme additions were needed. All colour tokens were pre-existing:
- `bg-track-severity`, `bg-track-legitimacy` — confirmed in Phase 3 (03-02)
- All `text-resource-*` tokens — confirmed in Phase 3 (03-02)

## Next Phase Readiness

StatePanel is live-wired to `useGameStore`; all values update when `applyStateUpdate` is called. Phase 6 can drive all StatePanel visuals purely through `setGameState` / `applyStateUpdate` without any StatePanel changes.
