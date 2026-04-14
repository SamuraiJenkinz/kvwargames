import type { GameConfig, GameState } from '@/types/game'
import { buildSystemPrompt, measurePromptTokens } from './promptBuilder'
import { HISTORY_WINDOW_N } from './contextWindow'

/**
 * Safe input-context ceiling, chosen for the most constrained documented
 * corporate deployment (gpt-4 8k). Leaves ~500 tokens for LLM output.
 * Raise to 24000+ for gpt-4o-mini-128k / gpt-4-32k deployments.
 *
 * If the corporate deployment context window is later confirmed to be larger
 * (e.g. 32k or 128k), update this constant and re-run the budget test to
 * re-validate `withinLimit`. See .planning/phases/06-llm-integration/06-08-BUDGET.md.
 */
export const SAFE_CONTEXT_CEILING_TOKENS = 7500

/**
 * Rough per-turn estimate: ~250 tokens facilitator input + ~550 tokens for the
 * 3-persona JSON response (speaker + message + stateUpdate + flag, ×3). Original
 * estimate of 500 was too low for the realistic JSON shape — calibrated to 800
 * pre-empirically and re-validated post-smoke-test against an actual response.
 *
 * Pinned in `promptBudget.test.ts`; any drift is caught by the test suite so
 * the budget arithmetic stays honest.
 */
export const TOKENS_PER_TURN_ESTIMATE = 800

export interface PromptBudgetReport {
  systemPromptTokens: number
  historyWindowN: number
  maxHistoryTokensEstimate: number
  totalCeilingEstimate: number
  safeCeiling: number
  withinLimit: boolean
}

/**
 * Compute an empirical token-budget report for the current prompt + history
 * window configuration.
 *
 * Pure function. No side-effects. Safe to call per-init; cheap because
 * {@link measurePromptTokens} is just `ceil(len/4)` over the composed prompt.
 *
 * CTX-03: This report is logged in DEV via `initGame` so over-budget
 * configurations surface loudly as `console.error`, not silently.
 *
 * @param config     Active GameConfig (e.g. EDIP_CONFIG).
 * @param gameState  Live GameState at init.
 * @returns          A {@link PromptBudgetReport} with the systemPrompt token
 *                   count, the estimated history ceiling (2N × per-turn), the
 *                   total against the safe ceiling, and a boolean verdict.
 */
export function reportPromptBudget(
  config: GameConfig,
  gameState: GameState,
): PromptBudgetReport {
  const systemPromptTokens = measurePromptTokens(buildSystemPrompt(config, gameState))
  const maxHistoryTokensEstimate = HISTORY_WINDOW_N * TOKENS_PER_TURN_ESTIMATE
  const totalCeilingEstimate = systemPromptTokens + maxHistoryTokensEstimate
  return {
    systemPromptTokens,
    historyWindowN: HISTORY_WINDOW_N,
    maxHistoryTokensEstimate,
    totalCeilingEstimate,
    safeCeiling: SAFE_CONTEXT_CEILING_TOKENS,
    withinLimit: totalCeilingEstimate <= SAFE_CONTEXT_CEILING_TOKENS,
  }
}
