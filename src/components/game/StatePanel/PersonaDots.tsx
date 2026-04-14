import { useGameStore } from '@/lib/gameStore'
import { PERSONA_ORDER, PERSONA_META } from '@/lib/personaConfig'
import { getPersonasThisRound } from '@/lib/pcThresholds'

export default function PersonaDots() {
  const messages = useGameStore((s) => s.messages)
  const spoken = getPersonasThisRound(messages)

  return (
    <div className="flex gap-2 items-center">
      {PERSONA_ORDER.map((id) => {
        const meta = PERSONA_META[id]
        const lit = spoken.has(id)
        return (
          <div key={id} className="flex items-center gap-1">
            <div
              className={[
                'w-2 h-2 rounded-full transition-opacity duration-300',
                meta.dotClass,
                lit ? 'opacity-100' : 'opacity-25',
              ].join(' ')}
              data-testid={`persona-dot-${id}`}
              data-lit={lit}
            />
            <span
              className={[
                'text-[10px] font-mono uppercase',
                lit ? 'text-text-primary' : 'text-text-muted',
              ].join(' ')}
            >
              {meta.displayName}
            </span>
          </div>
        )
      })}
    </div>
  )
}
