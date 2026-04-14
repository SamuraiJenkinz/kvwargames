import type { HistoryEntry } from '@/types/llm'

// Re-export so callers that already import from '@/lib/contextWindow' continue
// to work. Single source of truth for the type lives in src/types/llm.ts
// (added in plan 06-02) — this avoids a type-level dependency between
// contextWindow.ts (06-05) and llmClient.ts (06-06).
export type { HistoryEntry }

/**
 * Number of user/assistant message PAIRS retained in the rolling LLM
 * conversation history. The windowed slice contains at most `2 * N` entries.
 *
 * Single tunable constant so Plan 06-08 can adjust it after empirical token
 * budget measurement. Changing this value is the only knob needed to re-tune
 * history length — all callers derive their cap from here.
 *
 * **Plan 06-08 empirical reduction (N: 6 → 2):** EDIP system prompt measured
 * at 5124 tokens against `SAFE_CONTEXT_CEILING_TOKENS = 7500` (gpt-4 8k
 * assumption). With `TOKENS_PER_TURN_ESTIMATE = 800`, only `(7500 - 5124) / 800
 * ≈ 2.97` turn-pairs fit — rounded down to 2. See
 * `.planning/phases/06-llm-integration/06-08-BUDGET.md` for the decision trail.
 * Raise this value once the corporate context window is confirmed larger than
 * 8k (e.g. to 6 for a 16k deployment, 12 for 32k).
 */
export const HISTORY_WINDOW_N = 2

/**
 * Returns the last N message-pairs (2N entries max) from history.
 *
 * Invariant: returned array either is empty or starts on a `'user'` entry.
 * Never returns an orphaned leading assistant entry — if the raw `slice(-2N)`
 * begins with `'assistant'` (because the cutoff fell mid-pair), we drop that
 * first entry to restore pair alignment.
 *
 * Pure function. Does not mutate the input array.
 *
 * @param history  Full session history (e.g. from gameStore.llmHistory).
 * @param n        Number of user/assistant pairs to retain. Defaults to
 *                 {@link HISTORY_WINDOW_N}.
 * @returns        At most `2 * n` entries; empty array if history is empty.
 */
export function windowHistory(
  history: HistoryEntry[],
  n: number = HISTORY_WINDOW_N,
): HistoryEntry[] {
  // Guard n <= 0: slice(-0) returns the full array in JavaScript (negative
  // zero is coerced to 0), which would violate the `result.length <= 2*n`
  // invariant. Return an empty array explicitly.
  if (n <= 0) return []

  const maxEntries = n * 2
  const sliced = history.slice(-maxEntries)

  if (sliced.length > 0 && sliced[0].role === 'assistant') {
    return sliced.slice(1)
  }

  return sliced
}
