import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GenerateBriefPanel from './GenerateBriefPanel'
import { useGameStore } from '@/lib/gameStore'

vi.mock('zustand')

// ─── GenerateBriefPanel tests ─────────────────────────────────────────────────

describe('GenerateBriefPanel', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    // Reset store to fresh state for each test
    useGameStore.setState({
      briefText: '',
      configJson: '',
      draftSource: null,
      setupMode: 'brief',
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  // ─── Test A: Generate button is disabled when brief < 50 chars ────────────

  it('Generate button is disabled when brief has fewer than 50 chars', async () => {
    const user = userEvent.setup()
    render(<GenerateBriefPanel />)

    const textarea = screen.getByRole('textbox')
    const generateBtn = screen.getByRole('button', { name: /Generate/i })

    // Initially empty — disabled
    expect(generateBtn).toBeDisabled()

    // Type 20 chars — still disabled
    await user.type(textarea, 'A'.repeat(20))
    expect(generateBtn).toBeDisabled()

    // Type to reach 50 chars — should be enabled
    await user.clear(textarea)
    await user.type(textarea, 'A'.repeat(50))
    expect(generateBtn).not.toBeDisabled()
  })

  // ─── Test B: Clicking Generate calls /api/generate-config with JSON body ──

  it('clicking Generate calls /api/generate-config with JSON body containing brief', async () => {
    const user = userEvent.setup()
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ text: '{"name":"X"}' }), { status: 200 }),
    )

    // Seed a valid brief (100 chars)
    useGameStore.setState({ briefText: 'A'.repeat(100) })

    render(<GenerateBriefPanel />)

    const generateBtn = screen.getByRole('button', { name: /Generate/i })
    await user.click(generateBtn)

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/generate-config',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        body: expect.stringContaining('"brief"'),
      }),
    )
  })

  // ─── Test C: Successful response writes to store and transitions to 'load' ─

  it('successful response writes configJson + draftSource to store and sets setupMode=load', async () => {
    const user = userEvent.setup()
    const generatedConfig = { name: 'Test Game', domain: 'Test' }
    const rawJson = JSON.stringify(generatedConfig)
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ text: rawJson }), { status: 200 }),
    )

    useGameStore.setState({ briefText: 'A'.repeat(100) })

    render(<GenerateBriefPanel />)

    const generateBtn = screen.getByRole('button', { name: /Generate/i })
    await user.click(generateBtn)

    await waitFor(() => {
      expect(useGameStore.getState().setupMode).toBe('load')
    })

    const storedJson = useGameStore.getState().configJson
    expect(storedJson).toContain('"Test Game"')
    expect(useGameStore.getState().draftSource).toBe('brief')
  })

  // ─── Test D: Parse failure shows PARSE_FAILURE error ─────────────────────

  it('shows PARSE_FAILURE error when response text is not valid JSON', async () => {
    const user = userEvent.setup()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ text: 'not json at all' }), { status: 200 }),
    )

    useGameStore.setState({ briefText: 'A'.repeat(100) })

    render(<GenerateBriefPanel />)

    const generateBtn = screen.getByRole('button', { name: /Generate/i })
    await user.click(generateBtn)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    expect(screen.getByRole('alert')).toHaveTextContent("wasn't valid JSON")
    // Should NOT transition to load
    expect(useGameStore.getState().setupMode).toBe('brief')
  })

  // ─── Test E: Backend error codes map to correct copy ─────────────────────

  it.each([
    [
      'LLM_TIMEOUT',
      504,
      'Generation timed out. Try again or shorten your brief.',
    ],
    [
      'LLM_AUTH_ERROR',
      401,
      'Backend credentials issue. Contact the facilitator admin.',
    ],
    [
      'LLM_UPSTREAM_ERROR',
      502,
      'LLM service returned an error. Try again.',
    ],
    [
      'LLM_UNREACHABLE',
      502,
      "Can't reach the LLM service. Check your connection.",
    ],
    [
      'INTERNAL_ERROR',
      500,
      'Unexpected error. Try again; if it persists, check backend logs.',
    ],
  ])(
    'backend error code %s maps to correct user-facing copy',
    async (code, status, expectedCopy) => {
      const user = userEvent.setup()
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: { code, message: 'upstream error' } }),
          { status },
        ),
      )

      useGameStore.setState({ briefText: 'A'.repeat(100) })

      const { unmount } = render(<GenerateBriefPanel />)

      const generateBtn = screen.getByRole('button', { name: /Generate/i })
      await user.click(generateBtn)

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument()
      })

      expect(screen.getByRole('alert')).toHaveTextContent(expectedCopy)

      unmount()
    },
  )

  // ─── Test F: Cancel button aborts in-flight request ──────────────────────

  it('Cancel button aborts in-flight request and returns to idle with no error', async () => {
    const user = userEvent.setup()

    // Mock fetch as a promise that simulates browser AbortError on signal abort
    let capturedSignal: AbortSignal | undefined
    vi.mocked(fetch).mockImplementationOnce((_url, init) => {
      capturedSignal = init?.signal as AbortSignal
      return new Promise<Response>((_resolve, reject) => {
        capturedSignal?.addEventListener('abort', () => {
          reject(new DOMException('aborted', 'AbortError'))
        })
      })
    })

    useGameStore.setState({ briefText: 'A'.repeat(100) })

    render(<GenerateBriefPanel />)

    const generateBtn = screen.getByRole('button', { name: /Generate/i })
    await user.click(generateBtn)

    // Loading spinner should be visible
    await waitFor(() => {
      expect(screen.getByRole('status')).toBeInTheDocument()
    })
    expect(screen.getByText(/Generating config/)).toBeInTheDocument()

    // Click Cancel
    const cancelBtn = screen.getByRole('button', { name: /Cancel/i })
    await user.click(cancelBtn)

    // Loading should be gone; no error banner
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    // Generate button should be back (idle state)
    expect(screen.getByRole('button', { name: /Generate/i })).toBeInTheDocument()

    // setupMode unchanged
    expect(useGameStore.getState().setupMode).toBe('brief')
  })

  // ─── Test G: Example chip click populates briefText ──────────────────────

  it('clicking an example chip sets briefText in the store', async () => {
    const user = userEvent.setup()
    render(<GenerateBriefPanel />)

    const energyChip = screen.getByRole('button', { name: /Energy supply crisis/i })
    await user.click(energyChip)

    const { briefText } = useGameStore.getState()
    expect(briefText).toContain('pipeline sabotage')
  })
})
