import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useGameStore } from '@/lib/gameStore'
import type { GameState, GameConfig } from '@/types/game'
import GameScreen from './GameScreen'

vi.mock('zustand')

// ─── Minimal mock data ────────────────────────────────────────────────────────

const mockGameState: GameState = {
  round: 2,
  scenarioIndex: 0,
  crisisSeverity: 3,
  crisisState: 'Supply Crisis',
  edipLegitimacy: 1,
  cardsThisRound: [],
  teams: [
    { id: 'A', name: 'Team A', pc: 1, po: 0, readiness: 3, stock: 2, crm: 2, ic: 2 },
    { id: 'B', name: 'Team B', pc: 0, po: 1, readiness: 3, stock: 3, crm: 2, ic: 5 },
    { id: 'C', name: 'Team C', pc: 3, po: 0, readiness: 3, stock: 3, crm: 3, ic: 3 },
    { id: 'D', name: 'Team D', pc: 4, po: 1, readiness: 3, stock: 3, crm: 3, ic: 3 },
  ],
}

const mockGameConfig: Partial<GameConfig> = {
  name: 'Test Game',
  scenarios: [
    {
      id: 's1',
      name: 'Test Scenario One',
      description: '',
      rounds: 3,
      startState: { crisisSeverity: 0, crisisState: 'No Crisis', edipLegitimacy: 0 },
      injects: [],
    },
  ],
  teams: [],
  nationalActions: [],
  cards: [],
}

// ─── GameScreen tests ─────────────────────────────────────────────────────────

describe('GameScreen', () => {
  it('renders all four child panel testids', () => {
    useGameStore.setState({
      gameState: mockGameState,
      gameConfig: mockGameConfig as GameConfig,
    })

    render(<GameScreen />)

    expect(screen.getByTestId('state-panel')).toBeInTheDocument()
    expect(screen.getByTestId('chat-feed')).toBeInTheDocument()
    expect(screen.getByTestId('reference-panel')).toBeInTheDocument()
    expect(screen.getByTestId('facilitator-input')).toBeInTheDocument()
  })

  it('GameHeader shows Round 2', () => {
    useGameStore.setState({
      gameState: mockGameState,
      gameConfig: mockGameConfig as GameConfig,
    })

    render(<GameScreen />)

    expect(screen.getByText('Round 2')).toBeInTheDocument()
  })

  it('GameHeader shows Supply Crisis badge', () => {
    useGameStore.setState({
      gameState: mockGameState,
      gameConfig: mockGameConfig as GameConfig,
    })

    render(<GameScreen />)

    expect(screen.getByText('Supply Crisis')).toBeInTheDocument()
  })

  it('clicking New Game calls resetGame and sets gameState to null', () => {
    useGameStore.setState({
      gameState: mockGameState,
      gameConfig: mockGameConfig as GameConfig,
    })

    render(<GameScreen />)

    // gameState should be non-null before click
    expect(useGameStore.getState().gameState).not.toBeNull()

    const newGameBtn = screen.getByRole('button', { name: /new game/i })
    fireEvent.click(newGameBtn)

    // resetGame clears gameState
    expect(useGameStore.getState().gameState).toBeNull()
  })

  it('GameHeader shows the game config name', () => {
    useGameStore.setState({
      gameState: mockGameState,
      gameConfig: mockGameConfig as GameConfig,
    })

    render(<GameScreen />)

    expect(screen.getByText('Test Game')).toBeInTheDocument()
  })

  it('GameHeader shows the scenario name', () => {
    useGameStore.setState({
      gameState: mockGameState,
      gameConfig: mockGameConfig as GameConfig,
    })

    render(<GameScreen />)

    expect(screen.getByText('Test Scenario One')).toBeInTheDocument()
  })

  it('GameHeader renders wordmark KV WAR GAME', () => {
    useGameStore.setState({
      gameState: mockGameState,
      gameConfig: mockGameConfig as GameConfig,
    })

    render(<GameScreen />)

    expect(screen.getByText('KV WAR GAME')).toBeInTheDocument()
  })

  it('GameHeader uses crisis-none badge when crisisState is No Crisis', () => {
    useGameStore.setState({
      gameState: { ...mockGameState, crisisState: 'No Crisis' },
      gameConfig: mockGameConfig as GameConfig,
    })

    render(<GameScreen />)

    expect(screen.getByText('No Crisis')).toBeInTheDocument()
  })
})
