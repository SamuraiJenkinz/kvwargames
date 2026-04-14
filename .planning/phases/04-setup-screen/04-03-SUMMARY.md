---
phase: 04-setup-screen
plan: "03"
subsystem: ui
tags: [react, typescript, zustand, react-router, json-parsing, textarea, tailwind]

# Dependency graph
requires:
  - phase: 04-01
    provides: router scaffold, SetupScreen shell, gameStore with configJson/initGame
  - phase: 04-02
    provides: HomeScreen, SetupScreen delegating by setupMode with 'load' placeholder
provides:
  - jsonValidation.ts: parseConfigJson + offsetToLineCol helpers
  - JsonEditor: controlled textarea with synchronised line-number gutter
  - ScenarioSummary: read-only GameConfig summary component
  - LoadConfigPanel: full load-config working surface
  - SetupScreen 'load' case wired to LoadConfigPanel
affects:
  - 04-04 (error UX polish — uses parseResult.error shape + errorLine prop)
  - 05 (GameScreen reads gameState initialised by LoadConfigPanel launch)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Eager parse on mount via useState initialiser — avoids empty summary on first render"
    - "300ms debounced parse via useEffect/setTimeout/cleanup — live summary without per-keystroke parse"
    - "Re-parse at click time in launch handler — handles stale debounce window on rapid user action"
    - "Selector-per-action pattern in Zustand (s => s.configJson, s => s.setConfigJson, etc.) — avoids unnecessary re-renders"
    - "V8 JSON.parse error offset extraction via /at position (\\d+)/ regex — no external library"

key-files:
  created:
    - src/lib/jsonValidation.ts
    - src/lib/jsonValidation.test.ts
    - src/components/setup/JsonEditor.tsx
    - src/components/setup/ScenarioSummary.tsx
    - src/components/setup/LoadConfigPanel.tsx
  modified:
    - src/components/setup/SetupScreen.tsx

key-decisions:
  - "parseConfigJson called eagerly on mount via useState(() => parseConfigJson(configJson)) — summary visible immediately, no 300ms blank state"
  - "Regex /at position (\\d+)/ for V8 JSON.parse error offset — works in Chromium/Edge/Firefox; falls back to line 1 col 1 when not matched"
  - "ParseResult lives in local component state, not Zustand — store holds raw configJson string only"
  - "No deep validation beyond scenarios[].length >= 1 and teams[].length >= 1 — facilitator tool, not hostile-input firewall"
  - "Launch handler re-parses synchronously at click time — guards against 300ms debounce window where UI shows valid summary but state is stale"

patterns-established:
  - "Debounced parse pattern: useEffect + setTimeout(fn, 300) + return () => clearTimeout(id)"
  - "Eager-then-debounce: initialise with lazy useState, update with debounced useEffect"

# Metrics
duration: 2m 5s
completed: "2026-04-14"
---

# Phase 4 Plan 03: Load Config Panel Summary

**Live-parsed JSON editor with debounced ScenarioSummary and synchronous-at-click Launch buttons that initialise Zustand store and navigate to /game**

## Performance

- **Duration:** 2m 5s
- **Started:** 2026-04-14T00:49:41Z
- **Completed:** 2026-04-14T00:51:46Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- jsonValidation.ts delivers `parseConfigJson` + `offsetToLineCol` with 16 passing unit tests
- JsonEditor component: controlled textarea with scroll-synced line-number gutter and per-line error highlighting
- LoadConfigPanel: two-column editor + live summary; EDIP config pre-populated on mount; Launch initialises store and navigates to /game
- SetupScreen 'load' case wired to LoadConfigPanel, preserving 04-02's HomeScreen 'home' case

## Task Commits

1. **Task 1: Build jsonValidation helper + tests** - `4d703ac` (feat)
2. **Task 2: Build JsonEditor (textarea + line-number gutter)** - `86567d2` (feat)
3. **Task 3: Build ScenarioSummary + LoadConfigPanel and wire Launch** - `8e5fb91` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `src/lib/jsonValidation.ts` — parseConfigJson, offsetToLineCol, ParseError type
- `src/lib/jsonValidation.test.ts` — 16 unit tests (offsetToLineCol edge cases, parseConfigJson happy/sad paths)
- `src/components/setup/JsonEditor.tsx` — controlled textarea + scroll-synced gutter, errorLine prop
- `src/components/setup/ScenarioSummary.tsx` — read-only GameConfig render (name, domain, scenarios, counts)
- `src/components/setup/LoadConfigPanel.tsx` — full panel; eager mount parse + 300ms debounce + launch handler
- `src/components/setup/SetupScreen.tsx` — 'load' case replaced: renders `<LoadConfigPanel />`

## Decisions Made

- **parseConfigJson called eagerly on mount:** Used `useState(() => parseConfigJson(configJson))` lazy initialiser so the scenario summary is visible immediately on first render, not after the first 300ms debounce tick.
- **Regex `/at position (\d+)/`:** Exact regex used for JSON.parse error offset extraction (V8/modern Chromium/Edge/Firefox). Falls back to `{line: 1, col: 1, offset: null}` when the regex does not match (e.g., non-V8 engines or messages without position info).
- **ParseResult in local state only:** The store holds the raw `configJson` string; parse result lives in component state. Avoids storing derived data in Zustand.
- **No deep validation:** Structural check is `scenarios.length >= 1 && teams.length >= 1` only. Phase 4 is a facilitator tool; exhaustive schema validation is out of scope.
- **Re-parse at click time:** `handleLaunch` calls `parseConfigJson(configJson)` synchronously before `initGame`. The debounced `parseResult` state may be up to 300ms stale; re-parsing at click ensures the store is always initialised from the current textarea content.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. 04-02 had completed (committed `e88ba6b`) before Task 3 began, leaving a well-formed `SetupScreen.tsx` with a TODO comment pointing to this plan. The edit was clean.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 4 success criteria #2 and #3 delivered:
  - #2: Load Config panel opens with EDIP JSON pre-populated; JSON editable and parsed summary updates live
  - #3: Valid EDIP JSON shows scenario selection with Launch buttons; clicking initialises store and navigates to game screen
- Plan 04-04 has the hooks it needs: `parseResult.error.line` feeds `errorLine` prop; inline `role="alert"` paragraph in place for styling polish
- Phase 5 GameScreen will read `gameState` initialised by `initGame` — store shape unchanged

---
*Phase: 04-setup-screen*
*Completed: 2026-04-14*
