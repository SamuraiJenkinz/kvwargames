import type { ChatMessage, PersonaId } from '@/types/game'
import { PERSONA_META } from '@/lib/personaConfig'

interface Props {
  message: ChatMessage
}

export default function PersonaMessage({ message }: Props) {
  const meta = PERSONA_META[message.speaker as PersonaId]

  return (
    <div className="flex gap-3 items-start animate-[messageIn_180ms_ease-out_both] motion-reduce:animate-none">
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
        {/* Header row */}
        <div className="flex items-center gap-2 mb-1">
          <span className={['text-xs font-medium', meta.textClass].join(' ')}>
            {meta.displayName}
          </span>
          <span className="font-mono text-xs text-text-muted">
            {message.timestamp}
          </span>
        </div>

        {/* Bubble */}
        <div
          className={[
            'rounded-sm px-3 py-2 text-sm text-text-primary',
            meta.bubbleClass,
          ].join(' ')}
        >
          {message.text}
        </div>

        {/* Facilitator-facing flag note (REF-05) */}
        {message.flag && (
          <div className="text-xs text-persona-finch mt-1">{message.flag}</div>
        )}
      </div>
    </div>
  )
}
