import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { TeamState } from '@/types/game'
import TeamCard from './TeamCard'

const BASE_TEAM: TeamState = {
  id: 'A',
  name: 'Team A: Frontline & High-Threat',
  pc: 3,
  po: 0,
  readiness: 3,
  stock: 3,
  crm: 3,
  ic: 3,
}

describe('TeamCard', () => {
  // ─── No deltas → no pulse, no ghost ─────────────────────────────────────────

  it('no deltas prop → no cellPulse class, no ghost labels', () => {
    render(<TeamCard team={BASE_TEAM} />)
    // Every cell exists but has no pulse animation class
    for (const key of ['pc', 'po', 'readiness', 'stock', 'crm', 'ic'] as const) {
      const cell = screen.getByTestId(`teamcard-cell-A-${key}`)
      expect(cell.className).not.toContain('animate-[cellPulse')
      expect(screen.queryByTestId(`teamcard-ghost-A-${key}`)).toBeNull()
    }
  })

  it('empty deltas object → no pulse, no ghost labels', () => {
    render(<TeamCard team={BASE_TEAM} deltas={{}} />)
    for (const key of ['pc', 'po', 'readiness', 'stock', 'crm', 'ic'] as const) {
      const cell = screen.getByTestId(`teamcard-cell-A-${key}`)
      expect(cell.className).not.toContain('animate-[cellPulse')
      expect(screen.queryByTestId(`teamcard-ghost-A-${key}`)).toBeNull()
    }
  })

  // ─── Positive favourable delta (pc +2) ──────────────────────────────────────

  it('deltas={pc: +2} → PC cell pulses, ghost "+2" with text-track-readiness (favourable)', () => {
    render(<TeamCard team={BASE_TEAM} deltas={{ pc: 2 }} />)
    const cell = screen.getByTestId('teamcard-cell-A-pc')
    expect(cell.className).toContain('animate-[cellPulse_800ms_ease-out_both]')
    const ghost = screen.getByTestId('teamcard-ghost-A-pc')
    expect(ghost.textContent).toBe('+2')
    expect(ghost.className).toContain('text-track-readiness')
    expect(ghost.className).not.toContain('text-crisis-security')
    expect(ghost.className).toContain('animate-[ghostFade_2500ms_ease-out_both]')
  })

  // ─── Negative unfavourable delta (readiness -1) ─────────────────────────────

  it('deltas={readiness: -1} → ghost "-1" with text-crisis-security (unfavourable)', () => {
    render(<TeamCard team={BASE_TEAM} deltas={{ readiness: -1 }} />)
    const cell = screen.getByTestId('teamcard-cell-A-readiness')
    expect(cell.className).toContain('animate-[cellPulse_800ms_ease-out_both]')
    const ghost = screen.getByTestId('teamcard-ghost-A-readiness')
    expect(ghost.textContent).toBe('-1')
    expect(ghost.className).toContain('text-crisis-security')
    expect(ghost.className).not.toContain('text-track-readiness')
  })

  // ─── Zero delta is a no-op ─────────────────────────────────────────────────

  it('deltas={pc: 0} → NO pulse, NO ghost label', () => {
    render(<TeamCard team={BASE_TEAM} deltas={{ pc: 0 }} />)
    const cell = screen.getByTestId('teamcard-cell-A-pc')
    expect(cell.className).not.toContain('animate-[cellPulse')
    expect(screen.queryByTestId('teamcard-ghost-A-pc')).toBeNull()
  })

  // ─── Multiple deltas simultaneously ────────────────────────────────────────

  it('deltas={pc: +1, readiness: -2} → both cells pulse independently', () => {
    render(<TeamCard team={BASE_TEAM} deltas={{ pc: 1, readiness: -2 }} />)
    const pcCell = screen.getByTestId('teamcard-cell-A-pc')
    const readinessCell = screen.getByTestId('teamcard-cell-A-readiness')
    expect(pcCell.className).toContain('animate-[cellPulse')
    expect(readinessCell.className).toContain('animate-[cellPulse')

    // Untouched cells stay calm
    const poCell = screen.getByTestId('teamcard-cell-A-po')
    expect(poCell.className).not.toContain('animate-[cellPulse')
    expect(screen.queryByTestId('teamcard-ghost-A-po')).toBeNull()

    const pcGhost = screen.getByTestId('teamcard-ghost-A-pc')
    const readinessGhost = screen.getByTestId('teamcard-ghost-A-readiness')
    expect(pcGhost.textContent).toBe('+1')
    expect(pcGhost.className).toContain('text-track-readiness') // pc up favourable
    expect(readinessGhost.textContent).toBe('-2')
    expect(readinessGhost.className).toContain('text-crisis-security') // readiness down unfavourable
  })

  // ─── PO favourability (signed resource) ────────────────────────────────────

  it('deltas={po: +1} → ghost "+1" favourable (PO up = better)', () => {
    render(<TeamCard team={BASE_TEAM} deltas={{ po: 1 }} />)
    const ghost = screen.getByTestId('teamcard-ghost-A-po')
    expect(ghost.textContent).toBe('+1')
    expect(ghost.className).toContain('text-track-readiness')
  })

  it('deltas={po: -1} → ghost "-1" unfavourable', () => {
    render(<TeamCard team={BASE_TEAM} deltas={{ po: -1 }} />)
    const ghost = screen.getByTestId('teamcard-ghost-A-po')
    expect(ghost.textContent).toBe('-1')
    expect(ghost.className).toContain('text-crisis-security')
  })

  // ─── Existing base behaviour preserved ──────────────────────────────────────

  it('renders team label "Team A"', () => {
    render(<TeamCard team={BASE_TEAM} />)
    expect(screen.getByText('Team A')).toBeInTheDocument()
  })

  it('renders signed PO value "+0" when po=0', () => {
    render(<TeamCard team={BASE_TEAM} />)
    expect(screen.getByText('+0')).toBeInTheDocument()
  })
})
