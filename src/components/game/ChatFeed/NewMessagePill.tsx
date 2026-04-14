import { ChevronDown } from 'lucide-react'

interface Props {
  onClick: () => void
}

export default function NewMessagePill({ onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-bg-elevated border border-border-default rounded-full px-3 py-1.5 text-xs font-mono flex items-center gap-1 hover:bg-bg-surface shadow-lg"
    >
      <ChevronDown className="w-3 h-3" />
      New message
    </button>
  )
}
