import { getPcBadge } from '@/lib/pcThresholds'

export default function PcBadge({ pc }: { pc: number }) {
  const state = getPcBadge(pc)
  if (state === null) return null

  if (state === 'CRISIS') {
    return (
      <span
        className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-crisis-security/20 text-crisis-security"
        style={{ animation: 'var(--animate-blink)' }}
      >
        CRISIS
      </span>
    )
  }

  // STRAINED — static amber
  return (
    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-persona-finch/20 text-persona-finch">
      STRAINED
    </span>
  )
}
