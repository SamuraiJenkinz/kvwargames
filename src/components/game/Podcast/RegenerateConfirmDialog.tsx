import ConfirmDialog from './ConfirmDialog'

interface Props {
  open: boolean
  generationSeconds: number
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Confirmation dialog shown before cache-busting regeneration.
 * Warns the user that current audio will be replaced.
 */
export default function RegenerateConfirmDialog({
  open,
  generationSeconds,
  onConfirm,
  onCancel,
}: Props) {
  const body = (
    <p>
      Re-generate podcast? The current audio will be replaced. Takes about{' '}
      <strong className="text-text-primary">{generationSeconds}</strong> seconds.
    </p>
  )

  return (
    <ConfirmDialog
      open={open}
      title="Re-generate Podcast"
      body={body}
      primaryLabel="Re-generate"
      onPrimary={onConfirm}
      onSecondary={onCancel}
    />
  )
}
