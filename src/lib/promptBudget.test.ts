import { describe, it, expect } from 'vitest'
import {
  reportPromptBudget,
  SAFE_CONTEXT_CEILING_TOKENS,
  TOKENS_PER_TURN_ESTIMATE,
} from './promptBudget'
import { HISTORY_WINDOW_N } from './contextWindow'
import { EDIP_CONFIG } from '@/data/edipConfig'
import type { GameConfig, GameState } from '@/types/game'

// ─── Fixtures ────────────────────────────────────────────────────────────────

const config = EDIP_CONFIG as unknown as GameConfig

function makeMockState(overrides: Partial<GameState> = {}): GameState {
  const base: GameState = {
    round: 1,
    scenarioIndex: 0,
    crisisSeverity: 0,
    crisisState: 'No Crisis',
    edipLegitimacy: 0,
    teams: [
      { id: 'A', name: 'Team A', pc: 3, po: 0, readiness: 3, stock: 2, crm: 2, ic: 2 },
      { id: 'B', name: 'Team B', pc: 4, po: 1, readiness: 3, stock: 3, crm: 2, ic: 5 },
      { id: 'C', name: 'Team C', pc: 3, po: 0, readiness: 3, stock: 3, crm: 3, ic: 3 },
      { id: 'D', name: 'Team D', pc: 4, po: 1, readiness: 3, stock: 3, crm: 3, ic: 3 },
    ],
    cardsThisRound: [],
  }
  return { ...base, ...overrides }
}

// ─── Pinned constants ────────────────────────────────────────────────────────

describe('promptBudget constants (pinned)', () => {
  it('TOKENS_PER_TURN_ESTIMATE === 800 (pinned — accidental change should fail CI)', () => {
    expect(TOKENS_PER_TURN_ESTIMATE).toBe(800)
  })

  it('SAFE_CONTEXT_CEILING_TOKENS === 7500 (pinned — raise deliberately for wider deployments)', () => {
    expect(SAFE_CONTEXT_CEILING_TOKENS).toBe(7500)
  })
})

// ─── Empirical report ────────────────────────────────────────────────────────

describe('reportPromptBudget — EDIP config + fresh gameState', () => {
  const report = reportPromptBudget(config, makeMockState())

  it('returns a positive systemPromptTokens count', () => {
    expect(report.systemPromptTokens).toBeGreaterThan(0)
  })

  it('maxHistoryTokensEstimate === HISTORY_WINDOW_N × TOKENS_PER_TURN_ESTIMATE', () => {
    expect(report.maxHistoryTokensEstimate).toBe(
      HISTORY_WINDOW_N * TOKENS_PER_TURN_ESTIMATE,
    )
  })

  it('historyWindowN mirrors the exported HISTORY_WINDOW_N constant', () => {
    expect(report.historyWindowN).toBe(HISTORY_WINDOW_N)
  })

  it('safeCeiling mirrors SAFE_CONTEXT_CEILING_TOKENS', () => {
    expect(report.safeCeiling).toBe(SAFE_CONTEXT_CEILING_TOKENS)
  })

  it('totalCeilingEstimate === systemPromptTokens + maxHistoryTokensEstimate', () => {
    expect(report.totalCeilingEstimate).toBe(
      report.systemPromptTokens + report.maxHistoryTokensEstimate,
    )
  })

  it('withinLimit is boolean AND matches totalCeilingEstimate <= safeCeiling', () => {
    expect(typeof report.withinLimit).toBe('boolean')
    expect(report.withinLimit).toBe(
      report.totalCeilingEstimate <= report.safeCeiling,
    )
  })

  it('PROMPT-budget: withinLimit is true with current prompt (no regression)', () => {
    // Promoted from an informational boolean check to a hard assertion so any
    // future token regression (e.g. prompt-engineering edits that blow the
    // 7500-token ceiling) fails CI instead of silently console.info-ing
    // withinLimit: false. See 12-RESEARCH.md Risk 4.
    expect(report.withinLimit).toBe(true)
    expect(report.totalCeilingEstimate).toBeLessThanOrEqual(7500)
  })

  it('[06-08] empirical capture — console.info full report for BUDGET.md', () => {
    // This emission is the single source of truth for the empirical
    // systemPromptTokens number written into 06-08-BUDGET.md. The executor
    // captures it once from the test runner and records the chosen N.
    // eslint-disable-next-line no-console
    console.info(
      '[06-08] reportPromptBudget(EDIP_CONFIG, freshGameState) =',
      JSON.stringify(report, null, 2),
    )
    expect(report).toBeDefined()
  })
})
