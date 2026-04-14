interface Props {
  label?: string
}

export default function DebriefDivider({ label }: Props) {
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 h-px bg-persona-finch/40" />
      <span className="font-mono text-xs uppercase tracking-wider text-persona-finch font-medium">
        {label || 'DEBRIEF'}
      </span>
      <div className="flex-1 h-px bg-persona-finch/40" />
    </div>
  )
}
