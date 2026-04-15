import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  toKebabFilename,
  buildDebriefFilename,
  generateDebriefMarkdown,
  downloadDebrief,
  type DebriefSnapshot,
} from './debriefExporter'
import { EDIP_CONFIG } from '@/data/edipConfig'
import type { GameConfig, GameState, ChatMessage } from '@/types/game'

// ─── Fixtures ──────────────────────────────────────────────────────────────────

const config = EDIP_CONFIG as unknown as GameConfig

/** Minimal GameState for round 1 (scenario 0 start) */
const baseState: GameState = {
  round: 1,
  scenarioIndex: 0,
  crisisSeverity: 0,
  crisisState: 'No Crisis',
  edipLegitimacy: 0,
  teams: [
    { id: 'A', name: 'Team A', pc: 3, po: 0, readiness: 3, stock: 2, crm: 2, ic: 2 },
    { id: 'B', name: 'Team B', pc: 3, po: 1, readiness: 2, stock: 3, crm: 3, ic: 3 },
    { id: 'C', name: 'Team C', pc: 2, po: 0, readiness: 2, stock: 2, crm: 1, ic: 2 },
    { id: 'D', name: 'Team D', pc: 3, po: 0, readiness: 2, stock: 2, crm: 2, ic: 2 },
  ],
  cardsThisRound: [],
}

/** State at start of Round 2 — reflects post-mutation state after advanceRound */
const round2State: GameState = {
  ...baseState,
  round: 2,
  crisisSeverity: 1,
}

const stateSnapshots: Record<number, GameState> = {
  1: baseState,   // start of Round 1 (seeded by initGame)
  2: round2State, // start of Round 2 (captured on advanceRound)
}

const baseMessages: ChatMessage[] = [
  { id: '1', type: 'facilitator', text: 'Begin.', timestamp: '10:00' },
  { id: '2', type: 'persona', speaker: 'kent', text: 'Welcome.', timestamp: '10:00' },
  { id: '3', type: 'round_divider', label: 'Round 2', timestamp: '10:15' },
  { id: '4', type: 'persona', speaker: 'finch', text: 'Round 2 inject.', timestamp: '10:15' },
  { id: '5', type: 'debrief_divider', label: 'DEBRIEF', isDebrief: true, timestamp: '10:30' },
  { id: '6', type: 'persona', speaker: 'chen', text: 'Final reflection.', timestamp: '10:30' },
]

const baseSnapshot: DebriefSnapshot = {
  gameConfig: config,
  gameState: round2State,
  stateSnapshots,
  messages: baseMessages,
  exportedAt: new Date('2026-04-14T15:30:00Z'),
}

// ─── Group 1: toKebabFilename ──────────────────────────────────────────────────

describe('toKebabFilename', () => {
  it("converts 'EDIP Security of Supply' to 'edip-security-of-supply'", () => {
    expect(toKebabFilename('EDIP Security of Supply')).toBe('edip-security-of-supply')
  })

  it("converts 'EDIP  War / Game!!' to 'edip-war-game' (collapses spaces, strips /!)", () => {
    expect(toKebabFilename('EDIP  War / Game!!')).toBe('edip-war-game')
  })

  it("trims leading and trailing underscores/hyphens ('___leading_and_trailing___' -> 'leading-and-trailing')", () => {
    expect(toKebabFilename('___leading_and_trailing___')).toBe('leading-and-trailing')
  })

  it("falls back to 'game' when input is all non-word chars ('!!!')", () => {
    expect(toKebabFilename('!!!')).toBe('game')
  })

  it("falls back to 'game' for empty string", () => {
    expect(toKebabFilename('')).toBe('game')
  })
})

// ─── Group 2: buildDebriefFilename ─────────────────────────────────────────────

describe('buildDebriefFilename', () => {
  it("produces 'debrief-edip-2026-04-14-1530.md' for EDIP at 2026-04-14T15:30:00Z", () => {
    expect(buildDebriefFilename('EDIP', new Date('2026-04-14T15:30:00Z'))).toBe(
      'debrief-edip-2026-04-14-1530.md',
    )
  })

  it('handles single-digit minutes correctly (05:07 -> 0507)', () => {
    const result = buildDebriefFilename('EDIP', new Date('2026-04-14T05:07:00Z'))
    expect(result).toBe('debrief-edip-2026-04-14-0507.md')
  })

  it('uses kebab conversion for game name', () => {
    const result = buildDebriefFilename('EDIP Security of Supply Wargame', new Date('2026-04-14T15:30:00Z'))
    expect(result).toBe('debrief-edip-security-of-supply-wargame-2026-04-14-1530.md')
  })
})

// ─── Group 3: generateDebriefMarkdown (pure) ──────────────────────────────────

describe('generateDebriefMarkdown', () => {
  let markdown: string

  beforeEach(() => {
    markdown = generateDebriefMarkdown(baseSnapshot)
  })

  it('contains H1 title with the game name and Debrief Report suffix', () => {
    expect(markdown).toContain('# EDIP Security of Supply Wargame — Debrief Report')
  })

  it('contains ## Round 1 AND ## Round 2 headers', () => {
    expect(markdown).toContain('## Round 1')
    expect(markdown).toContain('## Round 2')
  })

  it('contains ### State at start of Round 1 AND ### State at start of Round 2 headers', () => {
    expect(markdown).toContain('### State at start of Round 1')
    expect(markdown).toContain('### State at start of Round 2')
  })

  it('snapshot keying: Round 2 state section reflects round2State values (Severity 1, not 0)', () => {
    // Find the Round 2 state section
    const round2Start = markdown.indexOf('### State at start of Round 2')
    const round2End = markdown.indexOf('### Transcript', round2Start)
    const round2StateSection = markdown.slice(round2Start, round2End)
    // round2State has crisisSeverity: 1, baseState has 0
    // This LOCKS IN the "stateSnapshots[N] = start of Round N" convention
    expect(round2StateSection).toContain('Severity 1')
    expect(round2StateSection).not.toContain('Severity 0')
  })

  it('contains at least 2 ### Transcript headers', () => {
    const matches = markdown.match(/### Transcript/g)
    expect(matches).not.toBeNull()
    expect(matches!.length).toBeGreaterThanOrEqual(2)
  })

  it('contains GFM pipe table header | Team | PC | PO | RDY | STK | CRM | IC |', () => {
    expect(markdown).toContain('| Team | PC | PO | RDY | STK | CRM | IC |')
  })

  it("Kent's message renders using PERSONA_META displayName", () => {
    // PERSONA_META displayName for 'kent' is 'Kent'
    expect(markdown).toContain('**Kent (—):** Welcome.')
  })

  it('contains ## Debrief section', () => {
    expect(markdown).toContain('## Debrief')
  })

  it("Debrief section contains Chen's final reflection", () => {
    const debriefStart = markdown.indexOf('## Debrief')
    const finalStateStart = markdown.indexOf('## Final State')
    const debriefSection = markdown.slice(debriefStart, finalStateStart)
    expect(debriefSection).toContain('Final reflection.')
  })

  it("Debrief section does NOT contain Round 2 play message ('Round 2 inject.')", () => {
    const debriefStart = markdown.indexOf('## Debrief')
    const finalStateStart = markdown.indexOf('## Final State')
    const debriefSection = markdown.slice(debriefStart, finalStateStart)
    // 'Round 2 inject.' belongs to round 2's transcript, not debrief
    expect(debriefSection).not.toContain('Round 2 inject.')
  })

  it('contains ## Final State section', () => {
    expect(markdown).toContain('## Final State')
  })

  it('contains ## Appendix: Raw Config section', () => {
    expect(markdown).toContain('## Appendix: Raw Config')
  })

  it('appendix contains the game config name', () => {
    expect(markdown).toContain('Config: EDIP Security of Supply Wargame')
  })

  it('regression: post-debrief persona message does NOT appear in any Round transcript section', () => {
    // STATE.md Phase 8 follow-up (line 217): debrief duplication bug — Chen's
    // 'Final reflection.' was previously rendered in BOTH the Round 2
    // transcript bucket AND the ## Debrief section. After the bucketing fix
    // (lastDebriefIdx halt), 'Final reflection.' must appear ONLY in ## Debrief.
    const md = generateDebriefMarkdown(baseSnapshot)

    // Slice the markdown into round-section vs debrief-section halves so we
    // can assert the message's location precisely.
    const debriefHeaderIdx = md.indexOf('## Debrief')
    expect(debriefHeaderIdx).toBeGreaterThan(-1)
    const beforeDebrief = md.slice(0, debriefHeaderIdx)
    const fromDebriefOn = md.slice(debriefHeaderIdx)

    // Round transcripts (everything before ## Debrief) must NOT contain Final reflection.
    expect(beforeDebrief).not.toContain('Final reflection.')
    // ## Debrief section MUST contain it (proves the message wasn't lost — only relocated).
    expect(fromDebriefOn).toContain('Final reflection.')
  })
})

// ─── Group 3b: ## Debrief anchor uses LAST divider ────────────────────────────

describe('generateDebriefMarkdown — ## Debrief anchor uses LAST debrief_divider', () => {
  it('two debrief_dividers: debrief section shows FINAL message only, not INTERIM or R2 play', () => {
    const twoDebriefMessages: ChatMessage[] = [
      { id: 'a1', type: 'debrief_divider', label: 'DEBRIEF', isDebrief: true, timestamp: '10:00' },
      { id: 'a2', type: 'persona', speaker: 'kent', text: 'INTERIM_DEBRIEF_MSG', timestamp: '10:01' },
      { id: 'a3', type: 'round_divider', label: 'Round 2', timestamp: '10:10' },
      { id: 'a4', type: 'persona', speaker: 'finch', text: 'R2_PLAY_MSG', timestamp: '10:15' },
      { id: 'a5', type: 'debrief_divider', label: 'DEBRIEF', isDebrief: true, timestamp: '10:30' },
      { id: 'a6', type: 'persona', speaker: 'chen', text: 'FINAL_DEBRIEF_MSG', timestamp: '10:31' },
    ]

    const snapshot: DebriefSnapshot = {
      ...baseSnapshot,
      messages: twoDebriefMessages,
    }

    const md = generateDebriefMarkdown(snapshot)
    const debriefStart = md.indexOf('## Debrief')
    const finalStateStart = md.indexOf('## Final State')
    const debriefSection = md.slice(debriefStart, finalStateStart)

    // FINAL message is in the debrief section
    expect(debriefSection).toContain('FINAL_DEBRIEF_MSG')
    // INTERIM message is NOT in the debrief section (it's before the last divider)
    expect(debriefSection).not.toContain('INTERIM_DEBRIEF_MSG')
    // Play content from Round 2 is NOT in the debrief section
    expect(debriefSection).not.toContain('R2_PLAY_MSG')

    // But INTERIM and R2_PLAY must still appear in their round sections
    expect(md).toContain('INTERIM_DEBRIEF_MSG')
    expect(md).toContain('R2_PLAY_MSG')
  })
})

// ─── Group 3c: No debrief triggered ───────────────────────────────────────────

describe('generateDebriefMarkdown — no debrief triggered', () => {
  it('emits ## Debrief section with no-debrief notice when no debrief_divider exists', () => {
    const noDebriefMessages: ChatMessage[] = [
      { id: 'n1', type: 'facilitator', text: 'Begin.', timestamp: '10:00' },
      { id: 'n2', type: 'persona', speaker: 'kent', text: 'Round 1 response.', timestamp: '10:01' },
    ]

    const snapshot: DebriefSnapshot = {
      ...baseSnapshot,
      messages: noDebriefMessages,
    }

    const md = generateDebriefMarkdown(snapshot)
    expect(md).toContain('## Debrief')
    expect(md).toContain('_(No debrief was triggered during this session.)_')
  })
})

// ─── Group 4: downloadDebrief (mocked browser) ────────────────────────────────

describe('downloadDebrief', () => {
  let createObjectURLMock: ReturnType<typeof vi.fn>
  let revokeObjectURLMock: ReturnType<typeof vi.fn>
  let createdAnchor: {
    href: string
    download: string
    click: ReturnType<typeof vi.fn>
    style: Record<string, string>
  }

  beforeEach(() => {
    vi.useFakeTimers()

    createObjectURLMock = vi.fn(() => 'blob:mock-url')
    revokeObjectURLMock = vi.fn()

    vi.stubGlobal('URL', {
      createObjectURL: createObjectURLMock,
      revokeObjectURL: revokeObjectURLMock,
    })

    // Create a spy anchor element
    createdAnchor = {
      href: '',
      download: '',
      click: vi.fn(),
      style: {},
    }

    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        return createdAnchor as unknown as HTMLElement
      }
      return document.createElement(tag)
    })

    vi.spyOn(document.body, 'appendChild').mockImplementation(() => createdAnchor as unknown as Node)
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => createdAnchor as unknown as Node)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('calls URL.createObjectURL once with a Blob', () => {
    downloadDebrief('# Test', 'test.md')
    expect(createObjectURLMock).toHaveBeenCalledTimes(1)
    const arg = createObjectURLMock.mock.calls[0][0]
    expect(arg).toBeInstanceOf(Blob)
  })

  it("Blob type includes 'text/markdown'", () => {
    downloadDebrief('# Test', 'test.md')
    const blob: Blob = createObjectURLMock.mock.calls[0][0]
    expect(blob.type).toContain('text/markdown')
  })

  it("created anchor's download attribute equals the passed filename", () => {
    downloadDebrief('# Test', 'my-debrief-2026-04-14-1530.md')
    expect(createdAnchor.download).toBe('my-debrief-2026-04-14-1530.md')
  })

  it("anchor's click() is called once", () => {
    downloadDebrief('# Test', 'test.md')
    expect(createdAnchor.click).toHaveBeenCalledTimes(1)
  })

  it('URL.revokeObjectURL is NOT called before timers flush (proves deferral)', () => {
    downloadDebrief('# Test', 'test.md')
    // Before runAllTimers: revoke has NOT been called yet
    expect(revokeObjectURLMock).not.toHaveBeenCalled()
  })

  it('URL.revokeObjectURL IS called after vi.runAllTimers() with the correct URL', () => {
    downloadDebrief('# Test', 'test.md')
    // Before timers: not called
    expect(revokeObjectURLMock).not.toHaveBeenCalled()
    // Flush macrotask queue
    vi.runAllTimers()
    // After timers: called exactly once with the URL returned by createObjectURL
    expect(revokeObjectURLMock).toHaveBeenCalledTimes(1)
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock-url')
  })
})

// ─── Group 5: DEBRIEF-01 regression ──────────────────────────────────────────

describe('generateDebriefMarkdown — DEBRIEF-01 regression', () => {
  it('DEBRIEF-01 regression: R1 facilitator message preserves leading character', () => {
    // Arrange a DebriefSnapshot where Round 1's first facilitator message text
    // starts with "Round 1 is now live..." — the exact string from the v1.0 live
    // run that was observed as "ound 1 is now live..." in the downloaded export.
    const messages: ChatMessage[] = [
      {
        id: 'f1',
        type: 'facilitator',
        text: 'Round 1 is now live. Kent, set the scene.',
        timestamp: '10:00',
      },
      {
        id: 'd1',
        type: 'debrief_divider',
        label: 'DEBRIEF',
        isDebrief: true,
        timestamp: '11:00',
      },
      {
        id: 'p1',
        type: 'persona',
        speaker: 'kent',
        text: 'Debrief response.',
        timestamp: '11:01',
      },
    ]
    const snapshot: DebriefSnapshot = {
      ...baseSnapshot,
      messages,
    }
    const md = generateDebriefMarkdown(snapshot)
    // Must NOT appear — this is the truncated bug string
    expect(md).not.toContain('**Facilitator:** ound 1 is now live')
    // Must appear — full text preserved, leading "R" intact
    expect(md).toContain('**Facilitator:** Round 1 is now live')
  })
})
