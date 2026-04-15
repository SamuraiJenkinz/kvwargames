import { describe, it, expect } from 'vitest'
import { applyStateUpdatePure, CLAMP_RANGES } from './stateUpdater'
import { parsePersonaResponse } from './responseParser'
import type { GameState, StateUpdate, TeamState } from '@/types/game'

// ─── Test Fixtures ────────────────────────────────────────────────────────────

const makeTeam = (id: string, overrides: Partial<TeamState> = {}): TeamState => ({
  id,
  name: `Team ${id}`,
  pc: 3,
  po: 0,
  readiness: 2,
  stock: 10,
  crm: 10,
  ic: 10,
  ...overrides,
})

const makeState = (overrides: Partial<GameState> = {}): GameState => ({
  round: 1,
  scenarioIndex: 0,
  crisisSeverity: 1,
  crisisState: 'No Crisis',
  edipLegitimacy: 0,
  teams: [makeTeam('A'), makeTeam('B')],
  cardsThisRound: [],
  ...overrides,
})

// ─── CLAMP_RANGES constant ────────────────────────────────────────────────────

describe('CLAMP_RANGES', () => {
  it('exports the canonical ranges matching gameStore inline clamps', () => {
    expect(CLAMP_RANGES.crisisSeverity).toEqual([0, 5])
    expect(CLAMP_RANGES.edipLegitimacy).toEqual([-2, 2])
    expect(CLAMP_RANGES.pc).toEqual([0, 6])
    expect(CLAMP_RANGES.po).toEqual([-2, 2])
    expect(CLAMP_RANGES.readiness).toEqual([0, 5])
    expect(CLAMP_RANGES.stock).toEqual([0, 99])
    expect(CLAMP_RANGES.crm).toEqual([0, 99])
    expect(CLAMP_RANGES.ic).toEqual([0, 99])
  })
})

// ─── Happy path / no-op ──────────────────────────────────────────────────────

describe('applyStateUpdatePure — top-level fields in range', () => {
  it('applies crisisSeverity in range and returns empty clampLog', () => {
    const state = makeState({ crisisSeverity: 1 })
    const { nextState, clampLog } = applyStateUpdatePure(state, { crisisSeverity: 3 })
    expect(nextState.crisisSeverity).toBe(3)
    expect(clampLog).toEqual([])
  })

  it('applies crisisState (string) without clamping', () => {
    const state = makeState()
    const { nextState, clampLog } = applyStateUpdatePure(state, {
      crisisState: 'Supply Crisis',
    })
    expect(nextState.crisisState).toBe('Supply Crisis')
    expect(clampLog).toEqual([])
  })

  it('applies edipLegitimacy in range', () => {
    const state = makeState()
    const { nextState, clampLog } = applyStateUpdatePure(state, { edipLegitimacy: 1 })
    expect(nextState.edipLegitimacy).toBe(1)
    expect(clampLog).toEqual([])
  })
})

// ─── Clamping (above/below) ──────────────────────────────────────────────────

describe('applyStateUpdatePure — clamping above max', () => {
  it('clamps crisisSeverity 7 → 5 and records clampLog', () => {
    const state = makeState({ crisisSeverity: 1 })
    const { nextState, clampLog } = applyStateUpdatePure(state, { crisisSeverity: 7 })
    expect(nextState.crisisSeverity).toBe(5)
    expect(clampLog).toContainEqual({ field: 'crisisSeverity', raw: 7, clamped: 5 })
  })

  it('clamps edipLegitimacy 5 → 2 and records clampLog', () => {
    const state = makeState()
    const { nextState, clampLog } = applyStateUpdatePure(state, { edipLegitimacy: 5 })
    expect(nextState.edipLegitimacy).toBe(2)
    expect(clampLog).toContainEqual({ field: 'edipLegitimacy', raw: 5, clamped: 2 })
  })
})

describe('applyStateUpdatePure — clamping below min', () => {
  it('clamps edipLegitimacy -5 → -2 and records clampLog', () => {
    const state = makeState()
    const { nextState, clampLog } = applyStateUpdatePure(state, { edipLegitimacy: -5 })
    expect(nextState.edipLegitimacy).toBe(-2)
    expect(clampLog).toContainEqual({ field: 'edipLegitimacy', raw: -5, clamped: -2 })
  })

  it('clamps crisisSeverity -3 → 0 and records clampLog', () => {
    const state = makeState({ crisisSeverity: 2 })
    const { nextState, clampLog } = applyStateUpdatePure(state, { crisisSeverity: -3 })
    expect(nextState.crisisSeverity).toBe(0)
    expect(clampLog).toContainEqual({ field: 'crisisSeverity', raw: -3, clamped: 0 })
  })
})

// ─── Null / undefined / missing ─────────────────────────────────────────────

describe('applyStateUpdatePure — null and missing fields are no-ops', () => {
  it('null field does not mutate state and no clampLog entry', () => {
    const state = makeState({ crisisSeverity: 2 })
    const { nextState, clampLog } = applyStateUpdatePure(state, {
      crisisSeverity: null as unknown as number,
    })
    expect(nextState.crisisSeverity).toBe(2)
    expect(clampLog).toEqual([])
  })

  it('undefined field is a no-op', () => {
    const state = makeState({ crisisSeverity: 2 })
    const { nextState, clampLog } = applyStateUpdatePure(state, {
      crisisSeverity: undefined,
    })
    expect(nextState.crisisSeverity).toBe(2)
    expect(clampLog).toEqual([])
  })

  it('empty update produces state deep-equal to input and empty clampLog', () => {
    const state = makeState()
    const { nextState, clampLog } = applyStateUpdatePure(state, {})
    expect(nextState).toEqual(state)
    expect(clampLog).toEqual([])
  })
})

// ─── Team updates ───────────────────────────────────────────────────────────

describe('applyStateUpdatePure — team matching by ID', () => {
  it('updates only the matched team by id, not by index', () => {
    const state = makeState({
      teams: [makeTeam('A', { pc: 1 }), makeTeam('B', { pc: 1 })],
    })
    const update: StateUpdate = { teamUpdates: [{ id: 'B', pc: 4 }] }
    const { nextState, clampLog } = applyStateUpdatePure(state, update)
    const teamA = nextState.teams.find((t) => t.id === 'A')!
    const teamB = nextState.teams.find((t) => t.id === 'B')!
    expect(teamA.pc).toBe(1)
    expect(teamB.pc).toBe(4)
    expect(clampLog).toEqual([])
  })

  it('silently skips unknown team ID — no throw, no clampLog, no mutation', () => {
    const state = makeState()
    const snapshot = JSON.stringify(state)
    const { nextState, clampLog } = applyStateUpdatePure(state, {
      teamUpdates: [{ id: 'Z', pc: 3 }],
    })
    expect(clampLog).toEqual([])
    expect(JSON.stringify(nextState)).toBe(snapshot)
  })

  it('applies updates to multiple teams in one call', () => {
    const state = makeState({
      teams: [makeTeam('A', { pc: 1 }), makeTeam('B', { pc: 1 })],
    })
    const { nextState } = applyStateUpdatePure(state, {
      teamUpdates: [
        { id: 'A', pc: 2 },
        { id: 'B', pc: 5 },
      ],
    })
    expect(nextState.teams.find((t) => t.id === 'A')!.pc).toBe(2)
    expect(nextState.teams.find((t) => t.id === 'B')!.pc).toBe(5)
  })
})

// ─── Team field boundaries ──────────────────────────────────────────────────

describe('applyStateUpdatePure — PC boundary (0..6)', () => {
  it('accepts pc=0 and pc=6', () => {
    const state = makeState()
    const { nextState: s1, clampLog: log1 } = applyStateUpdatePure(state, {
      teamUpdates: [{ id: 'A', pc: 0 }],
    })
    expect(s1.teams.find((t) => t.id === 'A')!.pc).toBe(0)
    expect(log1).toEqual([])

    const { nextState: s2, clampLog: log2 } = applyStateUpdatePure(state, {
      teamUpdates: [{ id: 'A', pc: 6 }],
    })
    expect(s2.teams.find((t) => t.id === 'A')!.pc).toBe(6)
    expect(log2).toEqual([])
  })

  it('clamps pc=-1 → 0 and pc=7 → 6', () => {
    const state = makeState()
    const { nextState: sLow, clampLog: logLow } = applyStateUpdatePure(state, {
      teamUpdates: [{ id: 'A', pc: -1 }],
    })
    expect(sLow.teams.find((t) => t.id === 'A')!.pc).toBe(0)
    expect(logLow).toContainEqual({ field: 'teams[A].pc', raw: -1, clamped: 0 })

    const { nextState: sHigh, clampLog: logHigh } = applyStateUpdatePure(state, {
      teamUpdates: [{ id: 'A', pc: 7 }],
    })
    expect(sHigh.teams.find((t) => t.id === 'A')!.pc).toBe(6)
    expect(logHigh).toContainEqual({ field: 'teams[A].pc', raw: 7, clamped: 6 })
  })
})

describe('applyStateUpdatePure — PO boundary (-2..+2)', () => {
  it('accepts po=-2 and po=2', () => {
    const state = makeState()
    const { nextState: s1, clampLog: log1 } = applyStateUpdatePure(state, {
      teamUpdates: [{ id: 'A', po: -2 }],
    })
    expect(s1.teams.find((t) => t.id === 'A')!.po).toBe(-2)
    expect(log1).toEqual([])

    const { nextState: s2, clampLog: log2 } = applyStateUpdatePure(state, {
      teamUpdates: [{ id: 'A', po: 2 }],
    })
    expect(s2.teams.find((t) => t.id === 'A')!.po).toBe(2)
    expect(log2).toEqual([])
  })

  it('clamps po=-3 → -2 and po=3 → 2', () => {
    const state = makeState()
    const { nextState: sLow, clampLog: logLow } = applyStateUpdatePure(state, {
      teamUpdates: [{ id: 'A', po: -3 }],
    })
    expect(sLow.teams.find((t) => t.id === 'A')!.po).toBe(-2)
    expect(logLow).toContainEqual({ field: 'teams[A].po', raw: -3, clamped: -2 })

    const { nextState: sHigh, clampLog: logHigh } = applyStateUpdatePure(state, {
      teamUpdates: [{ id: 'A', po: 3 }],
    })
    expect(sHigh.teams.find((t) => t.id === 'A')!.po).toBe(2)
    expect(logHigh).toContainEqual({ field: 'teams[A].po', raw: 3, clamped: 2 })
  })
})

describe('applyStateUpdatePure — readiness boundary (0..5)', () => {
  it('accepts readiness=0 and readiness=5', () => {
    const state = makeState()
    const { nextState: s1, clampLog: log1 } = applyStateUpdatePure(state, {
      teamUpdates: [{ id: 'A', readiness: 0 }],
    })
    expect(s1.teams.find((t) => t.id === 'A')!.readiness).toBe(0)
    expect(log1).toEqual([])

    const { nextState: s2, clampLog: log2 } = applyStateUpdatePure(state, {
      teamUpdates: [{ id: 'A', readiness: 5 }],
    })
    expect(s2.teams.find((t) => t.id === 'A')!.readiness).toBe(5)
    expect(log2).toEqual([])
  })

  it('clamps readiness=-1 → 0 and readiness=6 → 5', () => {
    const state = makeState()
    const { nextState: sLow, clampLog: logLow } = applyStateUpdatePure(state, {
      teamUpdates: [{ id: 'A', readiness: -1 }],
    })
    expect(sLow.teams.find((t) => t.id === 'A')!.readiness).toBe(0)
    expect(logLow).toContainEqual({
      field: 'teams[A].readiness',
      raw: -1,
      clamped: 0,
    })

    const { nextState: sHigh, clampLog: logHigh } = applyStateUpdatePure(state, {
      teamUpdates: [{ id: 'A', readiness: 6 }],
    })
    expect(sHigh.teams.find((t) => t.id === 'A')!.readiness).toBe(5)
    expect(logHigh).toContainEqual({
      field: 'teams[A].readiness',
      raw: 6,
      clamped: 5,
    })
  })
})

describe('applyStateUpdatePure — stock/crm/ic boundary (0..99)', () => {
  it('accepts 0 and 99 for stock, crm, ic', () => {
    const state = makeState()
    const { nextState, clampLog } = applyStateUpdatePure(state, {
      teamUpdates: [{ id: 'A', stock: 0, crm: 99, ic: 50 }],
    })
    const teamA = nextState.teams.find((t) => t.id === 'A')!
    expect(teamA.stock).toBe(0)
    expect(teamA.crm).toBe(99)
    expect(teamA.ic).toBe(50)
    expect(clampLog).toEqual([])
  })

  it('clamps stock=-1 → 0 and stock=100 → 99', () => {
    const state = makeState()
    const { nextState: sLow, clampLog: logLow } = applyStateUpdatePure(state, {
      teamUpdates: [{ id: 'A', stock: -1 }],
    })
    expect(sLow.teams.find((t) => t.id === 'A')!.stock).toBe(0)
    expect(logLow).toContainEqual({ field: 'teams[A].stock', raw: -1, clamped: 0 })

    const { nextState: sHigh, clampLog: logHigh } = applyStateUpdatePure(state, {
      teamUpdates: [{ id: 'A', stock: 100 }],
    })
    expect(sHigh.teams.find((t) => t.id === 'A')!.stock).toBe(99)
    expect(logHigh).toContainEqual({
      field: 'teams[A].stock',
      raw: 100,
      clamped: 99,
    })
  })

  it('clamps crm=150 → 99 and ic=-5 → 0', () => {
    const state = makeState()
    const { nextState, clampLog } = applyStateUpdatePure(state, {
      teamUpdates: [{ id: 'A', crm: 150, ic: -5 }],
    })
    const teamA = nextState.teams.find((t) => t.id === 'A')!
    expect(teamA.crm).toBe(99)
    expect(teamA.ic).toBe(0)
    expect(clampLog).toContainEqual({ field: 'teams[A].crm', raw: 150, clamped: 99 })
    expect(clampLog).toContainEqual({ field: 'teams[A].ic', raw: -5, clamped: 0 })
  })
})

// ─── Immutability ───────────────────────────────────────────────────────────

describe('applyStateUpdatePure — immutability', () => {
  it('does not mutate input state (JSON snapshot equality)', () => {
    const state = makeState({ crisisSeverity: 1 })
    const snapshot = JSON.stringify(state)
    applyStateUpdatePure(state, {
      crisisSeverity: 99,
      teamUpdates: [{ id: 'A', pc: 99 }],
    })
    expect(JSON.stringify(state)).toBe(snapshot)
  })

  it('returns a new state reference and new teams array reference', () => {
    const state = makeState()
    const { nextState } = applyStateUpdatePure(state, { crisisSeverity: 2 })
    expect(nextState).not.toBe(state)
    expect(nextState.teams).not.toBe(state.teams)
  })

  it('unknown team ID still returns a new state reference (pure)', () => {
    const state = makeState()
    const { nextState } = applyStateUpdatePure(state, {
      teamUpdates: [{ id: 'Z', pc: 3 }],
    })
    expect(nextState).not.toBe(state)
  })
})

// ─── Clamp field path formatting ────────────────────────────────────────────

describe('applyStateUpdatePure — clampLog field path format', () => {
  it('top-level field uses bare name', () => {
    const state = makeState()
    const { clampLog } = applyStateUpdatePure(state, { crisisSeverity: 10 })
    expect(clampLog[0]?.field).toBe('crisisSeverity')
  })

  it('team field uses teams[ID].field format', () => {
    const state = makeState()
    const { clampLog } = applyStateUpdatePure(state, {
      teamUpdates: [{ id: 'B', pc: 20 }],
    })
    expect(clampLog[0]?.field).toBe('teams[B].pc')
  })
})

// ─── Phase 8 boundary coverage (08-01) ──────────────────────────────────────
// Direct evidence for Phase 8 success criterion #4: at-boundary acceptance +
// just-above-max clamping for crisisSeverity and edipLegitimacy, plus
// null/undefined no-op semantics extended into team-scoped updates.

describe('applyStateUpdatePure — crisisSeverity boundary (0..5)', () => {
  it('accepts crisisSeverity=0 and crisisSeverity=5', () => {
    const state = makeState({ crisisSeverity: 3 })
    const { nextState: s1, clampLog: log1 } = applyStateUpdatePure(state, { crisisSeverity: 0 })
    expect(s1.crisisSeverity).toBe(0)
    expect(log1).toEqual([])

    const { nextState: s2, clampLog: log2 } = applyStateUpdatePure(state, { crisisSeverity: 5 })
    expect(s2.crisisSeverity).toBe(5)
    expect(log2).toEqual([])
  })

  it('clamps crisisSeverity=6 → 5 and records clampLog', () => {
    const state = makeState({ crisisSeverity: 3 })
    const { nextState, clampLog } = applyStateUpdatePure(state, { crisisSeverity: 6 })
    expect(nextState.crisisSeverity).toBe(5)
    expect(clampLog).toContainEqual({ field: 'crisisSeverity', raw: 6, clamped: 5 })
  })
})

describe('applyStateUpdatePure — edipLegitimacy boundary (-2..+2)', () => {
  it('accepts edipLegitimacy=-2 and edipLegitimacy=+2', () => {
    const state = makeState({ edipLegitimacy: 0 })
    const { nextState: s1, clampLog: log1 } = applyStateUpdatePure(state, { edipLegitimacy: -2 })
    expect(s1.edipLegitimacy).toBe(-2)
    expect(log1).toEqual([])

    const { nextState: s2, clampLog: log2 } = applyStateUpdatePure(state, { edipLegitimacy: 2 })
    expect(s2.edipLegitimacy).toBe(2)
    expect(log2).toEqual([])
  })

  it('clamps edipLegitimacy=+3 → +2 and records clampLog', () => {
    const state = makeState({ edipLegitimacy: 0 })
    const { nextState, clampLog } = applyStateUpdatePure(state, { edipLegitimacy: 3 })
    expect(nextState.edipLegitimacy).toBe(2)
    expect(clampLog).toContainEqual({ field: 'edipLegitimacy', raw: 3, clamped: 2 })
  })
})

describe('applyStateUpdatePure — team-field null/undefined no-op', () => {
  // Plan 08-01 decision #5 extends top-level null/undefined coverage (lines 109/118)
  // into the team layer. StateUpdate's team-scoped key is `teamUpdates` (not `teams`);
  // the applyTeamUpdate helper treats null/undefined via `if (value == null) continue`.
  it('treats teamUpdates[].pc = null as no-op (preserves existing pc)', () => {
    const state = makeState({ teams: [makeTeam('A', { pc: 4 })] })
    const update: StateUpdate = {
      teamUpdates: [{ id: 'A', pc: null as unknown as number }],
    }
    const { nextState, clampLog } = applyStateUpdatePure(state, update)
    expect(nextState.teams.find((t) => t.id === 'A')!.pc).toBe(4)
    expect(clampLog).toEqual([])
  })

  it('treats teamUpdates[].pc = undefined as no-op (preserves existing pc)', () => {
    const state = makeState({ teams: [makeTeam('A', { pc: 4 })] })
    const update: StateUpdate = {
      teamUpdates: [{ id: 'A', pc: undefined }],
    }
    const { nextState, clampLog } = applyStateUpdatePure(state, update)
    expect(nextState.teams.find((t) => t.id === 'A')!.pc).toBe(4)
    expect(clampLog).toEqual([])
  })
})

// ─── crisisState pass-through (PROMPT-01) ───────────────────────────────────
// Integration: a raw Finch JSON response carrying a crisisState transition
// must flow through parsePersonaResponse → applyStateUpdatePure and land on
// gameState.crisisState with exact string equality. stateUpdater.ts passes
// crisisState through with no enum validation (per 12-RESEARCH.md Q6), so
// the exact literal string shipped in the prompt is what the LLM must emit
// verbatim.

describe('crisisState pass-through (PROMPT-01)', () => {
  it('parses and applies crisisState: "Security-Related Supply Crisis" end-to-end', () => {
    const jsonString = JSON.stringify({
      responses: [
        {
          speaker: 'finch',
          message:
            'Adversary tempo is escalating; supply corridors are now a contested space.',
          stateUpdate: {
            crisisSeverity: 4,
            crisisState: 'Security-Related Supply Crisis',
          },
          flag: null,
        },
      ],
    })

    const result = parsePersonaResponse(jsonString)
    expect(result.ok).toBe(true)
    if (!result.ok) return // type narrowing for tsc

    const finchResponse = result.value.responses.find(
      (r) => r.speaker === 'finch',
    )
    expect(finchResponse).toBeDefined()
    const finchStateUpdate = finchResponse!.stateUpdate as StateUpdate
    expect(finchStateUpdate).not.toBeNull()

    const initialState = makeState({
      crisisSeverity: 2,
      crisisState: 'Supply Crisis',
    })
    const { nextState } = applyStateUpdatePure(initialState, finchStateUpdate)

    // Exact string equality — the canonical literal must pass through
    // untransformed (stateUpdater.ts lines 120–122, no enum validation).
    expect(nextState.crisisState).toBe('Security-Related Supply Crisis')
    // Clamp confirms severity=4 (within 0..5) passes through to state.
    expect(nextState.crisisSeverity).toBe(4)
  })

  it('parses and applies crisisState: "Supply Crisis" at the severity=2 transition', () => {
    const jsonString = JSON.stringify({
      responses: [
        {
          speaker: 'finch',
          message:
            'Stock draw-downs have crossed the operational threshold; this is now a supply crisis.',
          stateUpdate: {
            crisisSeverity: 2,
            crisisState: 'Supply Crisis',
          },
          flag: null,
        },
      ],
    })

    const result = parsePersonaResponse(jsonString)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const finchResponse = result.value.responses.find(
      (r) => r.speaker === 'finch',
    )
    const finchStateUpdate = finchResponse!.stateUpdate as StateUpdate

    const initialState = makeState({
      crisisSeverity: 1,
      crisisState: 'No Crisis',
    })
    const { nextState } = applyStateUpdatePure(initialState, finchStateUpdate)

    expect(nextState.crisisState).toBe('Supply Crisis')
    expect(nextState.crisisSeverity).toBe(2)
  })
})
