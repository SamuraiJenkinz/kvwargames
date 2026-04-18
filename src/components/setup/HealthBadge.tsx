import { useEffect, useRef, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import type { HealthStatus, LLMHealthResponse } from '@/types/health'
import { formatLatency } from '@/lib/formatLatency'

interface HealthBadgeProps {
  onStatusChange: (status: HealthStatus) => void
}

/**
 * Self-contained inline badge that probes GET /api/health/llm on mount,
 * renders checking / ok / failed states, and exposes onStatusChange so the
 * parent (LoadConfigPanel) can gate the Launch button.
 *
 * Design decisions (CONTEXT.md):
 *   - One-shot auto-check on mount only; no re-check on config edits.
 *   - Manual Re-check button always rendered; disabled while checking.
 *   - No automatic retry on failure.
 *   - Backend hint is the single source of truth for user-facing copy.
 *   - No gameStore involvement — health is a transient setup-screen concern.
 */
export default function HealthBadge({ onStatusChange }: HealthBadgeProps) {
  const [state, setState] = useState<{ status: HealthStatus; text: string }>({
    status: 'checking',
    text: 'Checking LLM connection…',
  })
  const abortRef = useRef<AbortController | null>(null)

  function runCheck() {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setState({ status: 'checking', text: 'Checking LLM connection…' })
    onStatusChange('checking')

    fetch('/api/health/llm', { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          // Vite proxy 502 with HTML body when backend is down (RESEARCH.md Pitfall 2).
          // Do NOT call res.json() here — body is HTML and will SyntaxError.
          return { status: 'failed' as const, text: 'Backend unreachable — is the API server running?' }
        }
        const data = (await res.json()) as LLMHealthResponse
        if (data.ok) {
          return { status: 'ok' as const, text: `Connected — ${formatLatency(data.latencyMs)}` }
        }
        // RESEARCH.md Pitfall 4: data.status may be null for timeout/network/tls — fall back to code string.
        const displayCode = data.status != null ? String(data.status) : data.code
        return { status: 'failed' as const, text: `${displayCode} — ${data.hint}` }
      })
      .then((result) => {
        setState(result)
        onStatusChange(result.status)
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        // TypeError: Failed to fetch = backend unreachable at network layer.
        setState({ status: 'failed', text: 'Backend unreachable — is the API server running?' })
        onStatusChange('failed')
      })
  }

  // Auto-check on mount. Empty deps is intentional (CONTEXT.md: no re-check on
  // config edits). Cleanup aborts any in-flight request so React StrictMode's
  // double-mount in dev does not leave a stale pending promise updating state
  // (RESEARCH.md Pitfall 1).
  useEffect(() => {
    runCheck()
    return () => {
      abortRef.current?.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-3 flex items-center gap-3 rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)]/40 p-3"
    >
      {state.status === 'checking' && (
        <Loader2
          className="h-4 w-4 animate-spin text-[var(--color-text-secondary)]"
          aria-hidden="true"
        />
      )}
      {state.status === 'ok' && (
        <span
          className="h-2.5 w-2.5 rounded-full bg-[var(--color-crisis-none)]"
          aria-hidden="true"
        />
      )}
      {state.status === 'failed' && (
        <span
          className="h-2.5 w-2.5 rounded-full bg-[var(--color-category-crisis)]"
          aria-hidden="true"
        />
      )}
      <span
        className={
          state.status === 'failed'
            ? 'flex-1 text-sm text-[var(--color-category-crisis)]'
            : 'flex-1 text-sm text-[var(--color-text-primary)]'
        }
      >
        {state.text}
      </span>
      <button
        type="button"
        onClick={runCheck}
        disabled={state.status === 'checking'}
        aria-label="Re-check LLM connection"
        className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border-subtle)] px-2 py-1 text-xs text-[var(--color-text-secondary)] transition hover:text-[var(--color-text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        Re-check
      </button>
    </div>
  )
}
