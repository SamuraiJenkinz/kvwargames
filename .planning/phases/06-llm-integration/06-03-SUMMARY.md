---
phase: 06-llm-integration
plan: 03
subsystem: state
tags: [typescript, tdd, pure-function, clamping, state-update]

dependency-graph:
  requires: [06-02]
  provides:
    - applyStateUpdatePure
    - CLAMP_RANGES
    - ClampLog
  affects: [06-07]

tech-stack:
  added: []
  patterns:
    - pure-function state update returning { nextState, clampLog } tuple
    - structuredClone (native) for deep copy; no lodash
    - shared CLAMP_RANGES constant iterated by helpers — no duplicated magic numbers
    - internal clampField + applyTeamUpdate helpers keep public API small

key-files:
  created:
    - src/lib/stateUpdater.ts
    - src/lib/stateUpdater.test.ts
  modified: []

decisions:
  - "applyStateUpdatePure returns { nextState, clampLog } rather than throwing on clamps — matches CONTEXT.md 'clamping is silent but logged'; store forwards clampLog to dev console in 06-07 without surfacing to users."
  - "structuredClone chosen over lodash.cloneDeep — native in Node 17+ and all modern browsers; no dependency added."
  - "CLAMP_RANGES is a single `as const` object; helpers iterate its entries (TEAM_CLAMP_FIELDS) rather than hardcoding each field. Adding a new numeric field = one line in CLAMP_RANGES + TEAM_CLAMP_FIELDS; no magic numbers anywhere in the module."
  - "Top-level clampLog uses bare field name ('crisisSeverity'); team fields use 'teams[ID].field' path — readable in dev console output while still machine-parseable by the ID bracket."
  - "Unknown team IDs still produce a new state reference (structuredClone runs unconditionally) — keeps the contract 'applyStateUpdatePure is always pure and always returns a new object', so the store never has a branch where it assigns the same reference back."
  - "gameStore.ts intentionally untouched — 06-07 is the plan that swaps the inline clamping over to this module. Keeping the store unchanged here means 06-03 can be reverted independently if the pure-function contract needs to change before 06-07 lands."

metrics:
  duration: "~2m 30s"
  completed: "2026-04-14"
  tests-added: 28
  tests-total: 282
---

# Phase 6 Plan 03: State Updater Summary

**One-liner:** Pure `applyStateUpdatePure(state, update)` with a single-source-of-truth `CLAMP_RANGES` constant and `ClampLog` reporting — TDD'd against all numeric boundaries so the store refactor in 06-07 is mechanical.

## What Was Built

### Task 1 (RED) — `src/lib/stateUpdater.test.ts`

372-line Vitest suite pinning behaviour before any implementation existed. 28 tests covering:

- **CLAMP_RANGES shape:** all 8 ranges match gameStore's previous inline values byte-for-byte.
- **Happy path in-range:** `crisisSeverity`, `crisisState` (string passthrough), `edipLegitimacy`.
- **Above-max clamping:** `crisisSeverity: 7 → 5`, `edipLegitimacy: 5 → 2` with clampLog entries.
- **Below-min clamping:** `edipLegitimacy: -5 → -2`, `crisisSeverity: -3 → 0`.
- **No-op semantics:** `null`, `undefined`, and empty-update payloads leave state unchanged.
- **Team matching:** by `id` not index; multi-team updates in one call; unknown ID silent skip.
- **Per-team boundaries:** PC (0..6), PO (-2..+2), readiness (0..5), stock/crm/ic (0..99) — each at low/high acceptable and just-past-boundary clamped.
- **Immutability:** input state never mutated (JSON snapshot comparison); `nextState !== state` and `nextState.teams !== state.teams`.
- **ClampLog field path format:** top-level bare name, team as `teams[ID].field`.

Confirmed RED: initial run failed with `Failed to resolve import "./stateUpdater"` — module did not exist.

### Task 2 (GREEN) — `src/lib/stateUpdater.ts`

142-line implementation:

- `ClampLog` interface: `{ field: string, raw: number, clamped: number }`.
- `CLAMP_RANGES` as-const object with 8 ranges (single definition; `grep -c "export const CLAMP_RANGES"` returns 1).
- `TEAM_CLAMP_FIELDS` readonly array so `applyTeamUpdate` iterates rather than hardcoding.
- `clampField(raw, range, fieldPath, clampLog)` — internal helper that clamps and conditionally appends to clampLog.
- `applyTeamUpdate(team, tu, clampLog)` — internal helper iterating TEAM_CLAMP_FIELDS, null-checking each.
- `applyStateUpdatePure(state, update)` — public entry; `structuredClone(state)`, walks the three top-level numeric/string fields, then loops `teamUpdates` matching by id with silent skip on unknown.

Confirmed GREEN: 28/28 new tests pass; full suite 282/282.

### Task 3 (REFACTOR) — Already satisfied in GREEN

The plan's suggested refactor (extract `applyTeamUpdate` helper) was applied during the initial GREEN write because the test surface made the duplication obvious up-front. No separate REFACTOR commit needed; full suite remained green.

## Verification

- `pnpm test src/lib/stateUpdater.test.ts --run` → 28/28 pass.
- `pnpm test --run` (full suite) → 282/282 pass; no regressions in gameStore, ChatFeed, or other consumers.
- `pnpm typecheck` → zero diagnostics.
- `grep -c "export const CLAMP_RANGES" src/lib/stateUpdater.ts` → 1 (single definition; total 6 text occurrences are the one definition + 5 iteration/lookup reads, which is the DRY pattern the plan wanted).
- `git status src/lib/gameStore.ts` → clean; store intentionally untouched per plan scope.

## Deviations from Plan

None — plan executed exactly as written. The REFACTOR step was folded into the GREEN implementation rather than run as a separate commit because the helper extraction was trivial once the tests pinned the behaviour; tests remained green throughout.

## Next Phase Readiness

- **06-04 (prompt builder):** No direct coupling. Plan 06-04 is Wave 2 alongside this plan and operates on prompts, not game state.
- **06-05 (response parser + context window):** Independent. The parser produces `LLMStructuredResponse`; this module consumes `LLMStructuredResponse.stateUpdate` downstream.
- **06-06 (llm client):** Independent.
- **06-07 (store + ui wiring):** Direct consumer. The store's `applyStateUpdate` action will be rewritten to call `applyStateUpdatePure` inside its atomic `set()`, assign `nextState`, and forward `clampLog` to `console.debug` (only when `clampLog.length > 0`). The existing Phase 5 inline clamping block can be deleted entirely in that plan.
- **06-08 (token budget + smoke test):** Independent.
- **06-09 (state visibility):** Indirect. Dev console clamp logging surfaces here once 06-07 wires it up.

**Locked contract:** `applyStateUpdatePure` signature and clampLog format are now fixed by the test suite. Any change in 06-07 that needs to adjust the contract must update tests here first.
