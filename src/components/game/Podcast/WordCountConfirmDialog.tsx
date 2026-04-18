import ConfirmDialog from './ConfirmDialog'

interface Props {
  open: boolean
  audioMinutes: number
  generationSeconds: number
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Confirmation dialog shown when the combined debrief word count exceeds
 * WORD_COUNT_SOFT_CEILING. Displays exactly two numbers: estimated audio
 * length (minutes) and estimated generation time (seconds).
 */
export default function WordCountConfirmDialog({
  open,
  audioMinutes,
  generationSeconds,
  onConfirm,
  onCancel,
}: Props) {
  const minuteLabel = audioMinutes === 1 ? 'minute' : 'minutes'

  const body = (
    <p>
      This session is long. Podcast will be about{' '}
      <strong className="text-text-primary">{audioMinutes}</strong> {minuteLabel} and take about{' '}
      <strong className="text-text-primary">{generationSeconds}</strong> seconds to generate.
    </p>
  )

  return (
    <ConfirmDialog
      open={open}
      title="Generate Podcast"
      body={body}
      primaryLabel="Generate"
      onPrimary={onConfirm}
      onSecondary={onCancel}
    />
  )
}
