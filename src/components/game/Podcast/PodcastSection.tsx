import { usePodcastStore } from '@/lib/podcastStore'
import GenerationPanel from './GenerationPanel'
import PodcastPlayer from './PodcastPlayer'

/**
 * Thin orchestrator — renders the appropriate podcast UI panel based on
 * podcastStore.status. Mounted in FacilitatorInput between ActionToolbar
 * and MessageInput, gated by {hasDebrief} in the parent.
 *
 * Status → Rendered output:
 * - 'idle'       → null (no panel shown)
 * - 'generating' → GenerationPanel (progress + cancel)
 * - 'error'      → GenerationPanel (error banner + dismiss)
 * - 'done'       → PodcastPlayer (audio + skip buttons + transcript)
 */
export default function PodcastSection() {
  const status = usePodcastStore((s) => s.status)
  const blobUrl = usePodcastStore((s) => s.blobUrl)

  if (status === 'idle') return null
  if (status === 'generating' || status === 'error') {
    return (
      <section
        data-testid="podcast-section"
        className="rounded-md border border-border-subtle bg-bg-panel/50 p-3 space-y-3"
      >
        <GenerationPanel />
      </section>
    )
  }
  if (status === 'done' && blobUrl) {
    return (
      <section
        data-testid="podcast-section"
        className="rounded-md border border-border-subtle bg-bg-panel/50 p-3 space-y-3"
      >
        <PodcastPlayer />
      </section>
    )
  }
  return null
}
