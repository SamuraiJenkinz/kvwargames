import type { TeamState } from '@/types/game'
import PcBadge from './PcBadge'

const FIELDS: Array<{ key: keyof TeamState; label: string; colorClass: string }> = [
  { key: 'pc', label: 'PC', colorClass: 'text-resource-pc' },
  { key: 'po', label: 'PO', colorClass: 'text-resource-po' },
  { key: 'readiness', label: 'RDY', colorClass: 'text-resource-readiness' },
  { key: 'stock', label: 'STK', colorClass: 'text-resource-stock' },
  { key: 'crm', label: 'CRM', colorClass: 'text-resource-crm' },
  { key: 'ic', label: 'IC', colorClass: 'text-resource-ic' },
]

type DeltaKey = 'pc' | 'po' | 'readiness' | 'stock' | 'crm' | 'ic'

export interface TeamCardProps {
  team: TeamState
  /** Per-field signed delta from the previous render. Zero / missing = no pulse, no ghost. */
  deltas?: Partial<Record<DeltaKey, number>>
}

export default function TeamCard({ team, deltas }: TeamCardProps) {
  // deltas reserved for Task 2 visualisation; reference to silence unused warnings.
  void deltas
  const short = `Team ${team.id}`

  return (
    <div className="bg-bg-surface border border-border-subtle rounded-sm p-2">
      {/* Header: short name + PC badge */}
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-xs uppercase tracking-wide">{short}</span>
        <PcBadge pc={team.pc} />
      </div>

      {/* Resource grid: 2-column × 3-row */}
      <div className="grid grid-cols-2 gap-x-2 gap-y-1">
        {FIELDS.map((f) => {
          const val = team[f.key] as number
          // PO is signed (-2 to +2); display with explicit sign
          const formatted =
            f.key === 'po' ? (val >= 0 ? `+${val}` : `${val}`) : `${val}`
          return (
            <div key={f.key} className="flex items-baseline justify-between">
              <span className="text-[10px] text-text-muted font-mono uppercase">
                {f.label}
              </span>
              <span className={['text-sm font-medium font-mono', f.colorClass].join(' ')}>
                {formatted}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
