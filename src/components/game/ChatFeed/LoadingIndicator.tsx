import type { PersonaId } from '@/types/game'
import { PERSONA_META } from '@/lib/personaConfig'

interface Props {
  speaker: PersonaId
}

export default function LoadingIndicator({ speaker }: Props) {
  const meta = PERSONA_META[speaker]

  return (
    <div className="flex gap-3 items-start">
      {/* Avatar */}
      <div
        className={[
          'w-8 h-8 rounded-full flex items-center justify-center flex-none',
          meta.colorClass,
        ].join(' ')}
      >
        <span className="text-white text-xs font-medium">{meta.initials}</span>
      </div>

      {/* Right block */}
      <div className="flex-1 min-w-0">
        {/* Name row */}
        <div className="mb-1">
          <span className={['text-xs font-medium', meta.textClass].join(' ')}>
            {meta.displayName}
          </span>
        </div>

        {/* Animated dots bubble */}
        <div
          className={[
            'rounded-sm px-3 py-2 inline-flex gap-1.5 items-center',
            meta.bubbleClass,
          ].join(' ')}
        >
          <span
            className="w-1.5 h-1.5 rounded-full bg-text-muted"
            style={{ animation: 'var(--animate-blink)', animationDelay: '0ms' }}
          />
          <span
            className="w-1.5 h-1.5 rounded-full bg-text-muted"
            style={{ animation: 'var(--animate-blink)', animationDelay: '200ms' }}
          />
          <span
            className="w-1.5 h-1.5 rounded-full bg-text-muted"
            style={{ animation: 'var(--animate-blink)', animationDelay: '400ms' }}
          />
        </div>
      </div>
    </div>
  )
}
