import { beforeEach, describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useGameStore } from '@/lib/gameStore'
import type { GameConfig, GameState } from '@/types/game'
import { EDIP_CONFIG } from '@/data/edipConfig'
import FacilitatorInput from './FacilitatorInput'

vi.mock('zustand')

// Seed gameState with round=2 (Advance button label should say "Advance to Round 3")
const SEED_GAME_STATE: GameState = {
  round: 2,
  scenarioIndex: 0,
  crisisSeverity: 0,
  crisisState: 'No Crisis',
  edipLegitimacy: 0,
  teams: [],
  cardsThisRound: [],
}

function seedStore() {
  useGameStore.setState({
    gameConfig: EDIP_CONFIG as GameConfig,
    gameState: SEED_GAME_STATE,
    loading: false,
    messages: [],
  })
}

beforeEach(() => {
  seedStore()
})

describe('FacilitatorInput', () => {
  // ─── Layout ─────────────────────────────────────────────────────────────────

  it('renders the facilitator-input container', () => {
    render(<FacilitatorInput />)
    expect(screen.getByTestId('facilitator-input')).toBeInTheDocument()
  })

  it('renders textarea and Send button', () => {
    render(<FacilitatorInput />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument()
  })

  // ─── Dynamic Advance button label ────────────────────────────────────────────

  it('shows dynamic label "Advance to Round 3" when round is 2', () => {
    render(<FacilitatorInput />)
    expect(screen.getByRole('button', { name: /advance to round 3/i })).toBeInTheDocument()
  })

  it('shows "Trigger Debrief" button', () => {
    render(<FacilitatorInput />)
    expect(screen.getByRole('button', { name: /trigger debrief/i })).toBeInTheDocument()
  })

  // ─── advanceRound action ─────────────────────────────────────────────────────

  it('clicking Advance button increments round, adds 2 messages, and updates button label', async () => {
    const user = userEvent.setup()
    render(<FacilitatorInput />)

    const advanceBtn = screen.getByRole('button', { name: /advance to round 3/i })
    await user.click(advanceBtn)

    // Round incremented
    expect(useGameStore.getState().gameState?.round).toBe(3)
    // Two messages added: round_divider + stub kent
    expect(useGameStore.getState().messages).toHaveLength(2)
    // Button label updated to Round 4
    expect(screen.getByRole('button', { name: /advance to round 4/i })).toBeInTheDocument()
  })

  // ─── triggerDebrief action ───────────────────────────────────────────────────

  it('clicking Trigger Debrief adds 2 messages: debrief_divider + facilitator stub', async () => {
    const user = userEvent.setup()
    render(<FacilitatorInput />)

    await user.click(screen.getByRole('button', { name: /trigger debrief/i }))

    const messages = useGameStore.getState().messages
    expect(messages).toHaveLength(2)
    const divider = messages.find((m) => m.type === 'debrief_divider')
    expect(divider).toBeDefined()
    expect(divider?.label).toBe('DEBRIEF')
  })

  // ─── Enter submits ───────────────────────────────────────────────────────────

  it('typing text and pressing Enter submits message, clears textarea, sets loading=true', async () => {
    const user = userEvent.setup()
    render(<FacilitatorInput />)

    const textarea = screen.getByRole('textbox')
    await user.click(textarea)
    await user.type(textarea, 'hello')
    await user.keyboard('{Enter}')

    const messages = useGameStore.getState().messages
    expect(messages).toHaveLength(1)
    expect(messages[0].type).toBe('facilitator')
    expect(messages[0].text).toBe('hello')
    expect((textarea as HTMLTextAreaElement).value).toBe('')
    expect(useGameStore.getState().loading).toBe(true)
  })

  // ─── Shift+Enter inserts newline ──────────────────────────────────────────────

  it('Shift+Enter inserts a newline without submitting', async () => {
    const user = userEvent.setup()
    render(<FacilitatorInput />)

    const textarea = screen.getByRole('textbox')
    await user.click(textarea)
    await user.type(textarea, 'hello')
    await user.keyboard('{Shift>}{Enter}{/Shift}')

    // Value should contain a newline — NOT submitted
    expect((textarea as HTMLTextAreaElement).value).toBe('hello\n')
    expect(useGameStore.getState().messages).toHaveLength(0)
  })

  // ─── Empty input no-ops ──────────────────────────────────────────────────────

  it('Send button is disabled when textarea is empty', () => {
    render(<FacilitatorInput />)
    const sendBtn = screen.getByRole('button', { name: /send/i })
    expect(sendBtn).toBeDisabled()
  })

  it('Send button is disabled when textarea is whitespace only', async () => {
    const user = userEvent.setup()
    render(<FacilitatorInput />)

    const textarea = screen.getByRole('textbox')
    await user.type(textarea, '   ')

    const sendBtn = screen.getByRole('button', { name: /send/i })
    expect(sendBtn).toBeDisabled()
  })

  it('pressing Enter on empty textarea is a no-op (no messages added)', async () => {
    const user = userEvent.setup()
    render(<FacilitatorInput />)

    const textarea = screen.getByRole('textbox')
    await user.click(textarea)
    await user.keyboard('{Enter}')

    expect(useGameStore.getState().messages).toHaveLength(0)
  })

  // ─── Loading disables all controls ───────────────────────────────────────────

  it('when loading=true, textarea is disabled', () => {
    act(() => {
      useGameStore.setState({ loading: true })
    })
    render(<FacilitatorInput />)
    expect(screen.getByRole('textbox')).toBeDisabled()
  })

  it('when loading=true, Advance and Trigger Debrief buttons are disabled', () => {
    act(() => {
      useGameStore.setState({ loading: true })
    })
    render(<FacilitatorInput />)
    expect(screen.getByRole('button', { name: /advance to round/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /trigger debrief/i })).toBeDisabled()
  })

  it('when loading=true, Send button is disabled', () => {
    act(() => {
      useGameStore.setState({ loading: true })
    })
    render(<FacilitatorInput />)
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled()
  })

  // ─── Quick-insert select ─────────────────────────────────────────────────────

  it('selecting a card option from the cards select inserts text into textarea', async () => {
    const user = userEvent.setup()
    render(<FacilitatorInput />)

    const cardSelects = screen.getAllByRole('combobox')
    const cardsSelect = cardSelects[0] // first select is cards

    // Get first card option value (after the placeholder)
    const firstCardOption = (cardsSelect as HTMLSelectElement).options[1]
    const expectedText = firstCardOption.value

    await user.selectOptions(cardsSelect, expectedText)

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(textarea.value).toContain(expectedText)
  })
})
