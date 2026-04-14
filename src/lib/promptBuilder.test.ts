import { describe, it, expect } from 'vitest'
import { buildSystemPrompt, measurePromptTokens } from './promptBuilder'
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

// ─── Block presence ──────────────────────────────────────────────────────────

describe('buildSystemPrompt — all 10 blocks present', () => {
  const prompt = buildSystemPrompt(config, makeMockState())

  const headings = [
    '## 1. Game Context',
    '## 2. Live Game State',
    '## 3. Team Identities',
    '## 4. National Actions',
    '## 5. EDIP Cards',
    '## 6. Key Mechanics',
    '## 7. Persona Definitions',
    '## 8. Routing Rules',
    '## 9. JSON Output Schema',
    '## 10. Absolute Rules',
  ]

  it.each(headings)('contains heading %s', (heading) => {
    expect(prompt).toContain(heading)
  })
})

// ─── Live state interpolation ────────────────────────────────────────────────

describe('buildSystemPrompt — live state interpolation', () => {
  it('interpolates round, crisisSeverity, edipLegitimacy into Block 2', () => {
    const state = makeMockState({
      round: 3,
      crisisSeverity: 2,
      edipLegitimacy: -1,
    })
    const prompt = buildSystemPrompt(config, state)

    // Isolate Block 2 so the assertions pin the correct section.
    const block2Start = prompt.indexOf('## 2. Live Game State')
    const block3Start = prompt.indexOf('## 3. Team Identities')
    expect(block2Start).toBeGreaterThanOrEqual(0)
    expect(block3Start).toBeGreaterThan(block2Start)
    const block2 = prompt.slice(block2Start, block3Start)

    expect(block2).toContain('round: 3')
    expect(block2).toContain('crisisSeverity: 2')
    expect(block2).toContain('edipLegitimacy: -1')
  })

  it('renders crisisState verbatim in Block 2', () => {
    const state = makeMockState({ crisisState: 'Security-Related Supply Crisis' })
    const prompt = buildSystemPrompt(config, state)
    expect(prompt).toContain('crisisState: Security-Related Supply Crisis')
  })

  it('includes the current round inject from the selected scenario', () => {
    const state = makeMockState({ round: 2 })
    const prompt = buildSystemPrompt(config, state)
    // round 2 → injects[1] of scenario 0
    const expected = config.scenarios[0].injects[1]
    expect(prompt).toContain(expected)
  })
})

// ─── Teams ───────────────────────────────────────────────────────────────────

describe('buildSystemPrompt — team rendering', () => {
  it('includes all 4 team IDs', () => {
    const prompt = buildSystemPrompt(config, makeMockState())
    for (const t of config.teams) {
      expect(prompt).toContain(`Team ${t.id}`)
    }
  })

  it('interpolates a mutated team resource value', () => {
    const state = makeMockState()
    // drop team A's pc to 0 — the prompt must surface the live number
    const aIndex = state.teams.findIndex((t) => t.id === 'A')
    state.teams[aIndex] = { ...state.teams[aIndex], pc: 0 }
    const prompt = buildSystemPrompt(config, state)

    // Isolate Team A section
    const teamAStart = prompt.indexOf('### Team A')
    const teamBStart = prompt.indexOf('### Team B')
    expect(teamAStart).toBeGreaterThanOrEqual(0)
    expect(teamBStart).toBeGreaterThan(teamAStart)
    const teamABlock = prompt.slice(teamAStart, teamBStart)

    expect(teamABlock).toContain('pc: 0')
  })
})

// ─── Cards + National Actions ────────────────────────────────────────────────

describe('buildSystemPrompt — config enumeration', () => {
  const prompt = buildSystemPrompt(config, makeMockState())

  it('includes every EDIP card id', () => {
    for (const c of config.cards) {
      expect(prompt).toContain(c.id)
    }
  })

  it('includes every national action id', () => {
    for (const a of config.nationalActions) {
      expect(prompt).toContain(a.id)
    }
  })
})

// ─── Personas ────────────────────────────────────────────────────────────────

describe('buildSystemPrompt — personas', () => {
  const prompt = buildSystemPrompt(config, makeMockState())

  it('renders a heading for each of the three personas', () => {
    expect(prompt).toContain('### Kent')
    expect(prompt).toContain('### Finch')
    expect(prompt).toContain('### Chen')
  })

  it('has at least 3 MUST NOT sections (one per persona)', () => {
    const occurrences = prompt.split('MUST NOT').length - 1
    expect(occurrences).toBeGreaterThanOrEqual(3)
  })
})

// ─── Routing + JSON rule ─────────────────────────────────────────────────────

describe('buildSystemPrompt — routing and JSON rule', () => {
  const prompt = buildSystemPrompt(config, makeMockState())
  const lower = prompt.toLowerCase()

  it('encodes round start routing', () => {
    expect(lower).toContain('round start')
  })

  it('encodes card play routing', () => {
    expect(lower).toContain('card play')
  })

  it('encodes debrief routing', () => {
    expect(lower).toContain('debrief')
  })

  it('states the JSON-only rule', () => {
    expect(prompt).toContain('JSON ONLY')
  })
})

// ─── Determinism ─────────────────────────────────────────────────────────────

describe('buildSystemPrompt — determinism', () => {
  it('returns the same string for the same inputs', () => {
    const state = makeMockState({ round: 2, crisisSeverity: 1 })
    const a = buildSystemPrompt(config, state)
    const b = buildSystemPrompt(config, state)
    expect(a).toBe(b)
  })
})

// ─── Token measurement ──────────────────────────────────────────────────────

describe('measurePromptTokens', () => {
  it('returns 0 for an empty string', () => {
    expect(measurePromptTokens('')).toBe(0)
  })

  it('returns 1 for a 4-char string', () => {
    expect(measurePromptTokens('abcd')).toBe(1)
  })

  it('rounds up for non-multiple-of-4 lengths', () => {
    expect(measurePromptTokens('abcde')).toBe(2)
  })

  it('logs the empirical token count for the full EDIP prompt', () => {
    const prompt = buildSystemPrompt(config, makeMockState())
    const tokens = measurePromptTokens(prompt)
    // Not asserted against a threshold — Plan 06-08 formalises that.
    // eslint-disable-next-line no-console
    console.info(
      `[06-04] measurePromptTokens(buildSystemPrompt(EDIP_CONFIG, mockState)) = ${tokens} tokens (prompt length ${prompt.length} chars)`,
    )
    expect(tokens).toBeGreaterThan(0)
  })
})
