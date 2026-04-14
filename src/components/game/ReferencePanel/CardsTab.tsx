import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useGameStore } from '@/lib/gameStore'
import { catChipClass } from './categoryColors'

export default function CardsTab() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Use the full gameConfig so the selector returns a stable reference
  const gameConfig = useGameStore((s) => s.gameConfig)
  const cards = gameConfig?.cards ?? []

  // Detail view
  if (selectedId !== null) {
    const card = cards.find((c) => c.id === selectedId)

    // If card no longer exists (e.g. config changed), render fallback without calling
    // setSelectedId in the render path — that would cause an infinite update loop.
    if (!card) {
      return (
        <div className="text-xs text-text-muted p-2">
          <button
            onClick={() => setSelectedId(null)}
            className="flex items-center gap-1 hover:text-text-primary"
          >
            <ArrowLeft className="w-3 h-3" />
            Back
          </button>
        </div>
      )
    }

    return (
      <div className="space-y-3">
        <button
          onClick={() => setSelectedId(null)}
          className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary"
        >
          <ArrowLeft className="w-3 h-3" />
          Back
        </button>

        <div>
          <h3 className="font-display text-sm uppercase tracking-wide">{card.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className={`inline-block w-2 h-2 rounded-sm flex-none ${catChipClass(card.cat)}`} />
            <span className="text-xs text-text-muted">{card.cat}</span>
          </div>
          <span className="font-mono text-xs text-text-muted block mt-1">{card.id}</span>
        </div>

        <div>
          <p className="text-xs text-text-muted uppercase tracking-wide mb-1">Timing</p>
          <p className="text-sm">{card.timing}</p>
        </div>

        <div>
          <p className="text-xs text-text-muted uppercase tracking-wide mb-1">Req</p>
          <p className="text-sm">{card.req}</p>
        </div>

        <div>
          <p className="text-xs text-text-muted uppercase tracking-wide mb-1">Effect</p>
          <p className="text-sm">{card.effect}</p>
        </div>
      </div>
    )
  }

  // First sentence of effect as blurb
  const firstSentence = (text: string) => {
    const match = text.match(/^[^.!?]+[.!?]/)
    return match ? match[0] : text.slice(0, 80)
  }

  // List view
  return (
    <ul className="space-y-1">
      {cards.map((card) => (
        <li key={card.id}>
          <button
            className="w-full text-left flex gap-2 items-start py-2 px-2 rounded-sm hover:bg-bg-elevated"
            onClick={() => setSelectedId(card.id)}
          >
            <span className={`w-1 self-stretch rounded-sm flex-none ${catChipClass(card.cat)}`} />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{card.name}</p>
              <p className="text-xs text-text-muted line-clamp-1">{firstSentence(card.effect)}</p>
            </div>
          </button>
        </li>
      ))}
    </ul>
  )
}
