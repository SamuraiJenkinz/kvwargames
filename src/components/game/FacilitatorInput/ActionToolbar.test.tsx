import { beforeEach, describe, it, expect, vi, type Mock } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useGameStore } from '@/lib/gameStore'
import type { GameConfig, GameState, ChatMessage } from '@/types/game'
import { EDIP_CONFIG } from '@/data/edipConfig'
import ActionToolbar from './ActionToolbar'

// ─── Phase 6: LLM pipeline mocks ──────────────────────────────────────────────
// Never resolves so we can assert synchronous store effects without awaiting LLM.
vi.mock('@/lib/llmClient', () => ({
  LLM_FRONTEND_TIMEOUT_MS: 45000,
  callLLMProxy: vi.fn(() => new Promise(() => {})),
}))
vi.mock('@/lib/responseParser', () => ({
  parsePersonaResponse: vi.fn(() => ({ ok: true, value: { responses: [] } })),
}))
vi.mock('@/lib/promptBuilder', () => ({
  buildSystemPrompt: vi.fn(() => 'SYS'),
  measurePromptTokens: vi.fn(() => 100),
}))
vi.mock('@/lib/contextWindow', () => ({
  HISTORY_WINDOW_N: 2,
  windowHistory: vi.fn((h: unknown) => h),
}))

// ─── DEB-01..03: mock the debrief exporter ────────────────────────────────────
vi.mock('@/lib/debriefExporter', () => ({
  generateDebriefMarkdown: vi.fn(() => '# Mock Debrief\n'),
  downloadDebrief: vi.fn(),
  buildDebriefFilename: vi.fn(() => 'debrief-mock-2026-04-14-1200.md'),
}))

vi.mock('zustand')

// Import after mocks are declared so vi.mocked() sees the mock functions.
import { generateDebriefMarkdown, downloadDebrief, buildDebriefFilename } from '@/lib/debriefExporter'

const SEED_GAME_STATE: GameState = {
  round: 2,
  scenarioIndex: 0,
  crisisSeverity: 0,
  crisisState: 'No Crisis',
  edipLegitimacy: 0,
  teams: [],
  cardsThisRound: [],
}

const DEBRIEF_DIVIDER_MSG: ChatMessage = {
  id: 'div-1',
  type: 'debrief_divider',
  label: 'DEBRIEF',
  timestamp: '2026-01-01T00:00:00Z',
  isDebrief: true,
}

function seedStore(overrides: Partial<ReturnType<typeof useGameStore.getState>> = {}) {
  useGameStore.setState({
    gameConfig: EDIP_CONFIG as GameConfig,
    gameState: SEED_GAME_STATE,
    loading: false,
    gameEnded: false,
    messages: [],
    ...overrides,
  })
}

function noop() {}

beforeEach(() => {
  seedStore()
  vi.mocked(generateDebriefMarkdown).mockClear()
  vi.mocked(downloadDebrief).mockClear()
  vi.mocked(buildDebriefFilename).mockClear()
})

describe('ActionToolbar', () => {
  // ─── Test A: Download button hidden with no debrief_divider ─────────────────

  it('Test A: Download button is hidden when no debrief_divider exists', () => {
    seedStore({ messages: [] })
    render(<ActionToolbar disabled={false} onInsert={noop} />)
    expect(screen.queryByRole('button', { name: /download debrief/i })).toBeNull()
  })

  // ─── Test B: Download button appears after a debrief_divider is added ────────

  it('Test B: Download button appears after a debrief_divider is added to messages', () => {
    seedStore({ messages: [DEBRIEF_DIVIDER_MSG] })
    render(<ActionToolbar disabled={false} onInsert={noop} />)
    const btn = screen.getByRole('button', { name: /download debrief/i })
    expect(btn).toBeInTheDocument()
    expect(btn).not.toBeDisabled()
  })

  // ─── Test C: Clicking Download calls exporter functions with correct args ────

  it('Test C: Clicking Download calls downloadDebrief with generated markdown and formatted filename', async () => {
    const user = userEvent.setup()
    seedStore({ messages: [DEBRIEF_DIVIDER_MSG] })
    render(<ActionToolbar disabled={false} onInsert={noop} />)

    const btn = screen.getByRole('button', { name: /download debrief/i })
    await user.click(btn)

    // generateDebriefMarkdown called once with a snapshot whose fields match the store
    expect(generateDebriefMarkdown).toHaveBeenCalledTimes(1)
    const snapshotArg = (generateDebriefMarkdown as Mock).mock.calls[0][0]
    expect(snapshotArg.gameConfig).toBe(EDIP_CONFIG)
    expect(snapshotArg.gameState).toEqual(SEED_GAME_STATE)
    expect(snapshotArg.messages).toEqual([DEBRIEF_DIVIDER_MSG])
    expect(snapshotArg.stateSnapshots).toBeDefined()
    expect(snapshotArg.exportedAt).toBeInstanceOf(Date)

    // buildDebriefFilename called with config.name and a Date
    expect(buildDebriefFilename).toHaveBeenCalledTimes(1)
    const filenameArgs = (buildDebriefFilename as Mock).mock.calls[0]
    expect(filenameArgs[0]).toBe((EDIP_CONFIG as GameConfig).name)
    expect(filenameArgs[1]).toBeInstanceOf(Date)

    // downloadDebrief called with the generated markdown and filename
    expect(downloadDebrief).toHaveBeenCalledTimes(1)
    expect(downloadDebrief).toHaveBeenCalledWith(
      '# Mock Debrief\n',
      'debrief-mock-2026-04-14-1200.md',
    )
  })

  // ─── Test D: End Game + Debrief button calls endGame() not triggerDebrief() ──

  it('Test D: End Game + Debrief button calls endGame() — sets gameEnded=true and pushes debrief_divider', async () => {
    const user = userEvent.setup()
    seedStore()
    render(<ActionToolbar disabled={false} onInsert={noop} />)

    await user.click(screen.getByRole('button', { name: /end game \+ debrief/i }))

    // endGame() was called: gameEnded flipped to true
    expect(useGameStore.getState().gameEnded).toBe(true)
    // And a debrief_divider was pushed (inline in endGame, not from triggerDebrief)
    const msgs = useGameStore.getState().messages
    const divider = msgs.find((m) => m.type === 'debrief_divider')
    expect(divider).toBeDefined()
    expect(divider?.label).toBe('DEBRIEF')
    // gameEnded=true confirms it was endGame, not triggerDebrief (which leaves it false)
  })

  // ─── Test E: Request Debrief Now still calls triggerDebrief() ────────────────

  it('Test E: Request Debrief Now button calls triggerDebrief() — pushes debrief_divider, gameEnded stays false', async () => {
    const user = userEvent.setup()
    seedStore()
    render(<ActionToolbar disabled={false} onInsert={noop} />)

    await user.click(screen.getByRole('button', { name: /request debrief now/i }))

    const msgs = useGameStore.getState().messages
    const divider = msgs.find((m) => m.type === 'debrief_divider')
    expect(divider).toBeDefined()
    // gameEnded stays false — proves interim semantics preserved
    expect(useGameStore.getState().gameEnded).toBe(false)
  })

  // ─── Test F: When gameEnded=true, all four gated buttons are disabled ─────────

  it('Test F: When gameEnded=true, Request Debrief Now and End Game + Debrief buttons are disabled', () => {
    seedStore({ gameEnded: true })
    render(<ActionToolbar disabled={false} onInsert={noop} />)

    // First two gated primitives: these are disabled when gameEnded=true
    expect(screen.getByRole('button', { name: /request debrief now/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /end game \+ debrief/i })).toBeDisabled()
    // Advance to Round button is also gated (disabled via disabled={disabled || gameEnded})
    expect(screen.getByRole('button', { name: /advance to round/i })).toBeDisabled()
  })

  // ─── Additional: Advance to Round uses gameEnded gate ────────────────────────

  it('Advance to Round button is disabled when gameEnded=true', () => {
    seedStore({ gameEnded: true })
    render(<ActionToolbar disabled={false} onInsert={noop} />)
    expect(screen.getByRole('button', { name: /advance to round/i })).toBeDisabled()
  })
})
