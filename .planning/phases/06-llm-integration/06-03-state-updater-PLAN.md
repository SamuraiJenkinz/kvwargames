---
phase: 06-llm-integration
plan: 03
type: tdd
wave: 2
depends_on: ["06-02"]
files_modified:
  - src/lib/stateUpdater.ts
  - src/lib/stateUpdater.test.ts
autonomous: true

must_haves:
  truths:
    - "A pure function `applyStateUpdatePure(state, update)` returns `{ nextState, clampLog }` and never mutates input"
    - "Clamping ranges match the store's existing `applyStateUpdate`: crisisSeverity 0-5, edipLegitimacy -2 to +2, PC 0-6, PO -2 to +2, readiness 0-5, stock/crm/ic 0-99 (STATE-01)"
    - "Team updates match by `id`, never by array index (STATE-02); unknown team IDs are skipped silently"
    - "Only fields present on the update payload are mutated; `undefined`/`null`/missing fields are no-ops (STATE-03)"
    - "Out-of-range values produce a `ClampLog` entry with raw + clamped values that the store can forward to the dev console"
    - "Exported `CLAMP_RANGES` constant is the single source of truth (no duplicated magic numbers across the module)"
  artifacts:
    - path: "src/lib/stateUpdater.ts"
      provides: "applyStateUpdatePure, CLAMP_RANGES, ClampLog type"
      min_lines: 80
      exports: ["applyStateUpdatePure", "CLAMP_RANGES"]
    - path: "src/lib/stateUpdater.test.ts"
      provides: "Boundary-value test suite"
      min_lines: 120
  key_links:
    - from: "src/lib/stateUpdater.ts"
      to: "src/types/game.ts"
      via: "StateUpdate, GameState, TeamState imports"
      pattern: "from '@/types/game'"
---

<objective>
Build the pure `applyStateUpdatePure` function that Plan 06-07 will call inside the store's atomic `set()`. This is a TDD plan: tests are written first and pin boundary behaviour before the store refactor. It also extracts `CLAMP_RANGES` as a named constant so the store no longer has magic numbers inline.

Purpose: The store's existing inline clamping works but is untested at boundaries and cannot report clamp events. Extracting to a pure function (a) unlocks unit testing of boundary values required by Phase 8 QA, (b) gives the store a clean hook for dev-console clamp logging (CONTEXT.md "Clamping is silent but logged"), and (c) preserves atomicity because the store calls it and applies the result in a single `set()` call.
Output: A pure module, a boundary test suite, and a shared clamping constant.
</objective>

<execution_context>
</execution_context>

<context>
@.planning/phases/06-llm-integration/06-CONTEXT.md
@.planning/phases/06-llm-integration/06-RESEARCH.md
@src/types/game.ts
@src/lib/gameStore.ts  # existing inline clamping is the reference
</context>

<feature>
  <name>applyStateUpdatePure</name>
  <files>src/lib/stateUpdater.ts, src/lib/stateUpdater.test.ts</files>
  <behavior>
    Signature:
    ```typescript
    export interface ClampLog {
      field: string          // e.g. 'crisisSeverity' or 'teamUpdates[A].pc'
      raw: number
      clamped: number
    }

    export const CLAMP_RANGES = {
      crisisSeverity: [0, 5],
      edipLegitimacy: [-2, 2],
      pc: [0, 6],
      po: [-2, 2],
      readiness: [0, 5],
      stock: [0, 99],
      crm: [0, 99],
      ic: [0, 99],
    } as const

    export function applyStateUpdatePure(
      state: GameState,
      update: StateUpdate,
    ): { nextState: GameState; clampLog: ClampLog[] }
    ```

    Cases (each is a test):
    - Happy path in-range: `update = { crisisSeverity: 3 }` on a state with `crisisSeverity: 1` → `nextState.crisisSeverity === 3`, empty clampLog.
    - Above max clamped: `update = { crisisSeverity: 7 }` → `nextState.crisisSeverity === 5`, clampLog contains `{ field: 'crisisSeverity', raw: 7, clamped: 5 }`.
    - Below min clamped: `update = { edipLegitimacy: -5 }` → clamped to `-2`, clampLog entry recorded.
    - `null` field is a no-op: `update = { crisisSeverity: null as any }` (LLM might send null) → state.crisisSeverity unchanged, empty clampLog.
    - `undefined` / missing field is a no-op: `update = {}` → state deep-equals input, empty clampLog.
    - Team match by ID: two teams `A` and `B`; `update = { teamUpdates: [{ id: 'B', pc: 4 }] }` → only team B's pc mutated; A untouched.
    - Unknown team ID silent skip: `update = { teamUpdates: [{ id: 'Z', pc: 3 }] }` → no-op, empty clampLog, no throw.
    - Multiple teams updated: two teamUpdates in one call; both applied correctly.
    - PC boundary: `pc: 0` accepted, `pc: -1` clamped to 0; `pc: 6` accepted, `pc: 7` clamped to 6.
    - PO boundary: same pattern for -2 / +2.
    - Readiness 0 and 5 accepted; 6 clamped to 5; -1 clamped to 0.
    - Stock/crm/ic: 0 and 99 accepted; 100 clamped to 99; -1 clamped to 0.
    - `crisisState` field (string, not numeric) passes through unclamped: `update = { crisisState: 'Supply Crisis' }` → applied; not in clampLog.
    - Immutability: `applyStateUpdatePure(state, update)` does NOT mutate `state`. Assert by capturing `JSON.stringify(state)` before call and comparing after.
    - `nextState` is a new reference (`nextState !== state`) and `nextState.teams !== state.teams` (new array).
    - Clamp field path for teams: clampLog entry uses `field: 'teams[A].pc'` (or similar readable format) so the store can log to dev console with enough context.

    Implementation hints:
    - Use `structuredClone(state)` for the deep copy; it's native in Node 17+ and all modern browsers (no lodash).
    - Do NOT reach for immer — the store uses immer at the call site; this module is a pure utility called outside of `produce()`.
    - Iterate `CLAMP_RANGES` entries rather than hardcoding each numeric field, so the implementation stays DRY.
  </behavior>
  <implementation>
    1. RED: Write `src/lib/stateUpdater.test.ts` with all cases above. Run `pnpm test src/lib/stateUpdater.test.ts` — must fail (module does not exist).
    2. GREEN: Create `src/lib/stateUpdater.ts` with `CLAMP_RANGES`, `ClampLog`, and `applyStateUpdatePure`. Implement clamping via a shared helper `clampField(value, [min, max], fieldPath)` that appends to clampLog if the value changed. Run tests — all must pass.
    3. REFACTOR (if obvious improvement): Extract team clamping into an internal `applyTeamUpdate(team, tu, clampLog)` helper that returns the new team object. Re-run tests.
  </implementation>
</feature>

<verification>
- `pnpm test src/lib/stateUpdater.test.ts` — all ~15+ cases pass.
- `pnpm typecheck` passes.
- `grep -c "CLAMP_RANGES" src/lib/stateUpdater.ts` returns `1` (single definition).
- No change to `gameStore.ts` in this plan — store refactor to use this is Plan 06-07.
</verification>

<success_criteria>
- `applyStateUpdatePure` behaves correctly on all boundary values listed above.
- `ClampLog` exported and populated correctly on clamp events, empty when no clamping occurred.
- `CLAMP_RANGES` exported as a typed const.
- Pure — no mutation of input state.
- Test suite covers: in-range, above-max, below-min, null, undefined, team match by ID, unknown team skip, multi-team, all 6 team fields at both boundaries, crisisState string passthrough, immutability.
</success_criteria>

<output>
After completion, create `.planning/phases/06-llm-integration/06-03-SUMMARY.md`.
</output>
