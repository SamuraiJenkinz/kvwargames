import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import LoadConfigPanel from './LoadConfigPanel'
import { AppRoutes } from '@/App'
import { useGameStore } from '@/lib/gameStore'

vi.mock('zustand')

// ─── LoadConfigPanel — disabled Launch buttons on invalid JSON ────────────────

describe('LoadConfigPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('disables Launch buttons when JSON is invalid', async () => {
    // Seed the store with valid JSON first so lastValidScenarioCount is set,
    // then corrupt it so the debounced parse will produce an error.
    const validJson = JSON.stringify(
      {
        scenarios: [{ id: 's1', name: 'Scenario 1', startState: { crisisSeverity: 1, crisisState: 'early', edipLegitimacy: 0 } }],
        teams: [{ id: 't1', name: 'Team 1', pc: 3, po: 0, readiness: 3, stock: 50, crm: 50, ic: 50 }],
      },
      null,
      2,
    )

    // Start with valid JSON so a scenario count is established on mount
    useGameStore.setState({ configJson: validJson })

    render(
      <MemoryRouter>
        <LoadConfigPanel />
      </MemoryRouter>,
    )

    // Confirm buttons are initially enabled (valid JSON on mount)
    const initialButtons = screen.getAllByRole('button', { name: /Launch Scenario/i })
    expect(initialButtons.length).toBeGreaterThan(0)
    initialButtons.forEach((b) => expect(b).not.toBeDisabled())

    // Now corrupt the JSON in the store (simulates user typing)
    act(() => {
      useGameStore.setState({ configJson: '{ broken json' })
    })

    // Advance fake timers past the 300ms debounce
    await act(async () => {
      vi.advanceTimersByTime(350)
    })

    // Alert should be visible
    expect(screen.getByRole('alert')).toBeInTheDocument()

    // Launch buttons should still be rendered but disabled
    const buttons = screen.getAllByRole('button', { name: /Launch Scenario/i })
    expect(buttons.length).toBeGreaterThan(0)
    buttons.forEach((b) => {
      expect(b).toBeDisabled()
      expect(b).toHaveAttribute('aria-disabled', 'true')
      expect(b).toHaveAttribute('title', 'Fix JSON errors to launch')
    })
  })
})

// ─── AppRoutes guard — /game redirects to /setup when gameState is null ───────

describe('AppRoutes', () => {
  it('redirects /game to /setup when gameState is null', () => {
    useGameStore.setState({ gameState: null, setupMode: 'home' })

    render(
      <MemoryRouter initialEntries={['/game']}>
        <AppRoutes />
      </MemoryRouter>,
    )

    // After redirect, SetupScreen > HomeScreen should be rendered
    expect(
      screen.getByText(/EDIP Wargame Facilitator/i),
    ).toBeInTheDocument()
  })
})
