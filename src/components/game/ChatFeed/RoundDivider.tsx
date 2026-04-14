interface Props {
  label: string
}

export default function RoundDivider({ label }: Props) {
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 h-px bg-border-subtle" />
      <span className="font-mono text-xs uppercase tracking-wide text-text-muted">
        {label}
      </span>
      <div className="flex-1 h-px bg-border-subtle" />
    </div>
  )
}
