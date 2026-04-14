# Phase 6 Plan 08 — Empirical Token Budget Report

**Date:** 2026-04-14
**Plan:** [06-08-token-budget-and-smoke-test-PLAN.md](./06-08-token-budget-and-smoke-test-PLAN.md)
**Requirement:** CTX-03 (token budget ceiling enforced, non-silent)

---

## Empirical Measurement

Captured via `pnpm test src/lib/promptBudget.test.ts --reporter=verbose`:

```json
{
  "systemPromptTokens": 5124,
  "historyWindowN": 2,
  "maxHistoryTokensEstimate": 1600,
  "totalCeilingEstimate": 6724,
  "safeCeiling": 7500,
  "withinLimit": true
}
```

- **systemPromptTokens:** `5124` — token count of the full 10-block system prompt built against `EDIP_CONFIG` + a fresh round-1 GameState (4 teams, scenario index 0). Computed via `measurePromptTokens(buildSystemPrompt(config, state))` using the `ceil(len/4)` heuristic.
- **TOKENS_PER_TURN_ESTIMATE:** `800` (pinned) — 250 facilitator input + 550 three-persona JSON response.
- **HISTORY_WINDOW_N:** `2` (pinned post-reduction).
- **SAFE_CONTEXT_CEILING_TOKENS:** `7500` — gpt-4 8k assumption (leaves ~500 tokens for LLM output).

**Arithmetic:**
```
total = systemPromptTokens + HISTORY_WINDOW_N × TOKENS_PER_TURN_ESTIMATE
      = 5124 + 2 × 800
      = 6724
safeCeiling = 7500
withinLimit = (6724 ≤ 7500) = true   ✅
```

## Decision: Reduce `HISTORY_WINDOW_N` from 6 → 2

**Why reduction was required:**

The initial plan value was `N = 6`. At that setting:

```
total(N=6) = 5124 + 6 × 800 = 5124 + 4800 = 9924 tokens
9924 > 7500  →  withinLimit = false   ❌
```

An over-budget configuration would silently (or loudly, given CTX-03's DEV `console.error` wiring) fail against an 8k-class corporate deployment. CTX-03 requires the budget ceiling to be enforced, not silently overshot.

**Largest safe `N` for 8k deployment:**

```
max N such that 5124 + N × 800 ≤ 7500
N × 800 ≤ 2376
N ≤ 2.97
⇒ N = 2   (largest safe integer)
```

At `N = 2`:
- Rolling history window holds up to `2 × N = 4` entries (two user/assistant pairs).
- `gameStore.runLLMTurn` caps `llmHistory.length ≤ 2 × N + 1 = 5` (see Plan 06-07).
- Remaining headroom: `7500 − 6724 = 776 tokens` (~one full turn of slack for persona voice drift / unusually long facilitator input).

**Tradeoff accepted:**

A 2-pair window is short — the personas effectively see only the last two facilitator exchanges plus the full system prompt. The system prompt is where persona voice lives (Block 7 × 10-block builder), so voice consistency is not degraded. What *is* degraded: the personas' ability to reference specifics from turns 3+ rounds ago in-thread. This is acceptable for a facilitated wargame where the facilitator is the continuity layer, and it is explicitly reversible once the deployment context window is confirmed wider than 8k.

## Deployment Assumptions

| Deployment class | Context window | Safe input ceiling (leaving ~500 for output) | Max N @ 800 tok/turn with 5124 sys-prompt |
|------------------|---------------:|---------------------------------------------:|------------------------------------------:|
| **gpt-4 8k (current)** | 8192 | 7500 | **2** ← selected |
| gpt-4o 16k | 16384 | 15500 | 12 |
| gpt-4-32k | 32768 | 31500 | 32 |
| gpt-4o-mini 128k | 131072 | 128000 | 153 (effectively unbounded) |

### ⚠️ Context-window-unconfirmed flag

The corporate deployment context window **has not been confirmed in writing** at the time of Plan 06-08 execution. `SAFE_CONTEXT_CEILING_TOKENS = 7500` assumes the most constrained plausible class (gpt-4 8k). This is a conservative default.

**Phase 8 follow-up (flagged):** Confirm with ops which model+context size the corporate Azure endpoint exposes. If it is ≥16k, raise `SAFE_CONTEXT_CEILING_TOKENS` and increase `HISTORY_WINDOW_N` accordingly (e.g. to 6 for 16k, 12 for 32k). Re-run `pnpm test src/lib/promptBudget.test.ts` to verify `withinLimit === true` after the change. Update both constants in a single commit plus the pinned `HISTORY_WINDOW_N` test.

## Files Changed

- `src/lib/promptBudget.ts` (new) — `reportPromptBudget()` + `SAFE_CONTEXT_CEILING_TOKENS` + `TOKENS_PER_TURN_ESTIMATE`.
- `src/lib/promptBudget.test.ts` (new) — 9 tests; pins constants; `console.info`s empirical report.
- `src/lib/contextWindow.ts` — `HISTORY_WINDOW_N: 6 → 2` with inline rationale.
- `src/lib/contextWindow.test.ts` — pinned-value test updated from `toBe(6)` → `toBe(2)`; one "no trim" fixture resized from 3 pairs → 1 pair (N=2 caps at 4 entries).
- `src/lib/gameStore.ts` — `initGame` wired to call `reportPromptBudget()` in `import.meta.env.DEV`; `console.info` on `withinLimit`, `console.error` on exceeded (CTX-03).
- `src/lib/gameStore.test.ts` — `@/lib/promptBuilder` mock exports `measurePromptTokens`; `@/lib/contextWindow` mock `HISTORY_WINDOW_N: 2`.
- `src/components/game/FacilitatorInput/FacilitatorInput.test.tsx` — same mock updates.

## Verification

- `pnpm test` — **388 / 388 passing** (17 test files).
- `pnpm typecheck` — clean.
- `reportPromptBudget()` logged in DEV as `console.info` on every `initGame`; over-budget configurations produce a red `console.error` containing `CTX-03 BUDGET EXCEEDED` that is impossible to miss in DevTools.

## Post-Smoke-Test Recalibration (deferred to Task 2)

During the live smoke test (Task 2), the executor should:

1. Capture one real LLM response from DevTools → Network → `/api/llm`.
2. Compute `actualTurnTokens ≈ (userMessage.length + assistantResponse.length) / 4`.
3. Confirm `TOKENS_PER_TURN_ESTIMATE = 800` is within ±20% of `actualTurnTokens`.
4. If outside that band, update `TOKENS_PER_TURN_ESTIMATE` in `promptBudget.ts` + pinned-value test, re-run `pnpm test`, re-run the budget report, and append the measurement + new value to this document under a "Task 2 recalibration" section.

## Phase 8 Open Items

1. **Confirm corporate deployment context size with ops** (blocker for raising N back to 6+).
2. **Optional: switch from `ceil(len/4)` heuristic to `tiktoken` for authoritative counts** — cheap gains but adds an npm dependency; defer unless the 4-char-per-token heuristic proves off by >10% after live measurement.
