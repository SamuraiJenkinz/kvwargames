import { useGameStore } from '@/lib/gameStore'

export default function GuideTab() {
  const gameConfig = useGameStore((s) => s.gameConfig)

  const sections: Array<{ heading: string; body: string | undefined }> = [
    { heading: 'Objective',               body: gameConfig?.objective },
    { heading: 'Red Lines & PC Thresholds', body: [gameConfig?.redLines, gameConfig?.pcThresholds].filter(Boolean).join('\n\n') },
    { heading: 'Voting Rule',             body: gameConfig?.votingRule },
    { heading: 'Resource Tokens',         body: gameConfig?.resourceLogic },
    { heading: 'EO Response Mechanic',    body: gameConfig?.eoMechanic },
    { heading: 'Facilitator Input Guide', body: gameConfig?.facilitation },
  ]

  return (
    <div>
      {sections.map((s, i) => (
        <div key={s.heading} className={i > 0 ? 'mt-6 pt-6 border-t border-border-subtle' : ''}>
          <h3 className="font-display text-sm uppercase tracking-wide mb-2">{s.heading}</h3>
          <div className="text-xs text-text-muted whitespace-pre-wrap leading-relaxed">{s.body}</div>
        </div>
      ))}
    </div>
  )
}
