import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import LoadConfigPanel from './LoadConfigPanel'
import { AppRoutes } from '@/App'
import { useGameStore } from '@/lib/gameStore'
import { EDIP_CONFIG } from '@/data/edipConfig'

vi.mock('zustand')

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Minimal JSON that parseConfigJson ACCEPTS (has non-empty scenarios + teams arrays),
 * but validateGameConfig REJECTS (missing name, pcThresholds, nationalActions, cards).
 * Used for tests that verify the two-layer validation chain.
 */
const PARSE_OK_SCHEMA_FAIL_JSON = JSON.stringify({
  scenarios: [{ id: 's1', name: 'S1', injects: ['inject text'] }],
  teams: [{ id: 't1', name: 'Team 1', pc: 3, po: 0, readiness: 3, stock: 2, crm: 2, ic: 2 }],
  // missing: name, pcThresholds, nationalActions, cards
})

/**
 * Valid EDIP config JSON — parseConfigJson accepts and validateGameConfig passes.
 */
const EDIP_JSON = JSON.stringify(EDIP_CONFIG, null, 2)

/**
 * EDIP JSON with teams[0].pc corrupted to a string — parseConfigJson accepts
 * (only checks array existence) but validateGameConfig flags teams[0].pc.
 */
function edipJsonWithCorruptPc(): string {
  const cfg = JSON.parse(EDIP_JSON) as Record<string, unknown>
  const teams = cfg.teams as Record<string, unknown>[]
  teams[0] = { ...teams[0], pc: 'strong' }
  return JSON.stringify(cfg, null, 2)
}

// ─── LoadConfigPanel — disabled Launch buttons on invalid JSON ────────────────

describe('LoadConfigPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('disables Launch buttons when JSON is invalid', async () => {
    // Use the full EDIP config (passes both parseConfigJson AND validateGameConfig)
    // so buttons are initially enabled on mount, then corrupt JSON to trigger parse failure.

    // Start with valid JSON so a scenario count is established on mount
    useGameStore.setState({ configJson: EDIP_JSON, draftSource: null })

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

  // ── Test A: draftSource !== 'brief' — banner NOT shown even on schema failure ──

  it('Test A: does not show Structure OK banner when draftSource is not "brief"', async () => {
    // Seed: parse passes (has scenarios + teams), but schema fails (missing name, pcThresholds etc.)
    // draftSource is 'load' — banner should be suppressed
    useGameStore.setState({
      configJson: PARSE_OK_SCHEMA_FAIL_JSON,
      draftSource: 'load',
    })

    render(
      <MemoryRouter>
        <LoadConfigPanel />
      </MemoryRouter>,
    )

    await act(async () => {
      vi.advanceTimersByTime(350)
    })

    // No "Structure OK" banner should be rendered for non-brief source
    const alerts = screen.queryAllByRole('alert')
    alerts.forEach((alert) => {
      expect(alert.textContent).not.toMatch(/structure ok but/i)
    })
  })

  // ── Test B: draftSource === 'brief' AND validation fails — banner shown ────────

  it('Test B: shows Structure OK banner with error list when draftSource is "brief" and schema fails', async () => {
    // Seed with JSON that parseConfigJson accepts but validateGameConfig rejects
    useGameStore.setState({
      configJson: PARSE_OK_SCHEMA_FAIL_JSON,
      draftSource: 'brief',
    })

    render(
      <MemoryRouter>
        <LoadConfigPanel />
      </MemoryRouter>,
    )

    await act(async () => {
      vi.advanceTimersByTime(350)
    })

    // Banner should be present
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toMatch(/structure ok but/i)

    // Banner should list at least 2 error paths (name, pcThresholds, nationalActions, cards)
    const listItems = alert.querySelectorAll('li')
    expect(listItems.length).toBeGreaterThanOrEqual(2)
  })

  // ── Test C: Launch buttons disabled when validation errors present ─────────────

  it('Test C: Launch buttons are disabled when schema validation fails (parse passes)', async () => {
    // edipJsonWithCorruptPc: parseConfigJson accepts (has scenarios+teams), but
    // validateGameConfig rejects because teams[0].pc is "strong" (not a number)
    useGameStore.setState({
      configJson: edipJsonWithCorruptPc(),
      draftSource: 'brief',
    })

    render(
      <MemoryRouter>
        <LoadConfigPanel />
      </MemoryRouter>,
    )

    await act(async () => {
      vi.advanceTimersByTime(350)
    })

    // Confirm Launch button(s) are disabled
    const launchButtons = screen.getAllByRole('button', { name: /Launch Scenario/i })
    expect(launchButtons.length).toBeGreaterThan(0)
    launchButtons.forEach((b) => {
      expect(b).toBeDisabled()
    })
  })

  // ── Test D: Fixing config clears errors + re-enables Launch ───────────────────

  it('Test D: fixing the config clears validation errors and re-enables Launch buttons', async () => {
    // Start with a config that fails schema validation (parse OK, schema fail)
    useGameStore.setState({
      configJson: PARSE_OK_SCHEMA_FAIL_JSON,
      draftSource: 'brief',
    })

    render(
      <MemoryRouter>
        <LoadConfigPanel />
      </MemoryRouter>,
    )

    await act(async () => {
      vi.advanceTimersByTime(350)
    })

    // Confirm banner is showing and buttons are disabled
    expect(screen.getByRole('alert').textContent).toMatch(/structure ok but/i)
    const buttons = screen.getAllByRole('button', { name: /Launch Scenario/i })
    buttons.forEach((b) => expect(b).toBeDisabled())

    // Now fix the config by writing valid EDIP JSON to the textarea
    const textarea = screen.getByRole('textbox', { name: /game configuration json/i })
    fireEvent.change(textarea, { target: { value: EDIP_JSON } })

    await act(async () => {
      vi.advanceTimersByTime(350)
    })

    // Banner should be gone, Launch buttons should be enabled
    const alerts = screen.queryAllByRole('alert')
    alerts.forEach((alert) => {
      expect(alert.textContent).not.toMatch(/structure ok but/i)
    })

    const fixedButtons = screen.getAllByRole('button', { name: /Launch Scenario/i })
    fixedButtons.forEach((b) => {
      expect(b).not.toBeDisabled()
    })
  })

  // ── Test E: Error banner lists error paths in mono font ───────────────────────

  it('Test E: validation error banner lists error path strings', async () => {
    useGameStore.setState({
      configJson: PARSE_OK_SCHEMA_FAIL_JSON,
      draftSource: 'brief',
    })

    render(
      <MemoryRouter>
        <LoadConfigPanel />
      </MemoryRouter>,
    )

    await act(async () => {
      vi.advanceTimersByTime(350)
    })

    // The banner should contain known error path strings for the missing fields
    const alert = screen.getByRole('alert')

    // 'name', 'pcThresholds', 'nationalActions', 'cards' should all appear in banner
    expect(alert.textContent).toContain('name')
    expect(alert.textContent).toContain('pcThresholds')
    expect(alert.textContent).toContain('nationalActions')
    expect(alert.textContent).toContain('cards')

    // Each error path lives in a <li> with a mono-font span
    const listItems = alert.querySelectorAll('li')
    expect(listItems.length).toBeGreaterThanOrEqual(4)
  })
})

// ─── AppRoutes guard — /game redirects to /setup when gameState is null ───────
// This tests the production contract (DEV=false). In DEV mode the guard instead
// seeds mock state via seedMockState() — that path is not exercised here.

describe('AppRoutes', () => {
  it('redirects /game to /setup when gameState is null (production path, DEV=false)', () => {
    // Simulate production: disable DEV seed path so the null-guard redirect fires.
    vi.stubEnv('DEV', false)

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

    vi.unstubAllEnvs()
  })
})
