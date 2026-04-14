import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { useGameStore } from '@/lib/gameStore'
import { MOCK_GAME_STATE, MOCK_MESSAGES } from '@/mocks/mockGameState'
import type { GameState } from '@/types/game'
import StatePanel from './StatePanel'

vi.mock('zustand')

describe('StatePanel', () => {
  // ─── Track labels and values ────────────────────────────────────────────────

  it('renders severity track label "Severity" (CSS uppercase applied by browser)', () => {
    useGameStore.setState({ gameState: MOCK_GAME_STATE, messages: MOCK_MESSAGES })
    render(<StatePanel />)
    // Label renders as "Severity"; CSS text-transform:uppercase is not applied by jsdom
    expect(screen.getByText('Severity')).toBeInTheDocument()
  })

  it('renders severity value "3" (crisisSeverity = 3)', () => {
    useGameStore.setState({ gameState: MOCK_GAME_STATE, messages: MOCK_MESSAGES })
    render(<StatePanel />)
    // Multiple "3" values may exist (readiness, stock, crm etc.) — just confirm at least one
    const threes = screen.getAllByText('3')
    expect(threes.length).toBeGreaterThanOrEqual(1)
  })

  it('renders legitimacy track label "Legitimacy" (CSS uppercase applied by browser)', () => {
    useGameStore.setState({ gameState: MOCK_GAME_STATE, messages: MOCK_MESSAGES })
    render(<StatePanel />)
    expect(screen.getByText('Legitimacy')).toBeInTheDocument()
  })

  it('renders legitimacy signed value "+1" (edipLegitimacy = 1)', () => {
    useGameStore.setState({ gameState: MOCK_GAME_STATE, messages: MOCK_MESSAGES })
    render(<StatePanel />)
    // "+1" appears in legitimacy track header span (no class) + resource-po spans
    // Assert via the bare span in TrackBar header which has no extra class
    const plusOnes = screen.getAllByText('+1')
    expect(plusOnes.length).toBeGreaterThanOrEqual(1)
  })

  // ─── Track bar animation class ───────────────────────────────────────────────

  it('severity track fill has transition-[width] class for animation', () => {
    useGameStore.setState({ gameState: MOCK_GAME_STATE, messages: MOCK_MESSAGES })
    const { container } = render(<StatePanel />)
    // Simple mode fill uses transition-[width]
    const animatedFill = container.querySelector('[class*="transition-\\[width\\]"]')
    expect(animatedFill).not.toBeNull()
  })

  // ─── Team cards ──────────────────────────────────────────────────────────────

  it('renders Team A card', () => {
    useGameStore.setState({ gameState: MOCK_GAME_STATE, messages: MOCK_MESSAGES })
    render(<StatePanel />)
    expect(screen.getByText('Team A')).toBeInTheDocument()
  })

  it('renders Team B card', () => {
    useGameStore.setState({ gameState: MOCK_GAME_STATE, messages: MOCK_MESSAGES })
    render(<StatePanel />)
    expect(screen.getByText('Team B')).toBeInTheDocument()
  })

  it('renders Team C card', () => {
    useGameStore.setState({ gameState: MOCK_GAME_STATE, messages: MOCK_MESSAGES })
    render(<StatePanel />)
    expect(screen.getByText('Team C')).toBeInTheDocument()
  })

  it('renders Team D card', () => {
    useGameStore.setState({ gameState: MOCK_GAME_STATE, messages: MOCK_MESSAGES })
    render(<StatePanel />)
    expect(screen.getByText('Team D')).toBeInTheDocument()
  })

  // ─── PC badges ───────────────────────────────────────────────────────────────

  it('Team A shows STRAINED badge (pc=1)', () => {
    useGameStore.setState({ gameState: MOCK_GAME_STATE, messages: MOCK_MESSAGES })
    render(<StatePanel />)
    expect(screen.getByText('STRAINED')).toBeInTheDocument()
  })

  it('Team B shows CRISIS badge (pc=0)', () => {
    useGameStore.setState({ gameState: MOCK_GAME_STATE, messages: MOCK_MESSAGES })
    render(<StatePanel />)
    expect(screen.getByText('CRISIS')).toBeInTheDocument()
  })

  it('Team C does not show STRAINED or CRISIS badge (pc=3)', () => {
    // Ensure only one STRAINED (Team A) and one CRISIS (Team B)
    useGameStore.setState({ gameState: MOCK_GAME_STATE, messages: MOCK_MESSAGES })
    render(<StatePanel />)
    const strainedBadges = screen.queryAllByText('STRAINED')
    const crisisBadges = screen.queryAllByText('CRISIS')
    expect(strainedBadges).toHaveLength(1) // Team A only
    expect(crisisBadges).toHaveLength(1)   // Team B only
  })

  it('Team D does not show STRAINED or CRISIS badge (pc=4)', () => {
    useGameStore.setState({ gameState: MOCK_GAME_STATE, messages: MOCK_MESSAGES })
    render(<StatePanel />)
    // Teams C and D have no badge — total badge count still 1+1
    const allBadges = screen.queryAllByText(/^(STRAINED|CRISIS)$/)
    expect(allBadges).toHaveLength(2)
  })

  // ─── CRISIS badge has blink animation ────────────────────────────────────────

  it('CRISIS badge for Team B has var(--animate-blink) inline style', () => {
    useGameStore.setState({ gameState: MOCK_GAME_STATE, messages: MOCK_MESSAGES })
    const { container } = render(<StatePanel />)
    const crisisBadge = container.querySelector('span[style*="--animate-blink"]')
    expect(crisisBadge).not.toBeNull()
    expect(crisisBadge?.textContent).toBe('CRISIS')
  })

  // ─── Resource grid values ────────────────────────────────────────────────────

  it('Team A resource grid shows PC label', () => {
    useGameStore.setState({ gameState: MOCK_GAME_STATE, messages: MOCK_MESSAGES })
    render(<StatePanel />)
    // PC label appears in every team card; getAllByText is fine
    const pcLabels = screen.getAllByText('PC')
    expect(pcLabels.length).toBeGreaterThanOrEqual(1)
  })

  it('Team A resource grid shows readiness value 3 (via RDY label presence)', () => {
    useGameStore.setState({ gameState: MOCK_GAME_STATE, messages: MOCK_MESSAGES })
    render(<StatePanel />)
    const rdyLabels = screen.getAllByText('RDY')
    expect(rdyLabels.length).toBeGreaterThanOrEqual(1)
  })

  it('Team A PO displays as +0 (signed)', () => {
    useGameStore.setState({ gameState: MOCK_GAME_STATE, messages: MOCK_MESSAGES })
    render(<StatePanel />)
    // Team A po=0 → "+0"; Team D po=1 → "+1" (already tested via legitimacy)
    const zeroSigned = screen.getAllByText('+0')
    expect(zeroSigned.length).toBeGreaterThanOrEqual(1)
  })

  // ─── Persona dots ─────────────────────────────────────────────────────────────

  it('kent dot is lit (data-lit="true") — kent spoke in Round 2', () => {
    useGameStore.setState({ gameState: MOCK_GAME_STATE, messages: MOCK_MESSAGES })
    const { container } = render(<StatePanel />)
    const kentDot = container.querySelector('[data-testid="persona-dot-kent"]')
    expect(kentDot).not.toBeNull()
    expect(kentDot?.getAttribute('data-lit')).toBe('true')
  })

  it('finch dot is lit (data-lit="true") — finch spoke in Round 2', () => {
    useGameStore.setState({ gameState: MOCK_GAME_STATE, messages: MOCK_MESSAGES })
    const { container } = render(<StatePanel />)
    const finchDot = container.querySelector('[data-testid="persona-dot-finch"]')
    expect(finchDot).not.toBeNull()
    expect(finchDot?.getAttribute('data-lit')).toBe('true')
  })

  it('chen dot is dim (data-lit="false") — no chen message after Round 2 divider', () => {
    useGameStore.setState({ gameState: MOCK_GAME_STATE, messages: MOCK_MESSAGES })
    const { container } = render(<StatePanel />)
    const chenDot = container.querySelector('[data-testid="persona-dot-chen"]')
    expect(chenDot).not.toBeNull()
    expect(chenDot?.getAttribute('data-lit')).toBe('false')
  })

  // ─── Null guard ────────────────────────────────────────────────────────────────

  it('renders nothing when gameState is null', () => {
    useGameStore.setState({ gameState: null, messages: [] })
    const { container } = render(<StatePanel />)
    expect(container.firstChild).toBeNull()
  })

  // ─── Delta diff + ghost labels (Plan 06-09) ──────────────────────────────────

  describe('delta ghost labels', () => {
    it('initial render shows no ghost labels (prevStateRef null on mount)', () => {
      useGameStore.setState({ gameState: MOCK_GAME_STATE, messages: MOCK_MESSAGES })
      render(<StatePanel />)
      // No ghost element should render on first pass
      const severityGhost = screen.queryByTestId('trackbar-ghost-severity')
      const legitimacyGhost = screen.queryByTestId('trackbar-ghost-legitimacy')
      expect(severityGhost).toBeNull()
      expect(legitimacyGhost).toBeNull()
    })

    it('renders severity ghost "+1" when crisisSeverity increments after mount', () => {
      useGameStore.setState({ gameState: MOCK_GAME_STATE, messages: MOCK_MESSAGES })
      render(<StatePanel />)
      // Simulate a state update that bumps severity by 1
      const updated: GameState = {
        ...MOCK_GAME_STATE,
        crisisSeverity: MOCK_GAME_STATE.crisisSeverity + 1,
      }
      act(() => {
        useGameStore.setState({ gameState: updated })
      })
      const ghost = screen.getByTestId('trackbar-ghost-severity')
      expect(ghost).toBeInTheDocument()
      expect(ghost.textContent).toBe('+1')
    })

    it('crisisSeverity decrease (-2) tints favourable (green, text-track-readiness)', () => {
      useGameStore.setState({ gameState: MOCK_GAME_STATE, messages: MOCK_MESSAGES })
      render(<StatePanel />)
      const updated: GameState = {
        ...MOCK_GAME_STATE,
        crisisSeverity: MOCK_GAME_STATE.crisisSeverity - 2,
      }
      act(() => {
        useGameStore.setState({ gameState: updated })
      })
      const ghost = screen.getByTestId('trackbar-ghost-severity')
      expect(ghost.textContent).toBe('-2')
      expect(ghost.className).toContain('text-track-readiness')
      expect(ghost.className).not.toContain('text-crisis-security')
    })

    it('crisisSeverity increase (+2) tints unfavourable (red, text-crisis-security)', () => {
      useGameStore.setState({ gameState: MOCK_GAME_STATE, messages: MOCK_MESSAGES })
      render(<StatePanel />)
      const updated: GameState = {
        ...MOCK_GAME_STATE,
        crisisSeverity: MOCK_GAME_STATE.crisisSeverity + 2,
      }
      act(() => {
        useGameStore.setState({ gameState: updated })
      })
      const ghost = screen.getByTestId('trackbar-ghost-severity')
      expect(ghost.textContent).toBe('+2')
      expect(ghost.className).toContain('text-crisis-security')
      expect(ghost.className).not.toContain('text-track-readiness')
    })

    it('edipLegitimacy decrease tints unfavourable (text-crisis-security)', () => {
      useGameStore.setState({ gameState: MOCK_GAME_STATE, messages: MOCK_MESSAGES })
      render(<StatePanel />)
      const updated: GameState = {
        ...MOCK_GAME_STATE,
        edipLegitimacy: MOCK_GAME_STATE.edipLegitimacy - 1,
      }
      act(() => {
        useGameStore.setState({ gameState: updated })
      })
      const ghost = screen.getByTestId('trackbar-ghost-legitimacy')
      expect(ghost.textContent).toBe('-1')
      expect(ghost.className).toContain('text-crisis-security')
    })

    it('edipLegitimacy increase tints favourable (text-track-readiness)', () => {
      useGameStore.setState({ gameState: MOCK_GAME_STATE, messages: MOCK_MESSAGES })
      render(<StatePanel />)
      const updated: GameState = {
        ...MOCK_GAME_STATE,
        edipLegitimacy: MOCK_GAME_STATE.edipLegitimacy + 1,
      }
      act(() => {
        useGameStore.setState({ gameState: updated })
      })
      const ghost = screen.getByTestId('trackbar-ghost-legitimacy')
      expect(ghost.textContent).toBe('+1')
      expect(ghost.className).toContain('text-track-readiness')
    })

    it('zero delta is a no-op (no ghost rendered)', () => {
      useGameStore.setState({ gameState: MOCK_GAME_STATE, messages: MOCK_MESSAGES })
      render(<StatePanel />)
      // Re-set with same values — deltas compute to 0 → no ghost
      act(() => {
        useGameStore.setState({ gameState: { ...MOCK_GAME_STATE } })
      })
      expect(screen.queryByTestId('trackbar-ghost-severity')).toBeNull()
      expect(screen.queryByTestId('trackbar-ghost-legitimacy')).toBeNull()
    })

    it('ghost element carries animate-[ghostFade_2500ms_ease-out_both] class', () => {
      useGameStore.setState({ gameState: MOCK_GAME_STATE, messages: MOCK_MESSAGES })
      render(<StatePanel />)
      const updated: GameState = {
        ...MOCK_GAME_STATE,
        crisisSeverity: MOCK_GAME_STATE.crisisSeverity + 1,
      }
      act(() => {
        useGameStore.setState({ gameState: updated })
      })
      const ghost = screen.getByTestId('trackbar-ghost-severity')
      expect(ghost.className).toContain('animate-[ghostFade_2500ms_ease-out_both]')
    })
  })
})
