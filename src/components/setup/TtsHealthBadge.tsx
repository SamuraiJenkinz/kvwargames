import { useEffect, useRef, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import type { HealthStatus, TTSHealthResponse } from '@/types/health'
import { formatLatency } from '@/lib/formatLatency'

interface TtsHealthBadgeProps {
  onStatusChange: (status: HealthStatus) => void
}

/**
 * Self-contained inline badge that probes GET /api/health/tts on mount,
 * renders checking / ok / failed states, and exposes onStatusChange.
 *
 * Design decisions (CONTEXT.md / RESEARCH.md Phase 15):
 *   - Informational-only — does NOT gate Launch (PODRES-02 invariant).
 *   - Failed-state dot is AMBER (--color-crisis-supply), not red.
 *   - Failed-state text is text-amber-400, not --color-category-crisis.
 *   - Re-check button fetches /api/health/tts?force=true (cache bypass).
 *   - Auto-check on mount fetches /api/health/tts (no force param).
 *   - title attribute surfaces backend hint on hover in the failed state.
 *   - No automatic retry on failure; one-shot auto-check on mount.
 *   - Cleanup aborts any in-flight request so React StrictMode's
 *     double-mount in dev does not leave a stale pending promise updating state
 *     (RESEARCH.md Pitfall 1).
 *
 * Locked copy strings (no variation allowed):
 *   - checking:  'Checking TTS connection…'
 *   - ok:        'TTS connected — {formatLatency(latencyMs)}'
 *   - failed:    '[{code}] Podcast generation unavailable — markdown debrief will still work.'
 *   - unreachable: 'Backend unreachable — is the API server running?'
 */
export default function TtsHealthBadge({ onStatusChange }: TtsHealthBadgeProps) {
  const [state, setState] = useState<{ status: HealthStatus; text: string; hint?: string }>({
    status: 'checking',
    text: 'Checking TTS connection…',
  })
  const abortRef = useRef<AbortController | null>(null)

  function runCheck(force: boolean = false) {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setState({ status: 'checking', text: 'Checking TTS connection…' })
    onStatusChange('checking')

    const url = force ? '/api/health/tts?force=true' : '/api/health/tts'

    fetch(url, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          // Vite proxy 502 with HTML body when backend is down (RESEARCH.md Pitfall 2).
          // Do NOT call res.json() here — body is HTML and will SyntaxError.
          return {
            status: 'failed' as const,
            text: 'Backend unreachable — is the API server running?',
            hint: undefined,
          }
        }
        const data = (await res.json()) as TTSHealthResponse
        if (data.ok) {
          return {
            status: 'ok' as const,
            text: `TTS connected — ${formatLatency(data.latencyMs)}`,
            hint: undefined,
          }
        }
        // Failed state — locked copy with [code] prefix + amber styling.
        return {
          status: 'failed' as const,
          text: `[${data.code}] Podcast generation unavailable — markdown debrief will still work.`,
          hint: data.hint,
        }
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

  // Auto-check on mount. Empty deps is intentional (no re-check on config edits).
  // Cleanup aborts any in-flight request so React StrictMode double-mount in dev
  // does not leave a stale pending promise updating state.
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
      title={state.hint ?? undefined}
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
          className="h-2.5 w-2.5 rounded-full bg-[var(--color-crisis-supply)]"
          aria-hidden="true"
        />
      )}
      <span
        className={
          state.status === 'failed'
            ? 'flex-1 text-sm text-amber-400'
            : 'flex-1 text-sm text-[var(--color-text-primary)]'
        }
      >
        {state.text}
      </span>
      <button
        type="button"
        onClick={() => runCheck(true)}
        disabled={state.status === 'checking'}
        aria-label="Re-check TTS connection"
        className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border-subtle)] px-2 py-1 text-xs text-[var(--color-text-secondary)] transition hover:text-[var(--color-text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        Re-check
      </button>
    </div>
  )
}
