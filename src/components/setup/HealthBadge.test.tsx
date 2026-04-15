import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import HealthBadge from './HealthBadge'

describe('HealthBadge', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  // ─── Test 1: ok path renders green dot + formatted latency (sub-second) ───

  it('ok path renders "Connected — 820ms" for latency < 1000ms', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, latencyMs: 820 }), { status: 200 }),
    )

    render(<HealthBadge onStatusChange={vi.fn()} />)

    await waitFor(() => expect(screen.getByText(/Connected — 820ms/)).toBeInTheDocument())
  })

  // ─── Test 2: ok path formats latency ≥ 1000ms as seconds ─────────────────

  it('ok path renders "Connected — 1.2s" for latency >= 1000ms', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, latencyMs: 1234 }), { status: 200 }),
    )

    render(<HealthBadge onStatusChange={vi.fn()} />)

    await waitFor(() => expect(screen.getByText(/Connected — 1\.2s/)).toBeInTheDocument())
  })

  // ─── Test 3: failed path with numeric status renders "{status} — {hint}" ──

  it('failed path with numeric status renders "401 — Authentication failed"', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: false,
          code: 'auth_error',
          status: 401,
          hint: 'Authentication failed — check LLM_API_KEY in .env',
          latencyMs: 120,
        }),
        { status: 200 },
      ),
    )

    render(<HealthBadge onStatusChange={vi.fn()} />)

    await waitFor(() =>
      expect(screen.getByText(/401 — Authentication failed/)).toBeInTheDocument(),
    )
  })

  // ─── Test 4: failed path with null status falls back to code string ───────

  it('failed path with null status falls back to code string, not "null —"', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: false,
          code: 'timeout',
          status: null,
          hint: 'LLM did not respond within 15 seconds — check network or provider latency',
          latencyMs: 15000,
        }),
        { status: 200 },
      ),
    )

    render(<HealthBadge onStatusChange={vi.fn()} />)

    await waitFor(() =>
      expect(screen.getByText(/timeout — LLM did not respond/)).toBeInTheDocument(),
    )
    // Confirm "null" is not rendered as the display code
    expect(screen.queryByText(/null —/)).not.toBeInTheDocument()
  })

  // ─── Test 5: Vite 502 (res.ok false) renders "Backend unreachable" ────────

  it('Vite 502 (res.ok false) renders "Backend unreachable" without calling res.json()', async () => {
    const jsonSpy = vi.fn().mockRejectedValue(new SyntaxError('Unexpected token'))
    vi.mocked(fetch).mockResolvedValueOnce(
      Object.assign(new Response('<html>502 Bad Gateway</html>', { status: 502 }), {
        json: jsonSpy,
      }) as Response,
    )

    render(<HealthBadge onStatusChange={vi.fn()} />)

    await waitFor(() =>
      expect(
        screen.getByText(/Backend unreachable — is the API server running/),
      ).toBeInTheDocument(),
    )
    // Verify res.json() was NOT called on the 502 HTML body (RESEARCH.md Pitfall 2)
    expect(jsonSpy).not.toHaveBeenCalled()
  })

  // ─── Test 6: network rejection (fetch throws TypeError) ───────────────────

  it('network rejection (TypeError: Failed to fetch) renders "Backend unreachable"', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'))

    render(<HealthBadge onStatusChange={vi.fn()} />)

    await waitFor(() =>
      expect(
        screen.getByText(/Backend unreachable — is the API server running/),
      ).toBeInTheDocument(),
    )
  })

  // ─── Test 7: Re-check button disabled during checking, re-triggers on click ─

  it('Re-check button is disabled during checking and re-triggers fetch from failed state', async () => {
    const user = userEvent.setup()

    // First fetch: failed (auth_error)
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: false,
          code: 'auth_error',
          status: 401,
          hint: 'Authentication failed — check LLM_API_KEY in .env',
          latencyMs: 120,
        }),
        { status: 200 },
      ),
    )

    render(<HealthBadge onStatusChange={vi.fn()} />)

    // Wait for failed state so Re-check is enabled
    await waitFor(() =>
      expect(screen.getByText(/401 — Authentication failed/)).toBeInTheDocument(),
    )

    const recheckBtn = screen.getByRole('button', { name: /Re-check LLM connection/i })
    expect(recheckBtn).not.toBeDisabled()

    // Second fetch: use a controlled promise so we can observe the in-flight state.
    // This lets us assert the button is disabled (checking) before the fetch resolves.
    let resolveSecondFetch!: (r: Response) => void
    const secondFetchPromise = new Promise<Response>((resolve) => {
      resolveSecondFetch = resolve
    })
    vi.mocked(fetch).mockReturnValueOnce(secondFetchPromise)

    await user.click(recheckBtn)

    // After click but before second fetch resolves — badge is in checking state.
    // runCheck synchronously sets state to 'checking' before the fetch promise chain.
    await waitFor(() =>
      expect(screen.getByText(/Checking LLM connection/)).toBeInTheDocument(),
    )
    expect(recheckBtn).toBeDisabled()

    // Resolve the second fetch with an ok response
    resolveSecondFetch(
      new Response(JSON.stringify({ ok: true, latencyMs: 350 }), { status: 200 }),
    )

    // Wait for success state
    await waitFor(() =>
      expect(screen.getByText(/Connected — 350ms/)).toBeInTheDocument(),
    )

    // fetch should have been called exactly twice (initial + re-check)
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2)
  })

  // ─── Test 8: onStatusChange callback fires with 'checking' then 'ok' ──────

  it('onStatusChange fires with "checking" then "ok" on success', async () => {
    const onStatusChange = vi.fn()

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, latencyMs: 200 }), { status: 200 }),
    )

    render(<HealthBadge onStatusChange={onStatusChange} />)

    await waitFor(() => expect(onStatusChange).toHaveBeenCalledWith('ok'))

    // Should also have been called with 'checking' on mount
    expect(onStatusChange).toHaveBeenCalledWith('checking')
    expect(onStatusChange).toHaveBeenCalledWith('ok')
  })

  // ─── Test 9: onStatusChange fires with 'failed' on failure ───────────────

  it('onStatusChange fires with "failed" when backend returns ok:false', async () => {
    const onStatusChange = vi.fn()

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: false,
          code: 'rate_limited',
          status: 429,
          hint: 'Rate limited by LLM provider — retry in a moment',
          latencyMs: 50,
        }),
        { status: 200 },
      ),
    )

    render(<HealthBadge onStatusChange={onStatusChange} />)

    await waitFor(() => expect(onStatusChange).toHaveBeenCalledWith('failed'))
  })
})
