import { Check } from 'lucide-react'
import { usePodcastStore } from '@/lib/podcastStore'
import { PERSONA_META } from '@/lib/personaConfig'
import type { PersonaKey, PersonaProgressState } from '@/lib/podcastStore'

const PERSONA_ORDER: PersonaKey[] = ['kent', 'finch', 'chen']

interface PersonaStatusRowProps {
  personaKey: PersonaKey
  state: PersonaProgressState
}

function PersonaStatusRow({ personaKey, state }: PersonaStatusRowProps) {
  const meta = PERSONA_META[personaKey]

  return (
    <div className="flex items-center gap-2 py-0.5">
      {/* State indicator */}
      <div className="w-4 flex items-center justify-center flex-none">
        {state === 'done' && (
          <Check size={14} className="text-green-400" />
        )}
        {state === 'rendering' && (
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        )}
        {state === 'waiting' && (
          <span className="text-text-muted text-xs">—</span>
        )}
      </div>

      {/* Persona name */}
      <span
        className={[
          'text-sm',
          state === 'waiting' ? 'text-text-muted' : '',
          state === 'rendering' ? [meta.textClass, 'font-medium'].join(' ') : '',
          state === 'done' ? 'text-text-secondary' : '',
        ].join(' ')}
      >
        {meta.displayName}
      </span>

      {/* State label */}
      <span className="text-xs text-text-muted ml-auto">
        {state === 'rendering' && 'rendering…'}
        {state === 'waiting' && 'waiting'}
        {state === 'done' && 'done'}
      </span>
    </div>
  )
}

/**
 * Generation progress panel — shown when podcastStore.status is 'generating'
 * or 'error'. Renders per-persona status rows, a discrete progress bar
 * (0 → 33 → 66 → 100%), and either a Cancel button or an error banner.
 */
export default function GenerationPanel() {
  const status = usePodcastStore((s) => s.status)
  const personaProgress = usePodcastStore((s) => s.personaProgress)
  const error = usePodcastStore((s) => s.error)
  const cancel = usePodcastStore((s) => s.cancel)
  const reset = usePodcastStore((s) => s.reset)

  // Discrete progress: count how many personas are 'done'
  const doneCount = PERSONA_ORDER.filter((p) => personaProgress[p] === 'done').length
  const pct = Math.round((doneCount / PERSONA_ORDER.length) * 100)

  return (
    <div className="space-y-3">
      {/* Per-persona status rows */}
      <div className="space-y-1">
        {PERSONA_ORDER.map((key) => (
          <PersonaStatusRow key={key} personaKey={key} state={personaProgress[key]} />
        ))}
      </div>

      {/* Discrete progress bar */}
      <div className="h-1.5 bg-bg-elevated rounded overflow-hidden">
        <div
          style={{ width: `${pct}%`, transition: 'width 300ms ease' }}
          className="h-full bg-amber-400 rounded"
        />
      </div>

      {/* Cancel button (generating state) */}
      {status === 'generating' && (
        <button
          type="button"
          onClick={cancel}
          className="text-xs font-mono uppercase px-2 py-1 rounded-sm border border-border-default hover:bg-bg-elevated"
        >
          Cancel
        </button>
      )}

      {/* Error banner (error state) */}
      {status === 'error' && error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 space-y-2">
          <p className="text-sm text-red-400">
            <span className="font-mono text-xs">[{error.code}]</span>{' '}
            {error.message}
          </p>
          <button
            type="button"
            onClick={reset}
            className="text-xs font-mono uppercase px-2 py-1 rounded-sm border border-border-default hover:bg-bg-elevated"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  )
}
