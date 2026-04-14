import { useRef, useState, useEffect } from 'react'
import { useGameStore } from '@/lib/gameStore'

type GenStatus = 'idle' | 'loading' | 'error'
type ErrorKind =
  | 'LLM_TIMEOUT'
  | 'LLM_AUTH_ERROR'
  | 'LLM_UPSTREAM_ERROR'
  | 'LLM_UNREACHABLE'
  | 'INTERNAL_ERROR'
  | 'PARSE_FAILURE'
  | 'NETWORK_ERROR'

const ERROR_COPY: Record<ErrorKind, string> = {
  LLM_TIMEOUT: 'Generation timed out. Try again or shorten your brief.',
  LLM_AUTH_ERROR: 'Backend credentials issue. Contact the facilitator admin.',
  LLM_UPSTREAM_ERROR: 'LLM service returned an error. Try again.',
  LLM_UNREACHABLE: "Can't reach the LLM service. Check your connection.",
  INTERNAL_ERROR: 'Unexpected error. Try again; if it persists, check backend logs.',
  PARSE_FAILURE:
    "Generated config wasn't valid JSON — try simplifying your brief or clicking Generate again.",
  NETWORK_ERROR: 'Network error. Check your connection and try again.',
}

const EXAMPLE_CHIPS: Array<{ label: string; prompt: string }> = [
  {
    label: 'Energy supply crisis',
    prompt:
      'A 4-round European energy security tabletop. Four teams: EU Commission, Germany, France, a strategic reserve agency. Trigger event: a pipeline sabotage reduces winter gas capacity by 35%.',
  },
  {
    label: 'Cyber incident response',
    prompt:
      'A 3-round cyber tabletop. Four teams: national CERT, affected utility, regulator, and a private incident-response vendor. Inject: ransomware on a regional electricity grid operator.',
  },
]

const MIN_CHARS = 50
const MAX_CHARS = 4000

const KNOWN_ERROR_CODES: ErrorKind[] = [
  'LLM_TIMEOUT',
  'LLM_AUTH_ERROR',
  'LLM_UPSTREAM_ERROR',
  'LLM_UNREACHABLE',
  'INTERNAL_ERROR',
]

export default function GenerateBriefPanel() {
  const briefText = useGameStore((s) => s.briefText) // PRE-EXISTING store field (Phase 4)
  const setBriefText = useGameStore((s) => s.setBriefText) // PRE-EXISTING store setter (Phase 4)
  const setConfigJson = useGameStore((s) => s.setConfigJson)
  const setDraftSource = useGameStore((s) => s.setDraftSource) // NEW in Task 2a
  const setSetupMode = useGameStore((s) => s.setSetupMode)

  const [status, setStatus] = useState<GenStatus>('idle')
  const [errorKind, setErrorKind] = useState<ErrorKind | null>(null)

  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    // Abort any in-flight request on unmount
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const canGenerate = briefText.trim().length >= MIN_CHARS && status !== 'loading'
  const charCount = briefText.length

  async function handleGenerate() {
    setStatus('loading')
    setErrorKind(null)
    abortRef.current = new AbortController()
    try {
      const res = await fetch('/api/generate-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief: briefText }),
        signal: abortRef.current.signal,
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => null)
        const code = (payload?.error?.code as string | undefined) ?? 'INTERNAL_ERROR'
        const errorCode: ErrorKind = (KNOWN_ERROR_CODES as string[]).includes(code)
          ? (code as ErrorKind)
          : 'INTERNAL_ERROR'
        setErrorKind(errorCode)
        setStatus('error')
        return
      }
      const data = await res.json()
      const rawText: string = data.text
      // Attempt to parse the returned text to validate JSON syntax.
      let parsed: unknown
      try {
        parsed = JSON.parse(rawText)
      } catch {
        console.error('[GenerateBriefPanel] parse failure:', rawText)
        setErrorKind('PARSE_FAILURE')
        setStatus('error')
        return
      }
      // Happy path: write to store, transition to load mode. Schema validation
      // is plan 07-04's responsibility — LoadConfigPanel will surface field errors.
      const prettyJson = JSON.stringify(parsed, null, 2)
      setConfigJson(prettyJson)
      setDraftSource('brief')
      setSetupMode('load')
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        // User cancelled — reset to idle, preserve brief
        setStatus('idle')
        return
      }
      setErrorKind('NETWORK_ERROR')
      setStatus('error')
    }
  }

  function handleCancel() {
    abortRef.current?.abort()
  }

  function handleBack() {
    abortRef.current?.abort()
    setSetupMode('home')
  }

  function handleChipClick(prompt: string) {
    setBriefText(prompt)
  }

  return (
    <div className="p-8 max-w-3xl mx-auto text-text-primary">
      <button
        type="button"
        onClick={handleBack}
        className="text-sm text-text-secondary hover:text-text-primary mb-4"
      >
        ← Back
      </button>
      <h2 className="text-2xl font-display font-semibold mb-2">Generate config from brief</h2>
      <p className="text-sm text-text-secondary mb-6">
        Describe your scenario in plain English. The engine will produce a complete game
        configuration you can review and launch.
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        {EXAMPLE_CHIPS.map((chip) => (
          <button
            key={chip.label}
            type="button"
            onClick={() => handleChipClick(chip.prompt)}
            disabled={status === 'loading'}
            className="px-3 py-1 rounded-full text-xs bg-bg-surface text-text-secondary hover:bg-bg-elevated hover:text-text-primary border border-border-dim disabled:opacity-50"
          >
            {chip.label}
          </button>
        ))}
      </div>

      {status === 'error' && errorKind && (
        <div
          role="alert"
          className="mb-4 p-3 rounded-md bg-[var(--color-category-crisis)]/10 text-[var(--color-category-crisis)] border border-[var(--color-category-crisis)]/30 text-sm"
        >
          {ERROR_COPY[errorKind]}
        </div>
      )}

      <textarea
        value={briefText}
        onChange={(e) => setBriefText(e.target.value.slice(0, MAX_CHARS))}
        placeholder="Three-round energy crisis tabletop: EU Commission, Russia, Ukraine, US State Dept..."
        rows={8}
        disabled={status === 'loading'}
        className="w-full p-3 rounded-md bg-bg-surface border border-border-dim text-text-primary placeholder:text-text-secondary font-mono text-sm resize-y disabled:opacity-70"
      />
      <div className="flex items-center justify-between mt-2 mb-6">
        <span className="text-xs text-text-secondary">
          {charCount} / {MAX_CHARS} (min {MIN_CHARS})
        </span>
      </div>

      <div className="flex items-center gap-3">
        {status !== 'loading' ? (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="px-4 py-2 rounded-md bg-persona-kent text-white font-medium hover:bg-[var(--color-persona-kent)]/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Generate
          </button>
        ) : (
          <>
            <div
              className="flex items-center gap-2 text-sm text-text-secondary"
              role="status"
            >
              <span
                className="inline-block w-3 h-3 rounded-full bg-persona-kent animate-blink"
                aria-hidden="true"
              />
              <span>Generating config… this usually takes 15–30 seconds</span>
            </div>
            <button
              type="button"
              onClick={handleCancel}
              className="px-3 py-1.5 rounded-md text-sm bg-bg-surface text-text-secondary hover:text-text-primary border border-border-dim"
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  )
}
