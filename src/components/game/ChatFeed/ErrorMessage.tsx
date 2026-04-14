import { AlertCircle } from 'lucide-react'
import type { ChatMessage } from '@/types/game'

interface Props {
  message: ChatMessage
}

export default function ErrorMessage({ message }: Props) {
  return (
    <div className="flex gap-2 items-start bg-crisis-security/10 border-l-2 border-crisis-security rounded-sm px-3 py-2 animate-[messageIn_180ms_ease-out_both] motion-reduce:animate-none">
      <AlertCircle className="w-4 h-4 text-crisis-security flex-none mt-0.5" />
      <div className="flex-1 text-sm text-crisis-security">{message.text}</div>
      <span className="font-mono text-xs text-crisis-security/70">
        {message.timestamp}
      </span>
    </div>
  )
}
