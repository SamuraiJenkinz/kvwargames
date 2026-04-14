import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useGameStore } from '@/lib/gameStore'
import type { GameConfig } from '@/types/game'
import { EDIP_CONFIG } from '@/data/edipConfig'
import ReferencePanel from './ReferencePanel'

vi.mock('zustand')

describe('ReferencePanel', () => {
  it('renders three tab buttons with correct labels', () => {
    useGameStore.setState({ gameConfig: EDIP_CONFIG as GameConfig, activeTab: 'cards' })
    render(<ReferencePanel />)

    expect(screen.getByRole('button', { name: /cards/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /actions/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /guide/i })).toBeInTheDocument()
  })

  it('defaults to cards tab active', () => {
    useGameStore.setState({ gameConfig: EDIP_CONFIG as GameConfig, activeTab: 'cards' })
    render(<ReferencePanel />)

    const cardsBtn = screen.getByRole('button', { name: /cards/i })
    expect(cardsBtn.className).toContain('opacity-100')
  })

  it('inactive tabs have opacity-60 class', () => {
    useGameStore.setState({ gameConfig: EDIP_CONFIG as GameConfig, activeTab: 'cards' })
    render(<ReferencePanel />)

    const actionsBtn = screen.getByRole('button', { name: /actions/i })
    const guideBtn   = screen.getByRole('button', { name: /guide/i })
    expect(actionsBtn.className).toContain('opacity-60')
    expect(guideBtn.className).toContain('opacity-60')
  })

  it('clicking ACTIONS tab shows National Actions and Team Unique Powers sections', () => {
    useGameStore.setState({ gameConfig: EDIP_CONFIG as GameConfig, activeTab: 'cards' })
    render(<ReferencePanel />)

    fireEvent.click(screen.getByRole('button', { name: /actions/i }))

    expect(useGameStore.getState().activeTab).toBe('actions')
    expect(screen.getByText('National Actions')).toBeInTheDocument()
    expect(screen.getByText('Team Unique Powers')).toBeInTheDocument()
  })

  it('clicking GUIDE tab shows Objective and Voting Rule section headers', () => {
    useGameStore.setState({ gameConfig: EDIP_CONFIG as GameConfig, activeTab: 'cards' })
    render(<ReferencePanel />)

    fireEvent.click(screen.getByRole('button', { name: /guide/i }))

    expect(useGameStore.getState().activeTab).toBe('guide')
    expect(screen.getByText('Objective')).toBeInTheDocument()
    expect(screen.getByText('Voting Rule')).toBeInTheDocument()
  })

  it('CARDS tab renders 11 card list items from EDIP_CONFIG', () => {
    useGameStore.setState({ gameConfig: EDIP_CONFIG as GameConfig, activeTab: 'cards' })
    render(<ReferencePanel />)

    // Each card renders as a button in the list view
    // EDIP_CONFIG has 11 cards
    const cardButtons = screen.getAllByRole('button', { name: /./i })
    // Filter to those that are card-list buttons (not tab buttons)
    // Tab buttons are CARDS/ACTIONS/GUIDE; card buttons have card names
    const tabNames = ['CARDS', 'ACTIONS', 'GUIDE']
    const cardListButtons = cardButtons.filter(
      (btn) => !tabNames.includes(btn.textContent?.trim() ?? '')
    )
    expect(cardListButtons.length).toBe(EDIP_CONFIG.cards.length)
    expect(EDIP_CONFIG.cards.length).toBe(11)
  })

  it('clicking a card in the CARDS tab shows detail view with Back button', () => {
    useGameStore.setState({ gameConfig: EDIP_CONFIG as GameConfig, activeTab: 'cards' })
    render(<ReferencePanel />)

    // Click the first card
    const firstCard = EDIP_CONFIG.cards[0]
    const cardBtn = screen.getByRole('button', { name: new RegExp(firstCard.name, 'i') })
    fireEvent.click(cardBtn)

    // List should be replaced by detail view
    // Back button should appear
    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument()
    // Card id should be visible
    expect(screen.getByText(firstCard.id)).toBeInTheDocument()
    // List should be gone — no longer showing all 11 card buttons
    expect(screen.queryAllByRole('button', { name: new RegExp(EDIP_CONFIG.cards[1].name, 'i') }).length).toBe(0)
  })

  it('clicking Back in card detail returns to card list', () => {
    useGameStore.setState({ gameConfig: EDIP_CONFIG as GameConfig, activeTab: 'cards' })
    render(<ReferencePanel />)

    // Navigate to detail
    const firstCard = EDIP_CONFIG.cards[0]
    fireEvent.click(screen.getByRole('button', { name: new RegExp(firstCard.name, 'i') }))
    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument()

    // Click Back
    fireEvent.click(screen.getByRole('button', { name: /back/i }))

    // List should be restored
    expect(screen.getByRole('button', { name: new RegExp(firstCard.name, 'i') })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument()
  })

  it('GUIDE tab shows all 6 section headers', () => {
    useGameStore.setState({ gameConfig: EDIP_CONFIG as GameConfig, activeTab: 'guide' })
    render(<ReferencePanel />)

    expect(screen.getByText('Objective')).toBeInTheDocument()
    expect(screen.getByText('Red Lines & PC Thresholds')).toBeInTheDocument()
    expect(screen.getByText('Voting Rule')).toBeInTheDocument()
    expect(screen.getByText('Resource Tokens')).toBeInTheDocument()
    expect(screen.getByText('EO Response Mechanic')).toBeInTheDocument()
    expect(screen.getByText('Facilitator Input Guide')).toBeInTheDocument()
  })
})
