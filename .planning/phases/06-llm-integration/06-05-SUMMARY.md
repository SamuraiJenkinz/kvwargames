---
phase: 06-llm-integration
plan: 05
subsystem: llm
tags: [parser, json, validation, type-guards, sliding-window, history, typescript, vitest]

# Dependency graph
requires:
  - phase: 06-llm-integration
    provides: "06-02 type definitions (ParseResult, LLMStructuredResponse, PersonaResponse, HistoryEntry)"
provides:
  - "parsePersonaResponse — four-layer defensive JSON parser that never throws"
  - "windowHistory + HISTORY_WINDOW_N — pure sliding-window history pruner with pair-alignment invariant"
affects: [06-06-llm-client, 06-07-store-and-ui-wiring, 06-08-token-budget-and-smoke-test]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Manual type guards (no Zod) matching jsonValidation.ts precedent"
    - "Discriminated ParseResult unions — error metadata on value channel, never throw"
    - "Re-export shared type from owning module so sibling modules depend only on types"

key-files:
  created:
    - src/lib/responseParser.ts
    - src/lib/responseParser.test.ts
    - src/lib/contextWindow.ts
    - src/lib/contextWindow.test.ts
  modified: []

key-decisions:
  - "n <= 0 guard in windowHistory — slice(-0) returns full array in JS (negative zero coercion), would violate |result| <= 2n invariant"
  - "PERSONA_ORDER constant local to responseParser.ts — 06-07 store/UI defines its own; parser owns the canonical sort key"
  - "Fence regex /^```(?:json)?\\s*\\n?|\\n?\\s*```$/gm with gm flags strips both opening and closing fences in one pass"
  - "BOM stripped via charCodeAt(0) === 0xFEFF (explicit) rather than regex — clearer intent, single code unit check"
  - "responseParser re-sorts + de-dupes but keeps first occurrence on duplicates — LLM's first attempt for a speaker wins"

patterns-established:
  - "Defensive parse boundary: pre-clean → parse → validate → normalize, each layer catches and returns structured failure"
  - "Pure slice utility stays pure — round-divider embedding happens at call site (06-07), not inside contextWindow"

# Metrics
duration: 3m 23s
completed: 2026-04-14
---

# Phase 6 Plan 5: Response Parser and Context Window Summary

**Four-layer never-throws LLM JSON parser (BOM/fence strip → JSON.parse → manual type guards → sort+dedupe) plus pure sliding-window history pruner keyed on HISTORY_WINDOW_N = 6.**

## Performance

- **Duration:** 3m 23s
- **Started:** 2026-04-14T13:00:16Z
- **Completed:** 2026-04-14T13:03:39Z
- **Tasks:** 2
- **Files created:** 4 (2 modules + 2 test suites)

## Accomplishments

- `parsePersonaResponse(raw)` is the sole barrier between malformed LLM output and game state. Zero `throw` statements in the module (grep-verified); every failure mode returns `{ ok: false, errorKind: 'PARSE_FAILURE' | 'VALIDATION_FAILURE', raw, detail }` with the **original, uncleaned** input preserved for diagnostics.
- Layer 4 normalization re-sorts `responses` into canonical `[kent, finch, chen]` order and de-duplicates by speaker (first-occurrence wins). Layer 3 enforces `1 <= responses.length <= 3` so downstream code never handles empty-or-oversized arrays.
- `windowHistory(history, n = 6)` enforces the CTX-02/03 invariants: `result.length <= 2 * n` AND `(result.length === 0 || result[0].role === 'user')`. When `slice(-2N)` falls mid-pair onto an assistant, the leading entry is dropped to restore alignment.
- `HISTORY_WINDOW_N` exported as single tunable — plan 06-08 re-tunes empirically after token-budget measurement without touching call sites.
- `HistoryEntry` imported from and re-exported by `contextWindow.ts`; single source of truth lives in `@/types/llm` (seeded by 06-02) so `llmClient.ts` in 06-06 can import it without a type-level dependency on 06-05.
- 63 tests passing (42 parser + 21 context window); `pnpm typecheck` clean across the whole project.

## Task Commits

Each task was committed atomically:

1. **Task 1: responseParser.ts — four-layer defensive JSON parse** — `5dd7598` (feat)
2. **Task 2: contextWindow.ts — sliding window with pair-alignment invariant** — `6e4d6ac` (feat)

**Plan metadata:** pending (docs commit after this summary is written)

## Files Created/Modified

- `src/lib/responseParser.ts` — four-layer defensive parser, PERSONA_ORDER constant, type guards for `LLMStructuredResponse` and `PersonaResponse`
- `src/lib/responseParser.test.ts` — 42 tests: happy paths, BOM/fence strip, all JSON parse failure modes, all validation failure modes (wrong-case speaker, unknown persona, numeric message, missing/undefined stateUpdate, numeric flag, non-boolean control.advanceRound, non-object control), Layer 4 sort + de-dupe, never-throws sweep over 12 malformed inputs
- `src/lib/contextWindow.ts` — `windowHistory` pruner, `HISTORY_WINDOW_N = 6`, `HistoryEntry` re-export
- `src/lib/contextWindow.test.ts` — 21 tests: constant pin, empty/single/exact-fit/over-cap, explicit 14-entry spec case, pair-integrity assistant-drop case, immutability against `Object.freeze`, custom N (including `n = 0`), invariant sweep over 9 fixtures

## Decisions Made

- **n <= 0 guard in `windowHistory`** — `Array.prototype.slice(-0)` returns the full array because `-0` is coerced to `0`. An unguarded `n = 0` call with a non-empty history would violate the documented `result.length <= 2n` invariant. Added explicit early-return to match the invariant's intent.
- **Manual type guards (no Zod)** — Follows the `jsonValidation.ts` precedent already established in the project. Zero new dependencies; predicates are colocated with the parser so the shape contract is readable in one file.
- **Fence regex applied once with `gm` flags** — `/^```(?:json)?\s*\n?|\n?\s*```$/gm` matches both opening and closing fences in a single `.replace` pass. Language tag is optional (bare ``` ``` ``` is handled too).
- **BOM stripped via `charCodeAt(0) === 0xFEFF`** — Explicit single code-unit check beats a regex for intent; BOM is a fixed single codepoint, not a pattern.
- **First-occurrence wins on duplicate speakers** — If the LLM emits two `kent` entries, Layer 4 keeps the first. Alternative (merge / last-wins) would hide model confusion; keeping the first makes the bug visible in the chat transcript for facilitator review.
- **`PERSONA_ORDER` is a parser-local constant, not imported from `personaConfig.ts`** — Keeps `responseParser.ts` a pure utility with no cross-module coupling beyond `@/types/llm`. The ordering value is identical in both places; if it ever diverges, the divergence is intentional.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added `n <= 0` guard in `windowHistory`**
- **Found during:** Task 2 (contextWindow test run)
- **Issue:** Plan pseudocode did not guard against `n = 0`. `history.slice(-0)` returns the full array (JavaScript coerces `-0` to `0` in slice), which would violate the invariant `result.length <= 2 * n` when history is non-empty. The `n = 0` invariant test caught this on first run.
- **Fix:** Added `if (n <= 0) return []` before the slice. Also covers negative `n` defensively.
- **Files modified:** `src/lib/contextWindow.ts`
- **Verification:** `n = 0` test now passes; invariant sweep with `n = 2, 4, 6` still passes.
- **Committed in:** `6e4d6ac` (part of Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Single-line guard, no scope creep. Ensures the documented invariant holds universally rather than only for `n >= 1`.

## Issues Encountered

None. Test suites passed on first run after the `n = 0` guard was added.

## User Setup Required

None — pure in-process utilities, no external services or environment variables.

## Next Phase Readiness

- **06-06 (llm-client)** can now `import { HistoryEntry } from '@/types/llm'` and depend on neither 06-05 nor 06-06 at the type level. The `LLMCallResult` discriminated union seeded in 06-02 is its return shape.
- **06-07 (store-and-ui-wiring)** will call `parsePersonaResponse(llmResult.text)` at the store boundary and `windowHistory(state.llmHistory)` when assembling the next LLM call's `messages` array. Both functions are pure and testable in isolation without store setup.
- **06-08 (token-budget-and-smoke-test)** owns the empirical re-tune of `HISTORY_WINDOW_N`. The constant is the single knob; no call-site changes needed.
- No blockers. Wave 2 small-modules slot is complete.

---
*Phase: 06-llm-integration*
*Completed: 2026-04-14*
