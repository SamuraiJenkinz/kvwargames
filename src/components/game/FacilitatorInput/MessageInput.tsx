import { useState, useRef, useEffect } from 'react'
import { Send } from 'lucide-react'
import { useGameStore } from '@/lib/gameStore'

interface MessageInputProps {
  disabled: boolean
  gameEnded: boolean
  registerInsert: (fn: (text: string) => void) => void
}

export default function MessageInput({ disabled, gameEnded, registerInsert }: MessageInputProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const sendFacilitatorMessage = useGameStore((s) => s.sendFacilitatorMessage)

  useEffect(() => {
    registerInsert((text: string) => {
      setValue((v) => {
        const ta = textareaRef.current
        if (!ta) return v + text
        const start = ta.selectionStart ?? v.length
        const end = ta.selectionEnd ?? v.length
        return v.slice(0, start) + text + v.slice(end)
      })
      // refocus after insert
      requestAnimationFrame(() => textareaRef.current?.focus())
    })
  }, [registerInsert])

  const submit = () => {
    const trimmed = value.trim()
    if (trimmed === '') return
    if (disabled) return
    if (gameEnded) return
    sendFacilitatorMessage(trimmed)
    setValue('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
    // Shift+Enter: default behaviour (newline) — do nothing
  }

  return (
    <div className="flex gap-2 items-end">
      <textarea
        ref={textareaRef}
        value={value}
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={1}
        placeholder="Type an event or instruction…"
        className="flex-1 resize-none bg-bg-elevated border border-border-default rounded-sm px-3 py-2 text-sm min-h-[40px] max-h-[120px] focus:outline-none focus:border-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
      />
      <button
        onClick={submit}
        disabled={disabled || gameEnded || value.trim() === ''}
        className="flex-none flex items-center gap-1 px-3 py-2 rounded-sm border border-border-default hover:bg-bg-elevated disabled:opacity-50 disabled:cursor-not-allowed text-sm font-mono uppercase"
      >
        <Send className="w-3 h-3" />
        Send
      </button>
    </div>
  )
}
