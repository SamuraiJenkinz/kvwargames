import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TtsHealthBadge from './TtsHealthBadge'

describe('TtsHealthBadge', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  // ─── Test 1: checking state on mount ─────────────────────────────────────────

  it('renders checking state on mount while fetch is pending', () => {
    // fetch never resolves — badge stays in checking state
    vi.mocked(fetch).mockImplementation(() => new Promise<Response>(() => {}))

    render(<TtsHealthBadge onStatusChange={vi.fn()} />)

    expect(screen.getByText('Checking TTS connection…')).toBeInTheDocument()
    // Loader2 spinner should be present (has animate-spin class)
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).not.toBeNull()
  })

  // ─── Test 2: ok state on success ─────────────────────────────────────────────

  it('renders ok state with formatted latency on success', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, latencyMs: 234 }), { status: 200 }),
    )

    render(<TtsHealthBadge onStatusChange={vi.fn()} />)

    await waitFor(() =>
      expect(screen.getByText('TTS connected — 234ms')).toBeInTheDocument(),
    )

    // Failed amber dot should NOT be present in ok state
    const amberDot = document.querySelector('.bg-\\[var\\(--color-crisis-supply\\)\\]')
    expect(amberDot).toBeNull()
  })

  // ─── Test 3: failed state with amber color on auth_error ─────────────────────

  it('renders failed state with amber color on auth_error response', async () => {
    const onStatusChange = vi.fn()
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: false,
          code: 'auth_error',
          status: 401,
          hint: 'Check ELEVENLABS_API_KEY',
          latencyMs: 42,
        }),
        { status: 200 },
      ),
    )

    const { container } = render(<TtsHealthBadge onStatusChange={onStatusChange} />)

    await waitFor(() =>
      expect(
        screen.getByText(
          '[auth_error] Podcast generation unavailable — markdown debrief will still work.',
        ),
      ).toBeInTheDocument(),
    )

    // Amber dot present
    const amberDot = container.querySelector('.bg-\\[var\\(--color-crisis-supply\\)\\]')
    expect(amberDot).not.toBeNull()

    // Text uses amber-400 class
    const textSpan = container.querySelector('.text-amber-400')
    expect(textSpan).not.toBeNull()

    // title attribute carries the backend hint
    const statusDiv = container.querySelector('[role="status"]')
    expect(statusDiv).toHaveAttribute('title', 'Check ELEVENLABS_API_KEY')

    // onStatusChange called with 'failed'
    expect(onStatusChange).toHaveBeenCalledWith('failed')
  })

  // ─── Test 4: failed state on backend unreachable (res.ok false) ──────────────

  it('renders failed state on backend unreachable (res.ok false)', async () => {
    const onStatusChange = vi.fn()
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(null, { status: 502 }),
    )

    const { container } = render(<TtsHealthBadge onStatusChange={onStatusChange} />)

    await waitFor(() =>
      expect(
        screen.getByText('Backend unreachable — is the API server running?'),
      ).toBeInTheDocument(),
    )

    // Amber dot present
    const amberDot = container.querySelector('.bg-\\[var\\(--color-crisis-supply\\)\\]')
    expect(amberDot).not.toBeNull()

    expect(onStatusChange).toHaveBeenCalledWith('failed')
  })

  // ─── Test 5: failed state on fetch error (TypeError) ─────────────────────────

  it('renders failed state on TypeError fetch rejection', async () => {
    const onStatusChange = vi.fn()
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'))

    render(<TtsHealthBadge onStatusChange={onStatusChange} />)

    await waitFor(() =>
      expect(
        screen.getByText('Backend unreachable — is the API server running?'),
      ).toBeInTheDocument(),
    )

    expect(onStatusChange).toHaveBeenCalledWith('failed')
  })

  // ─── Test 6: Re-check button fetches with force=true ─────────────────────────

  it('Re-check button fetches /api/health/tts?force=true', async () => {
    const user = userEvent.setup()

    // First fetch (auto-check on mount): ok
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, latencyMs: 100 }), { status: 200 }),
    )
    // Second fetch (Re-check click): also ok
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, latencyMs: 120 }), { status: 200 }),
    )

    render(<TtsHealthBadge onStatusChange={vi.fn()} />)

    // Wait for ok state so Re-check button is enabled
    await waitFor(() =>
      expect(screen.getByText('TTS connected — 100ms')).toBeInTheDocument(),
    )

    const recheckBtn = screen.getByRole('button', { name: /Re-check TTS connection/i })
    expect(recheckBtn).not.toBeDisabled()
    await user.click(recheckBtn)

    // Second call should use force=true URL
    expect(vi.mocked(fetch)).toHaveBeenNthCalledWith(
      2,
      '/api/health/tts?force=true',
      expect.anything(),
    )
  })

  // ─── Test 7: onStatusChange fires with 'checking' then 'ok' ──────────────────

  it('onStatusChange fires with "checking" then "ok" in order', async () => {
    const onStatusChange = vi.fn()

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, latencyMs: 50 }), { status: 200 }),
    )

    render(<TtsHealthBadge onStatusChange={onStatusChange} />)

    await waitFor(() => expect(onStatusChange).toHaveBeenCalledWith('ok'))

    // First call should be 'checking', second should be 'ok'
    expect(onStatusChange).toHaveBeenCalledWith('checking')
    expect(onStatusChange.mock.calls[0][0]).toBe('checking')
    expect(onStatusChange.mock.calls[1][0]).toBe('ok')
  })

  // ─── Test 8: Re-check button disabled while checking ─────────────────────────

  it('Re-check button is disabled while checking state', () => {
    // fetch never resolves — badge stays in checking state
    vi.mocked(fetch).mockImplementation(() => new Promise<Response>(() => {}))

    render(<TtsHealthBadge onStatusChange={vi.fn()} />)

    const recheckBtn = screen.getByRole('button', { name: /Re-check TTS connection/i })
    expect(recheckBtn).toBeDisabled()
  })

  // ─── Test 9: auto-check fetches without force param ──────────────────────────

  it('auto-check on mount fetches /api/health/tts without force param', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, latencyMs: 80 }), { status: 200 }),
    )

    render(<TtsHealthBadge onStatusChange={vi.fn()} />)

    await waitFor(() =>
      expect(screen.getByText('TTS connected — 80ms')).toBeInTheDocument(),
    )

    // First fetch should use the no-force URL
    expect(vi.mocked(fetch)).toHaveBeenNthCalledWith(
      1,
      '/api/health/tts',
      expect.anything(),
    )
  })
})
