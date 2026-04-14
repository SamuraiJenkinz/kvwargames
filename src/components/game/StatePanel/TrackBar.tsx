interface TrackBarProps {
  label: string
  value: number
  min: number
  max: number
  colorClass: string
  mode?: 'simple' | 'center-zero'
}

export default function TrackBar({
  label,
  value,
  min,
  max,
  colorClass,
  mode = 'simple',
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

  return (
    <div className="space-y-1">
      {/* Header row */}
      <div className="flex justify-between text-xs font-mono">
        <span className="text-text-muted uppercase">{label}</span>
        <span>{formattedValue}</span>
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
