import { useGameStore } from '@/lib/gameStore'

/**
 * Non-blocking confirmation banner surfaced when the LLM signals
 * `control.advanceRound` or `control.triggerDebrief` in its response.
 *
 * - Returns null when there is no pending banner, so it takes zero layout
 *   space in the idle case (FacilitatorInput mounts it unconditionally).
 * - [Advance] / [Enter Debrief] dispatches `confirmControlBanner()` (clears
 *   banner first, then calls advanceRound / triggerDebrief).
 * - [Dismiss] clears without re-triggering. Facilitator can manually advance
 *   later via the toolbar if they change their mind.
 *
 * Conflict resolution (both flags true in one LLM response) is handled in
 * the store: triggerDebrief wins, so this banner only ever has one kind at
 * a time.
 */
export default function ControlBanner() {
  const banner = useGameStore((s) => s.pendingControlBanner)
  const confirm = useGameStore((s) => s.confirmControlBanner)
  const dismiss = useGameStore((s) => s.dismissControlBanner)

  if (!banner) return null

  const label =
    banner.kind === 'advanceRound'
      ? `Advance to Round ${banner.targetRound}?`
      : 'Enter debrief?'
  const confirmLabel = banner.kind === 'advanceRound' ? 'Advance' : 'Enter Debrief'

  return (
    <div
      data-testid="control-banner"
      data-kind={banner.kind}
      className="flex items-center gap-2 rounded-sm border border-persona-finch/40 bg-persona-finch/10 px-3 py-2 text-xs text-persona-finch"
    >
      <span className="font-mono uppercase">{label}</span>
      <button
        onClick={() => confirm()}
        className="ml-auto font-mono uppercase rounded-sm border border-persona-finch/40 px-2 py-1 hover:bg-persona-finch/20"
      >
        {confirmLabel}
      </button>
      <button
        onClick={() => dismiss()}
        className="font-mono uppercase rounded-sm border border-border-default px-2 py-1 text-text-muted hover:bg-bg-elevated"
      >
        Dismiss
      </button>
    </div>
  )
}
