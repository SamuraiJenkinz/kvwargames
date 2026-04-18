import { beforeEach, describe, it, expect, vi, type Mock } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useGameStore } from '@/lib/gameStore'
import type { GameConfig, GameState, ChatMessage } from '@/types/game'
import { EDIP_CONFIG } from '@/data/edipConfig'
import ActionToolbar from './ActionToolbar'

// ─── Phase 6: LLM pipeline mocks ──────────────────────────────────────────────
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

// ─── Phase 14-03: mock podcast store ─────────────────────────────────────────
// We can't reference module-level variables in vi.mock() factories (they are hoisted).
// Instead, use vi.hoisted() to declare the mock fn so it's available in the factory.
const { mockStartGeneration } = vi.hoisted(() => ({
  mockStartGeneration: vi.fn(() => Promise.resolve()),
}))

// Podcast store state — mutable so tests can change it
const podcastStoreState = {
  status: 'idle' as string,
  blobUrl: null as string | null,
  generatedAt: null as number | null,
}

vi.mock('@/lib/podcastStore', () => ({
  usePodcastStore: (selector: (s: typeof podcastStoreState & { startGeneration: () => Promise<void> }) => unknown) =>
    selector({ ...podcastStoreState, startGeneration: mockStartGeneration }),
}))

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

// Debrief messages totaling >2000 words for word-count dialog tests
const LONG_DEBRIEF_MESSAGES: ChatMessage[] = [
  {
    id: 'kent-debrief',
    type: 'persona',
    speaker: 'kent',
    isDebrief: true,
    timestamp: '2026-01-01T00:01:00Z',
    text: Array(800).fill('word').join(' '),
  },
  {
    id: 'finch-debrief',
    type: 'persona',
    speaker: 'finch',
    isDebrief: true,
    timestamp: '2026-01-01T00:02:00Z',
    text: Array(800).fill('word').join(' '),
  },
  {
    id: 'chen-debrief',
    type: 'persona',
    speaker: 'chen',
    isDebrief: true,
    timestamp: '2026-01-01T00:03:00Z',
    text: Array(800).fill('word').join(' '),
  },
]

// Short debrief messages totaling <2000 words
const SHORT_DEBRIEF_MESSAGES: ChatMessage[] = [
  {
    id: 'kent-debrief-short',
    type: 'persona',
    speaker: 'kent',
    isDebrief: true,
    timestamp: '2026-01-01T00:01:00Z',
    text: 'Short debrief text here.',
  },
]

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

function seedPodcastStore(overrides: Partial<typeof podcastStoreState> = {}) {
  podcastStoreState.status = overrides.status ?? 'idle'
  podcastStoreState.blobUrl = overrides.blobUrl ?? null
  podcastStoreState.generatedAt = overrides.generatedAt ?? null
}

function noop() {}

beforeEach(() => {
  seedStore()
  seedPodcastStore()
  mockStartGeneration.mockClear()
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

    expect(generateDebriefMarkdown).toHaveBeenCalledTimes(1)
    const snapshotArg = (generateDebriefMarkdown as Mock).mock.calls[0][0]
    expect(snapshotArg.gameConfig).toBe(EDIP_CONFIG)
    expect(snapshotArg.gameState).toEqual(SEED_GAME_STATE)
    expect(snapshotArg.messages).toEqual([DEBRIEF_DIVIDER_MSG])
    expect(snapshotArg.stateSnapshots).toBeDefined()
    expect(snapshotArg.exportedAt).toBeInstanceOf(Date)

    expect(buildDebriefFilename).toHaveBeenCalledTimes(1)
    const filenameArgs = (buildDebriefFilename as Mock).mock.calls[0]
    expect(filenameArgs[0]).toBe((EDIP_CONFIG as GameConfig).name)
    expect(filenameArgs[1]).toBeInstanceOf(Date)

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

    expect(useGameStore.getState().gameEnded).toBe(true)
    const msgs = useGameStore.getState().messages
    const divider = msgs.find((m) => m.type === 'debrief_divider')
    expect(divider).toBeDefined()
    expect(divider?.label).toBe('DEBRIEF')
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
    expect(useGameStore.getState().gameEnded).toBe(false)
  })

  // ─── Test F: When gameEnded=true, all four gated buttons are disabled ─────────

  it('Test F: When gameEnded=true, Request Debrief Now and End Game + Debrief buttons are disabled', () => {
    seedStore({ gameEnded: true })
    render(<ActionToolbar disabled={false} onInsert={noop} />)

    expect(screen.getByRole('button', { name: /request debrief now/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /end game \+ debrief/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /advance to round/i })).toBeDisabled()
  })

  // ─── Additional: Advance to Round uses gameEnded gate ────────────────────────

  it('Advance to Round button is disabled when gameEnded=true', () => {
    seedStore({ gameEnded: true })
    render(<ActionToolbar disabled={false} onInsert={noop} />)
    expect(screen.getByRole('button', { name: /advance to round/i })).toBeDisabled()
  })

  // ─── Podcast: Test 1 — Generate Podcast button hidden until hasDebrief ───────

  it('Podcast 1: Generate Podcast button is hidden when no debrief_divider exists', () => {
    seedStore({ messages: [] })
    seedPodcastStore({ status: 'idle' })
    render(<ActionToolbar disabled={false} onInsert={noop} />)
    expect(screen.queryByRole('button', { name: /generate podcast/i })).toBeNull()
  })

  // ─── Podcast: Test 2 — Generate Podcast button appears with debrief ──────────

  it('Podcast 2: Generate Podcast button appears when hasDebrief === true and podcastStatus === idle', () => {
    seedStore({ messages: [DEBRIEF_DIVIDER_MSG] })
    seedPodcastStore({ status: 'idle' })
    render(<ActionToolbar disabled={false} onInsert={noop} />)
    expect(screen.getByRole('button', { name: /generate podcast/i })).toBeInTheDocument()
  })

  // ─── Podcast: Test 3 — Short debrief calls startGeneration directly ──────────

  it('Podcast 3: Generate Podcast click with short debrief calls startGeneration with forceFresh: false', async () => {
    const user = userEvent.setup()
    seedStore({ messages: [DEBRIEF_DIVIDER_MSG, ...SHORT_DEBRIEF_MESSAGES] })
    seedPodcastStore({ status: 'idle' })
    render(<ActionToolbar disabled={false} onInsert={noop} />)

    await user.click(screen.getByRole('button', { name: /generate podcast/i }))

    expect(mockStartGeneration).toHaveBeenCalledTimes(1)
    const callArg = mockStartGeneration.mock.calls[0][0] as { forceFresh: boolean }
    expect(callArg.forceFresh).toBe(false)
  })

  // ─── Podcast: Test 4 — Long debrief opens WordCountConfirmDialog ─────────────

  it('Podcast 4: Generate Podcast click with long debrief opens WordCountConfirmDialog, does NOT call startGeneration', async () => {
    const user = userEvent.setup()
    seedStore({ messages: [DEBRIEF_DIVIDER_MSG, ...LONG_DEBRIEF_MESSAGES] })
    seedPodcastStore({ status: 'idle' })
    render(<ActionToolbar disabled={false} onInsert={noop} />)

    await user.click(screen.getByRole('button', { name: /generate podcast/i }))

    // Dialog opens — h2 heading is present
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    // The dialog heading text is "Generate Podcast" (in an h2, distinct from the button)
    expect(dialog.querySelector('h2')?.textContent).toBe('Generate Podcast')
    expect(mockStartGeneration).not.toHaveBeenCalled()
  })

  // ─── Podcast: Test 5 — WordCountConfirmDialog primary calls startGeneration ──

  it('Podcast 5: WordCountConfirmDialog Generate button calls startGeneration and closes the dialog', async () => {
    const user = userEvent.setup()
    seedStore({ messages: [DEBRIEF_DIVIDER_MSG, ...LONG_DEBRIEF_MESSAGES] })
    seedPodcastStore({ status: 'idle' })
    render(<ActionToolbar disabled={false} onInsert={noop} />)

    // Open dialog
    await user.click(screen.getByRole('button', { name: /generate podcast/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    // Click Generate inside dialog
    await user.click(screen.getByRole('button', { name: /^generate$/i }))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(mockStartGeneration).toHaveBeenCalledTimes(1)
  })

  // ─── Podcast: Test 6 — WordCountConfirmDialog Cancel closes without generation

  it('Podcast 6: WordCountConfirmDialog Cancel closes dialog without calling startGeneration', async () => {
    const user = userEvent.setup()
    seedStore({ messages: [DEBRIEF_DIVIDER_MSG, ...LONG_DEBRIEF_MESSAGES] })
    seedPodcastStore({ status: 'idle' })
    render(<ActionToolbar disabled={false} onInsert={noop} />)

    // Open dialog
    await user.click(screen.getByRole('button', { name: /generate podcast/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    // Click Cancel
    await user.click(screen.getByRole('button', { name: /^cancel$/i }))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(mockStartGeneration).not.toHaveBeenCalled()
  })

  // ─── Podcast: Test 7 — Download MP3 replaces Generate Podcast when done ──────

  it('Podcast 7: Download MP3 replaces Generate Podcast when podcastStatus === done', async () => {
    const user = userEvent.setup()
    const appendSpy = vi.spyOn(document.body, 'appendChild')
    seedStore({ messages: [DEBRIEF_DIVIDER_MSG] })
    seedPodcastStore({ status: 'done', blobUrl: 'blob:mock-1', generatedAt: Date.now() })
    render(<ActionToolbar disabled={false} onInsert={noop} />)

    expect(screen.queryByRole('button', { name: /generate podcast/i })).toBeNull()
    const downloadBtn = screen.getByRole('button', { name: /download mp3/i })
    expect(downloadBtn).toBeInTheDocument()

    await user.click(downloadBtn)

    const appendCalls = appendSpy.mock.calls
    const anchor = appendCalls.find(([el]) => (el as HTMLElement).tagName === 'A')?.[0] as HTMLAnchorElement | undefined
    expect(anchor).toBeDefined()
    expect(anchor?.download).toMatch(/\.mp3$/)
    expect(anchor?.href).toContain('blob:mock-1')

    appendSpy.mockRestore()
  })

  // ─── Podcast: Test 8 — Re-generate opens RegenerateConfirmDialog ─────────────

  it('Podcast 8: Re-generate button opens RegenerateConfirmDialog; confirm calls startGeneration with forceFresh: true', async () => {
    const user = userEvent.setup()
    seedStore({ messages: [DEBRIEF_DIVIDER_MSG, ...SHORT_DEBRIEF_MESSAGES] })
    seedPodcastStore({ status: 'done', blobUrl: 'blob:mock-1', generatedAt: Date.now() })
    render(<ActionToolbar disabled={false} onInsert={noop} />)

    // Click the toolbar Re-generate button (first match)
    const regenButtons = screen.getAllByRole('button', { name: /re-generate/i })
    await user.click(regenButtons[0])

    // Dialog should open
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(dialog.querySelector('h2')?.textContent).toBe('Re-generate Podcast')

    // Confirm — click the primary button inside the dialog
    const dialogPrimaryBtn = dialog.querySelector('button[class*="amber"]') as HTMLButtonElement
    expect(dialogPrimaryBtn).toBeDefined()
    await user.click(dialogPrimaryBtn)

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(mockStartGeneration).toHaveBeenCalledTimes(1)
    const callArg = mockStartGeneration.mock.calls[0][0] as { forceFresh: boolean }
    expect(callArg.forceFresh).toBe(true)
  })
})
