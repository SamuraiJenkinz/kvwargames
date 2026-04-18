import { useEffect } from 'react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  body: React.ReactNode
  primaryLabel: string
  secondaryLabel?: string
  onPrimary: () => void
  onSecondary: () => void
}

/**
 * Shared modal primitive for podcast confirm dialogs.
 * Uses a plain div overlay (not <dialog>) — jsdom support for <dialog> is
 * patchy and the native showModal() lifecycle is not relevant here.
 */
export default function ConfirmDialog({
  open,
  title,
  body,
  primaryLabel,
  secondaryLabel = 'Cancel',
  onPrimary,
  onSecondary,
}: ConfirmDialogProps) {
  // Escape key dismisses (secondary action)
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSecondary()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onSecondary])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onSecondary}
    >
      {/* Inner card — stop propagation so clicks inside don't close the dialog */}
      <div
        className="bg-bg-panel border border-border-default rounded-md p-6 max-w-md mx-4 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-medium text-text-primary">{title}</h2>
        <div className="text-sm text-text-secondary">{body}</div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onSecondary}
            className="text-xs font-mono uppercase px-2 py-1 rounded-sm border border-border-default hover:bg-bg-elevated"
          >
            {secondaryLabel}
          </button>
          <button
            type="button"
            onClick={onPrimary}
            className="px-3 py-1.5 rounded-md text-sm font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-colors"
          >
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
