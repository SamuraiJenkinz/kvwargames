import type { HistoryEntry, LLMCallResult, LLMClientErrorCode } from '@/types/llm'

/**
 * Frontend-side timeout for LLM calls. The store owns the AbortController and
 * decides when to abort based on this value; the client itself is time-agnostic.
 */
export const LLM_FRONTEND_TIMEOUT_MS = 45000

export interface LLMCallOptions {
  signal?: AbortSignal
  maxTokens?: number
}

/**
 * POSTs the system prompt + rolling message history to the backend LLM proxy
 * and returns a structured `LLMCallResult`. Never throws — every failure mode
 * (abort, network, HTTP error, malformed body) is surfaced through the
 * discriminated `ok: false` branch.
 *
 * The store creates a fresh AbortController per call and passes `signal` so
 * cancellation lifecycle stays with the caller (per RESEARCH.md).
 */
export async function callLLMProxy(
  systemPrompt: string,
  messages: HistoryEntry[],
  options: LLMCallOptions = {},
): Promise<LLMCallResult> {
  const body = {
    systemPrompt,
    messages,
    ...(options.maxTokens != null ? { maxTokens: options.maxTokens } : {}),
  }

  let response: Response
  try {
    response = await fetch('/api/llm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: options.signal,
    })
  } catch (err) {
    // AbortController path — DOMException 'AbortError'
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { ok: false, errorCode: 'ABORTED', message: 'LLM call cancelled' }
    }
    // Network failure (CORS, offline, DNS, TypeError: Failed to fetch)
    return {
      ok: false,
      errorCode: 'NETWORK_ERROR',
      message: err instanceof Error ? err.message : 'Network error',
    }
  }

  // Success (2xx) — extract text
  if (response.ok) {
    try {
      const data = (await response.json()) as { text?: string }
      if (typeof data.text !== 'string') {
        return {
          ok: false,
          errorCode: 'INTERNAL_ERROR',
          message: 'Backend response missing text field',
        }
      }
      return { ok: true, text: data.text }
    } catch {
      return {
        ok: false,
        errorCode: 'INTERNAL_ERROR',
        message: 'Backend returned non-JSON body',
      }
    }
  }

  // Non-2xx — map backend error shape { error: { code, message } }
  try {
    const errBody = (await response.json()) as {
      error?: { code?: string; message?: string }
    }
    const code = errBody.error?.code
    const message = errBody.error?.message ?? `HTTP ${response.status}`
    // Known codes pass through; unknown → INTERNAL_ERROR
    const known: LLMClientErrorCode[] = [
      'LLM_TIMEOUT',
      'LLM_AUTH_ERROR',
      'LLM_UPSTREAM_ERROR',
      'LLM_UNREACHABLE',
      'INTERNAL_ERROR',
    ]
    const errorCode: LLMClientErrorCode = (known as string[]).includes(code ?? '')
      ? (code as LLMClientErrorCode)
      : 'INTERNAL_ERROR'
    return { ok: false, errorCode, message }
  } catch {
    return {
      ok: false,
      errorCode: 'INTERNAL_ERROR',
      message: `HTTP ${response.status} with unparseable body`,
    }
  }
}
