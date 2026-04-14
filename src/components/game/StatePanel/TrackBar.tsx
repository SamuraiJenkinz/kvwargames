interface TrackBarProps {
  label: string
  value: number
  min: number
  max: number
  colorClass: string
  mode?: 'simple' | 'center-zero'
  /** Signed delta from previous render. When non-zero, a ghost label floats up and fades. */
  delta?: number
  /**
   * Favourability direction for the underlying field.
   * 'up' = higher is better (e.g. edipLegitimacy); 'down' = lower is better (e.g. crisisSeverity).
   */
  favourability?: 'up' | 'down'
}

export default function TrackBar({
  label,
  value,
  min,
  max,
  colorClass,
  mode = 'simple',
  delta,
  favourability = 'up',
}: TrackBarProps) {
  const formattedValue =
    mode === 'center-zero'
      ? value >= 0
        ? `+${value}`
        : `${value}`
      : `${value}`

  const magnitude = Math.abs(value)
  const halfSpan = (max - min) / 2 // e.g. 2 for legitimacy (-2 to +2)
  const widthPct = mode === 'center-zero' ? (magnitude / halfSpan) * 50 : 0
  const leftPct = mode === 'center-zero' ? (value >= 0 ? 50 : 50 - widthPct) : 0

  const simpleFillWidth = mode === 'simple' ? ((value - min) / (max - min)) * 100 : 0

  const showGhost = delta != null && delta !== 0
  const isFavourable =
    showGhost &&
    ((favourability === 'up' && delta > 0) || (favourability === 'down' && delta < 0))
  // Literal class strings required by Tailwind v4 static source scan — do not compose dynamically.
  const deltaColorClass = isFavourable ? 'text-track-readiness' : 'text-crisis-security'
  const deltaText = showGhost && delta > 0 ? `+${delta}` : `${delta}`
  // Stable key changes each time delta flips — forces animation restart on genuinely new deltas.
  const ghostKey = showGhost ? `${label}-${delta}-${value}` : undefined

  return (
    <div className="space-y-1">
      {/* Header row */}
      <div className="flex justify-between text-xs font-mono relative">
        <span className="text-text-muted uppercase">{label}</span>
        <span>{formattedValue}</span>
        {showGhost && (
          <span
            key={ghostKey}
            data-testid={`trackbar-ghost-${label.toLowerCase()}`}
            className={[
              'absolute right-0 -top-3 text-[10px] font-mono font-medium pointer-events-none',
              'animate-[ghostFade_2500ms_ease-out_both]',
              deltaColorClass,
            ].join(' ')}
          >
            {deltaText}
          </span>
        )}
      </div>

      {/* Bar shell */}
      <div className="w-full h-1.5 bg-bg-surface rounded-sm overflow-hidden relative">
        {mode === 'simple' && (
          <div
            className={[
              'h-full rounded-sm transition-[width] duration-300 ease-out',
              colorClass,
            ].join(' ')}
            style={{ width: `${simpleFillWidth}%` }}
          />
        )}

        {mode === 'center-zero' && (
          <>
            {/* Centre line */}
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border-default" />
            {/* Fill from centre */}
            <div
              className={[
                'absolute top-0 bottom-0 rounded-sm transition-all duration-300 ease-out',
                colorClass,
              ].join(' ')}
              style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
            />
          </>
        )}
      </div>
    </div>
  )
}
