import type { TeamState } from '@/types/game'
import PcBadge from './PcBadge'

type DeltaKey = 'pc' | 'po' | 'readiness' | 'stock' | 'crm' | 'ic'

const FIELDS: Array<{ key: DeltaKey; label: string; colorClass: string }> = [
  { key: 'pc', label: 'PC', colorClass: 'text-resource-pc' },
  { key: 'po', label: 'PO', colorClass: 'text-resource-po' },
  { key: 'readiness', label: 'RDY', colorClass: 'text-resource-readiness' },
  { key: 'stock', label: 'STK', colorClass: 'text-resource-stock' },
  { key: 'crm', label: 'CRM', colorClass: 'text-resource-crm' },
  { key: 'ic', label: 'IC', colorClass: 'text-resource-ic' },
]

/**
 * Favourability per resource field. All resources track "up is better" —
 * more PC, higher PO, more readiness/stock/crm/ic = favourable.
 */
const FAVOURABILITY: Record<DeltaKey, 'up' | 'down'> = {
  pc: 'up',
  po: 'up',
  readiness: 'up',
  stock: 'up',
  crm: 'up',
  ic: 'up',
}

/**
 * Tailwind v4 static class-scan anchors — literal strings required in source.
 * The ternary below uses these same literals so the scan picks them up.
 * DO NOT compose class names via template literals or dynamic key lookup.
 */
const _FAV_CLASS = 'text-track-readiness'
const _UNFAV_CLASS = 'text-crisis-security'
// Silence unused-var: these exist purely as Tailwind source-scan anchors.
void _FAV_CLASS
void _UNFAV_CLASS

export interface TeamCardProps {
  team: TeamState
  /** Per-field signed delta from the previous render. Zero / missing = no pulse, no ghost. */
  deltas?: Partial<Record<DeltaKey, number>>
}

export default function TeamCard({ team, deltas }: TeamCardProps) {
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

          const delta = deltas?.[f.key]
          const hasDelta = delta != null && delta !== 0
          const isFavourable =
            hasDelta &&
            ((FAVOURABILITY[f.key] === 'up' && delta > 0) ||
              (FAVOURABILITY[f.key] === 'down' && delta < 0))
          // Literal ternary — 'text-track-readiness' and 'text-crisis-security'
          // must appear verbatim for Tailwind v4 static scan.
          const deltaColorClass = isFavourable
            ? 'text-track-readiness'
            : 'text-crisis-security'
          const deltaText = hasDelta && delta > 0 ? `+${delta}` : `${delta}`
          const wrapperClasses = [
            'relative flex items-baseline justify-between px-1 rounded-sm',
            hasDelta ? 'animate-[cellPulse_800ms_ease-out_both]' : '',
          ]
            .filter(Boolean)
            .join(' ')

          return (
            <div
              key={f.key}
              data-testid={`teamcard-cell-${team.id}-${f.key}`}
              className={wrapperClasses}
            >
              <span className="text-[10px] text-text-muted font-mono uppercase">
                {f.label}
              </span>
              <span className={['text-sm font-medium font-mono', f.colorClass].join(' ')}>
                {formatted}
              </span>
              {hasDelta && (
                <span
                  data-testid={`teamcard-ghost-${team.id}-${f.key}`}
                  className={[
                    'absolute -top-2 right-0 text-[9px] font-mono font-medium pointer-events-none',
                    'animate-[ghostFade_2500ms_ease-out_both]',
                    deltaColorClass,
                  ].join(' ')}
                >
                  {deltaText}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
