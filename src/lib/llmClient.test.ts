import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { callLLMProxy, LLM_FRONTEND_TIMEOUT_MS } from './llmClient'
import type { HistoryEntry } from '@/types/llm'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Response whose .json() will throw (non-JSON body). */
function badBodyResponse(status = 200): Response {
  return new Response('not-json{{{', {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const SYS = 'the prompt'
const MSGS: HistoryEntry[] = [
  { role: 'user', content: 'hello' },
  { role: 'assistant', content: 'world' },
]

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// ─── Constant pin ─────────────────────────────────────────────────────────────

describe('LLM_FRONTEND_TIMEOUT_MS', () => {
  it('is pinned at 45000 (45 seconds)', () => {
    expect(LLM_FRONTEND_TIMEOUT_MS).toBe(45000)
  })
})

// ─── Happy path ───────────────────────────────────────────────────────────────

describe('callLLMProxy — success', () => {
  it('returns { ok: true, text } on 200 with text field', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ text: 'hello' }))
    const result = await callLLMProxy(SYS, MSGS)
    expect(result).toEqual({ ok: true, text: 'hello' })
  })

  it('maps 200 with missing text field to INTERNAL_ERROR', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({}))
    const result = await callLLMProxy(SYS, MSGS)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errorCode).toBe('INTERNAL_ERROR')
      expect(result.message).toMatch(/missing text/)
    }
  })

  it('maps 200 with non-JSON body to INTERNAL_ERROR', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(badBodyResponse(200))
    const result = await callLLMProxy(SYS, MSGS)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errorCode).toBe('INTERNAL_ERROR')
      expect(result.message).toMatch(/non-JSON/)
    }
  })
})

// ─── Backend error code mapping ───────────────────────────────────────────────

describe('callLLMProxy — backend error codes', () => {
  const backendCases: Array<{ status: number; code: string; message: string }> = [
    { status: 504, code: 'LLM_TIMEOUT', message: 'timed out' },
    { status: 401, code: 'LLM_AUTH_ERROR', message: 'bad key' },
    { status: 502, code: 'LLM_UPSTREAM_ERROR', message: 'upstream 500' },
    { status: 502, code: 'LLM_UNREACHABLE', message: 'cannot reach host' },
    { status: 500, code: 'INTERNAL_ERROR', message: 'something broke' },
  ]

  for (const { status, code, message } of backendCases) {
    it(`preserves ${code} from HTTP ${status} backend response`, async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        jsonResponse({ error: { code, message } }, status),
      )
      const result = await callLLMProxy(SYS, MSGS)
      expect(result).toEqual({ ok: false, errorCode: code, message })
    })
  }

  it('falls through to INTERNAL_ERROR for unknown backend code', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ error: { code: 'WEIRD_CODE', message: 'weird' } }, 500),
    )
    const result = await callLLMProxy(SYS, MSGS)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errorCode).toBe('INTERNAL_ERROR')
      expect(result.message).toBe('weird')
    }
  })

  it('uses HTTP status text when error.message is absent', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ error: { code: 'LLM_TIMEOUT' } }, 504),
    )
    const result = await callLLMProxy(SYS, MSGS)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errorCode).toBe('LLM_TIMEOUT')
      expect(result.message).toBe('HTTP 504')
    }
  })

  it('maps HTTP error with unparseable body to INTERNAL_ERROR', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(badBodyResponse(500))
    const result = await callLLMProxy(SYS, MSGS)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errorCode).toBe('INTERNAL_ERROR')
      expect(result.message).toMatch(/unparseable body/)
      expect(result.message).toMatch(/500/)
    }
  })
})

// ─── AbortController ──────────────────────────────────────────────────────────

describe('callLLMProxy — abort', () => {
  it('returns ABORTED when AbortController aborts mid-flight', async () => {
    vi.mocked(fetch).mockImplementation((_input, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('aborted', 'AbortError'))
        })
      })
    })

    const controller = new AbortController()
    const p = callLLMProxy(SYS, MSGS, { signal: controller.signal })
    controller.abort()
    const result = await p

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errorCode).toBe('ABORTED')
      expect(typeof result.message).toBe('string')
    }
  })
})

// ─── Network failure ──────────────────────────────────────────────────────────

describe('callLLMProxy — network failure', () => {
  it('maps TypeError: Failed to fetch to NETWORK_ERROR', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const result = await callLLMProxy(SYS, MSGS)
    expect(result).toEqual({
      ok: false,
      errorCode: 'NETWORK_ERROR',
      message: 'Failed to fetch',
    })
  })

  it('maps non-Error rejection to NETWORK_ERROR with fallback message', async () => {
    vi.mocked(fetch).mockRejectedValueOnce('string thrown')
    const result = await callLLMProxy(SYS, MSGS)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errorCode).toBe('NETWORK_ERROR')
      expect(result.message).toBe('Network error')
    }
  })
})

// ─── Request body shape ───────────────────────────────────────────────────────

describe('callLLMProxy — request body shape', () => {
  it('POSTs to /api/llm with correct headers and body (no maxTokens when absent)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ text: 'ok' }))
    await callLLMProxy(SYS, MSGS)

    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe('/api/llm')
    expect(init?.method).toBe('POST')
    expect((init?.headers as Record<string, string>)['Content-Type']).toBe(
      'application/json',
    )

    const parsed = JSON.parse(init?.body as string) as {
      systemPrompt: string
      messages: HistoryEntry[]
      maxTokens?: number
    }
    expect(parsed.systemPrompt).toBe('the prompt')
    expect(parsed.messages).toHaveLength(2)
    expect(parsed.messages[0]).toEqual({ role: 'user', content: 'hello' })
    expect('maxTokens' in parsed).toBe(false)
  })

  it('includes maxTokens in body when passed in options', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ text: 'ok' }))
    await callLLMProxy(SYS, MSGS, { maxTokens: 2048 })

    const [, init] = vi.mocked(fetch).mock.calls[0]
    const parsed = JSON.parse(init?.body as string) as { maxTokens?: number }
    expect(parsed.maxTokens).toBe(2048)
  })

  it('forwards the AbortSignal to fetch', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ text: 'ok' }))
    const controller = new AbortController()
    await callLLMProxy(SYS, MSGS, { signal: controller.signal })

    const [, init] = vi.mocked(fetch).mock.calls[0]
    expect(init?.signal).toBe(controller.signal)
  })
})

// ─── Never throws invariant ───────────────────────────────────────────────────

describe('callLLMProxy — never throws', () => {
  it('does not throw on any error path', async () => {
    const scenarios: Array<() => void> = [
      () => vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ text: 'ok' })),
      () => vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({}, 200)),
      () => vi.mocked(fetch).mockResolvedValueOnce(badBodyResponse(200)),
      () =>
        vi
          .mocked(fetch)
          .mockResolvedValueOnce(
            jsonResponse({ error: { code: 'LLM_TIMEOUT', message: 'x' } }, 504),
          ),
      () => vi.mocked(fetch).mockResolvedValueOnce(badBodyResponse(500)),
      () => vi.mocked(fetch).mockRejectedValueOnce(new TypeError('fail')),
      () => vi.mocked(fetch).mockRejectedValueOnce('weird'),
    ]

    for (const setup of scenarios) {
      setup()
      // Must resolve — never reject/throw
      await expect(callLLMProxy(SYS, MSGS)).resolves.toBeDefined()
    }
  })
})
