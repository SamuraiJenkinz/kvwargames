import { describe, it, expect } from 'vitest'
import { EDIP_CONFIG } from '@/data/edipConfig'

// ─── Structural Counts ────────────────────────────────────────────────────────

describe('EDIP_CONFIG structural counts', () => {
  it('has exactly 2 scenarios', () => {
    expect(EDIP_CONFIG.scenarios).toHaveLength(2)
  })

  it('has exactly 4 teams', () => {
    expect(EDIP_CONFIG.teams).toHaveLength(4)
  })

  it('has exactly 11 cards', () => {
    expect(EDIP_CONFIG.cards).toHaveLength(11)
  })

  it('has exactly 4 national actions', () => {
    expect(EDIP_CONFIG.nationalActions).toHaveLength(4)
  })
})

// ─── Scenario Validation ──────────────────────────────────────────────────────

describe('EDIP_CONFIG scenario validation', () => {
  it('S1 has rounds === 4', () => {
    const s1 = EDIP_CONFIG.scenarios.find(s => s.id === 'S1')
    expect(s1).toBeDefined()
    expect(s1?.rounds).toBe(4)
  })

  it('S1 has 4 injects', () => {
    const s1 = EDIP_CONFIG.scenarios.find(s => s.id === 'S1')
    expect(s1?.injects).toHaveLength(4)
  })

  it('S2 has rounds === 5', () => {
    const s2 = EDIP_CONFIG.scenarios.find(s => s.id === 'S2')
    expect(s2).toBeDefined()
    expect(s2?.rounds).toBe(5)
  })

  it('S2 has 5 injects', () => {
    const s2 = EDIP_CONFIG.scenarios.find(s => s.id === 'S2')
    expect(s2?.injects).toHaveLength(5)
  })

  it('S1 startState: crisisSeverity === 0', () => {
    const s1 = EDIP_CONFIG.scenarios.find(s => s.id === 'S1')
    expect(s1?.startState.crisisSeverity).toBe(0)
  })

  it('S1 startState: crisisState === "No Crisis"', () => {
    const s1 = EDIP_CONFIG.scenarios.find(s => s.id === 'S1')
    expect(s1?.startState.crisisState).toBe('No Crisis')
  })

  it('S1 startState: edipLegitimacy === 0', () => {
    const s1 = EDIP_CONFIG.scenarios.find(s => s.id === 'S1')
    expect(s1?.startState.edipLegitimacy).toBe(0)
  })

  it('S2 startState: crisisSeverity === 0', () => {
    const s2 = EDIP_CONFIG.scenarios.find(s => s.id === 'S2')
    expect(s2?.startState.crisisSeverity).toBe(0)
  })

  it('S2 startState: crisisState === "No Crisis"', () => {
    const s2 = EDIP_CONFIG.scenarios.find(s => s.id === 'S2')
    expect(s2?.startState.crisisState).toBe('No Crisis')
  })

  it('S2 startState: edipLegitimacy === 0', () => {
    const s2 = EDIP_CONFIG.scenarios.find(s => s.id === 'S2')
    expect(s2?.startState.edipLegitimacy).toBe(0)
  })
})

// ─── Team Starting Values ─────────────────────────────────────────────────────

describe('EDIP_CONFIG team starting resource values', () => {
  it.each([
    { id: 'A', pc: 3, po: 0, readiness: 3, stock: 2, crm: 2, ic: 2 },
    { id: 'B', pc: 4, po: 1, readiness: 3, stock: 3, crm: 2, ic: 5 },
    { id: 'C', pc: 3, po: 0, readiness: 3, stock: 3, crm: 3, ic: 3 },
    { id: 'D', pc: 4, po: 1, readiness: 3, stock: 3, crm: 3, ic: 3 },
  ])('Team $id has correct starting resources', ({ id, pc, po, readiness, stock, crm, ic }) => {
    const team = EDIP_CONFIG.teams.find(t => t.id === id)
    expect(team).toBeDefined()
    expect(team?.pc).toBe(pc)
    expect(team?.po).toBe(po)
    expect(team?.readiness).toBe(readiness)
    expect(team?.stock).toBe(stock)
    expect(team?.crm).toBe(crm)
    expect(team?.ic).toBe(ic)
  })
})

// ─── Card IDs Completeness ────────────────────────────────────────────────────

describe('EDIP_CONFIG card IDs completeness', () => {
  const expectedCardIds = [
    'CS-01', 'CS-02',
    'MP-01', 'MP-02',
    'SP-01', 'SP-02',
    'CP-01',
    'PA-01', 'PA-02', 'PA-03',
    'TR-01',
  ]

  it.each(expectedCardIds)('card %s is present', (cardId) => {
    const card = EDIP_CONFIG.cards.find(c => c.id === cardId)
    expect(card).toBeDefined()
  })

  it('each card has a non-empty name', () => {
    for (const card of EDIP_CONFIG.cards) {
      expect(card.name.length).toBeGreaterThan(0)
    }
  })

  it('each card has a non-empty cat', () => {
    for (const card of EDIP_CONFIG.cards) {
      expect(card.cat.length).toBeGreaterThan(0)
    }
  })

  it('each card has a non-empty timing', () => {
    for (const card of EDIP_CONFIG.cards) {
      expect(card.timing.length).toBeGreaterThan(0)
    }
  })

  it('each card has a non-empty req', () => {
    for (const card of EDIP_CONFIG.cards) {
      expect(card.req.length).toBeGreaterThan(0)
    }
  })

  it('each card has a non-empty effect', () => {
    for (const card of EDIP_CONFIG.cards) {
      expect(card.effect.length).toBeGreaterThan(0)
    }
  })
})

// ─── National Action IDs ──────────────────────────────────────────────────────

describe('EDIP_CONFIG national action IDs', () => {
  const expectedNaIds = ['NA-1', 'NA-2', 'NA-3', 'NA-4']

  it.each(expectedNaIds)('national action %s is present', (naId) => {
    const na = EDIP_CONFIG.nationalActions.find(n => n.id === naId)
    expect(na).toBeDefined()
  })

  it('each national action has a non-empty name', () => {
    for (const na of EDIP_CONFIG.nationalActions) {
      expect(na.name.length).toBeGreaterThan(0)
    }
  })

  it('each national action has a non-empty summary', () => {
    for (const na of EDIP_CONFIG.nationalActions) {
      expect(na.summary.length).toBeGreaterThan(0)
    }
  })

  it('each national action has a non-empty cost', () => {
    for (const na of EDIP_CONFIG.nationalActions) {
      expect(na.cost.length).toBeGreaterThan(0)
    }
  })
})

// ─── Guide Text Fields Non-Empty ──────────────────────────────────────────────

describe('EDIP_CONFIG guide text fields', () => {
  it.each([
    'objective',
    'redLines',
    'pcThresholds',
    'votingRule',
    'eoMechanic',
    'resourceLogic',
    'facilitation',
  ] as const)('field "%s" is a non-empty string with length > 50', (field) => {
    const value = EDIP_CONFIG[field]
    expect(typeof value).toBe('string')
    expect(value.length).toBeGreaterThan(50)
  })
})

// ─── Team Metadata Completeness ───────────────────────────────────────────────

describe('EDIP_CONFIG team metadata completeness', () => {
  it('each team has exactly 2 personas', () => {
    for (const team of EDIP_CONFIG.teams) {
      expect(team.personas).toHaveLength(2)
    }
  })

  it('each team has a non-empty uniqueAction', () => {
    for (const team of EDIP_CONFIG.teams) {
      expect(team.uniqueAction.length).toBeGreaterThan(0)
    }
  })

  it('each team has a non-empty description', () => {
    for (const team of EDIP_CONFIG.teams) {
      expect(team.description.length).toBeGreaterThan(0)
    }
  })
})
