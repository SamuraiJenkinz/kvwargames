---
phase: 06-llm-integration
plan: 05
type: execute
wave: 2
depends_on: ["06-02"]
files_modified:
  - src/lib/responseParser.ts
  - src/lib/responseParser.test.ts
  - src/lib/contextWindow.ts
  - src/lib/contextWindow.test.ts
autonomous: true

must_haves:
  truths:
    - "`parsePersonaResponse(raw)` strips markdown fences + BOM, JSON.parses, validates shape via manual type guards, returns a discriminated `ParseResult` (RESP-01, RESP-02)"
    - "Parse failures NEVER throw — all four defence layers catch and return `{ ok: false, errorKind, raw, detail }`"
    - "Parsed responses pass through persona ordering (Kent → Finch → Chen) and min-1/max-3/no-duplicate defensive enforcement at the parser boundary"
    - "`windowHistory(history, n=6)` returns at most `2*n` entries, starts on a user message, never returns an orphan leading assistant entry (CTX-02, CTX-03)"
    - "`HISTORY_WINDOW_N` exported as a single tunable constant so Plan 06-08 can tune it after empirical measurement"
    - "`HistoryEntry` is imported (and re-exported) from `@/types/llm` — NOT defined locally in contextWindow.ts — so 06-06's `llmClient.ts` can import it from `@/types/llm` without depending on this module"
  artifacts:
    - path: "src/lib/responseParser.ts"
      provides: "parsePersonaResponse, type guards"
      exports: ["parsePersonaResponse"]
      min_lines: 80
    - path: "src/lib/responseParser.test.ts"
      provides: "Defensive parse test suite"
      min_lines: 100
    - path: "src/lib/contextWindow.ts"
      provides: "windowHistory, HISTORY_WINDOW_N"
      exports: ["windowHistory", "HISTORY_WINDOW_N"]
      min_lines: 30
    - path: "src/lib/contextWindow.test.ts"
      provides: "Invariant tests"
      min_lines: 60
  key_links:
    - from: "src/lib/responseParser.ts"
      to: "src/types/llm.ts"
      via: "ParseResult, LLMStructuredResponse, PersonaResponse"
      pattern: "from '@/types/llm'"
---

<objective>
Build two pure utility modules: `responseParser.ts` (four-layer defensive LLM JSON parse) and `contextWindow.ts` (sliding-window history pruner). Bundled because both are small, pure, share no files with other Wave 2 plans, and are independently testable.

Purpose: Response parser is the ONLY barrier between a malformed LLM output and the game state. It must never throw. Context window is the ONLY mechanism keeping long scenarios within the corporate LLM's context budget (CTX-02/03).
Output: Two modules + two test suites, both pure, both deterministic.
</objective>

<execution_context>
</execution_context>

<context>
@.planning/phases/06-llm-integration/06-CONTEXT.md
@.planning/phases/06-llm-integration/06-RESEARCH.md
@src/types/llm.ts
@src/lib/jsonValidation.ts  # reference for manual type guard pattern
</context>

<tasks>

<task type="auto">
  <name>Task 1: `responseParser.ts` — four-layer defensive JSON parse</name>
  <files>src/lib/responseParser.ts, src/lib/responseParser.test.ts</files>
  <action>
    Create `src/lib/responseParser.ts` exporting:

    ```typescript
    import type { ParseResult, LLMStructuredResponse, PersonaResponse } from '@/types/llm'

    export function parsePersonaResponse(raw: string): ParseResult
    ```

    Four-layer implementation:

    **Layer 1 — Pre-parse cleanup:**
    - Strip BOM (`^\uFEFF`).
    - Trim whitespace.
    - Strip markdown fences with regex `/^```(?:json)?\s*\n?|\n?\s*```$/gm`.
    - Trim again.

    **Layer 2 — JSON.parse:** Wrapped in try/catch. On catch:
    ```typescript
    return { ok: false, errorKind: 'PARSE_FAILURE', raw, detail: err instanceof Error ? err.message : 'JSON parse error' }
    ```

    **Layer 3 — Manual type guard:** Follow the `jsonValidation.ts` pattern (no Zod). Implement internal predicates:
    ```typescript
    function isPersonaResponse(x: unknown): x is PersonaResponse {
      if (!x || typeof x !== 'object') return false
      const r = x as Record<string, unknown>
      return (
        (r.speaker === 'kent' || r.speaker === 'finch' || r.speaker === 'chen') &&
        typeof r.message === 'string' &&
        (r.stateUpdate === null || (typeof r.stateUpdate === 'object' && r.stateUpdate !== null)) &&
        (r.flag === null || typeof r.flag === 'string')
      )
    }

    function isLLMStructuredResponse(x: unknown): x is LLMStructuredResponse {
      if (!x || typeof x !== 'object') return false
      const r = x as Record<string, unknown>
      if (!Array.isArray(r.responses)) return false
      if (r.responses.length < 1 || r.responses.length > 3) return false
      if (!r.responses.every(isPersonaResponse)) return false
      // control is optional; if present, must be an object with optional boolean flags
      if (r.control !== undefined) {
        if (!r.control || typeof r.control !== 'object') return false
        const c = r.control as Record<string, unknown>
        if (c.advanceRound !== undefined && typeof c.advanceRound !== 'boolean') return false
        if (c.triggerDebrief !== undefined && typeof c.triggerDebrief !== 'boolean') return false
      }
      return true
    }
    ```

    **Layer 4 — Post-validation normalization:**
    - Sort `value.responses` by `PERSONA_ORDER` = `['kent', 'finch', 'chen']`.
    - De-duplicate by speaker (keep first occurrence). If de-dup reduces to 0 (impossible given Layer 3 length check, but defensive) → return VALIDATION_FAILURE.
    - Return `{ ok: true, value: normalizedValue }`.

    Tests (`src/lib/responseParser.test.ts`) — minimum cases:
    - Happy path: valid JSON with 1 persona → `ok: true`.
    - Happy path: valid JSON with 3 personas in reverse order → Layer 4 re-sorts to Kent/Finch/Chen.
    - Markdown fence stripped: raw starts with ` ```json\n{...}\n``` ` → parses successfully.
    - BOM stripped: raw begins with `\uFEFF` → parses successfully.
    - Empty string → PARSE_FAILURE (JSON.parse throws).
    - Malformed JSON (missing brace) → PARSE_FAILURE; `raw` field preserves original input.
    - Valid JSON but missing `responses` → VALIDATION_FAILURE.
    - `responses` is empty array → VALIDATION_FAILURE (length check).
    - `responses` has 4 items → VALIDATION_FAILURE.
    - Speaker is `"KENT"` (wrong case) → VALIDATION_FAILURE.
    - Speaker is `"sam"` (unknown persona) → VALIDATION_FAILURE.
    - `message` is a number → VALIDATION_FAILURE.
    - `stateUpdate` is `undefined` (missing) → VALIDATION_FAILURE (must be `null` or object).
    - `stateUpdate` is `null` → OK.
    - `flag` is `null` → OK; `flag` is a number → VALIDATION_FAILURE.
    - `control.advanceRound: true` → parsed and preserved.
    - `control.advanceRound: "yes"` (string) → VALIDATION_FAILURE.
    - Duplicate speaker (two `kent` entries) → de-duplicated in Layer 4; `value.responses.length` === 1.
    - Never throws: wrap every test case in `expect(() => parsePersonaResponse(input)).not.toThrow()`.
    - `raw` field populated on every failure case with the original (uncleaned) input.
  </action>
  <verify>
    - `pnpm test src/lib/responseParser.test.ts` — all tests pass.
    - Grep for `throw` in `src/lib/responseParser.ts` returns zero occurrences (the function catches everything internally).
  </verify>
  <done>
    `parsePersonaResponse` is pure, never throws, handles all malformed cases with structured results, correctly sorts + de-dupes on success. Tests cover both success and all failure modes.
  </done>
</task>

<task type="auto">
  <name>Task 2: `contextWindow.ts` — sliding window with pair-alignment invariant</name>
  <files>src/lib/contextWindow.ts, src/lib/contextWindow.test.ts</files>
  <action>
    Create `src/lib/contextWindow.ts`:

    ```typescript
    import type { HistoryEntry } from '@/types/llm'

    export const HISTORY_WINDOW_N = 6

    // Re-export so callers that already import from '@/lib/contextWindow' continue to work.
    // Single source of truth for the type lives in src/types/llm.ts (added in plan 06-02).
    export type { HistoryEntry }

    /**
     * Returns the last N message-pairs (2N entries max) from history.
     * Invariant: returned array starts on a 'user' entry (never an orphaned assistant).
     *
     * @param history  Full session history from gameStore.llmHistory
     * @param n        Number of user/assistant pairs to retain (default HISTORY_WINDOW_N)
     */
    export function windowHistory(
      history: HistoryEntry[],
      n: number = HISTORY_WINDOW_N,
    ): HistoryEntry[] {
      const maxEntries = n * 2
      const sliced = history.slice(-maxEntries)
      if (sliced.length > 0 && sliced[0].role === 'assistant') {
        return sliced.slice(1)
      }
      return sliced
    }
    ```

    Tests (`src/lib/contextWindow.test.ts`):
    - Empty history → `[]`.
    - 1 user entry → returned as-is (length 1, starts on user).
    - Exactly 2*N entries alternating user/assistant → returned in full, length 2N.
    - 2*N + 2 entries (more than window) → returned slice starts on 'user' (if the raw slice starts on 'assistant', one is dropped).
    - Explicit drop case: history is `[u1,a1,u2,a2,u3,a3,u4,a4,u5,a5,u6,a6,u7,a7]` and N=6 → last 12 = `[u2..a7]` → starts on user → returned as-is, length 12.
    - Pair-integrity case: if `slice(-2N)` begins with `assistant`, drop first entry — verify `result[0].role === 'user'` and `result.length === 2N - 1`.
    - Never modifies input: pass a const array, assert `input` unchanged after call.
    - Custom `n = 3`: returns max 6 entries.
    - Invariant: `result.length <= 2 * n` for every test case.
    - HISTORY_WINDOW_N === 6 (pinned by test so accidental change is caught).

    Do NOT try to embed round dividers in this module — per RESEARCH.md the recommendation is to prefix round context into the user message content at call time in Plan 06-07. This module stays a pure slice utility.
  </action>
  <verify>
    - `pnpm test src/lib/contextWindow.test.ts` — all tests pass.
    - `pnpm typecheck` passes.
  </verify>
  <done>
    `windowHistory` enforces the `≤ 2N` entries + pair-alignment invariant. `HISTORY_WINDOW_N` is a single exported constant. Tests cover empty, small, exact-fit, over-cap-with-user-start, over-cap-with-assistant-start, custom N, immutability.
  </done>
</task>

</tasks>

<verification>
- `pnpm test src/lib/responseParser.test.ts src/lib/contextWindow.test.ts` — all tests pass.
- `pnpm typecheck` passes across the whole project.
- Neither module imports from `gameStore.ts` — they remain pure utilities.
</verification>

<success_criteria>
- `parsePersonaResponse` satisfies RESP-01 (fence strip), RESP-02 (defensive, no throw), and includes Layer 4 sort/de-dup.
- `windowHistory` satisfies CTX-02 (sliding N=6) and maintains invariant `result.length <= 2*n && (result.length === 0 || result[0].role === 'user')`.
- Test suites collectively cover: happy path, malformed JSON, schema violations, fence/BOM, re-ordering, de-dup, empty/small/exact/over-cap history, pair alignment, immutability.
</success_criteria>

<output>
After completion, create `.planning/phases/06-llm-integration/06-05-SUMMARY.md`.
</output>
