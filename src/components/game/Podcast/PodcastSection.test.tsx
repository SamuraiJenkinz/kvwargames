import { beforeEach, describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// ─── Mock child components — test only the gating logic ──────────────────────
vi.mock('./GenerationPanel', () => ({
  default: () => <div data-testid="generation-panel" />,
}))
vi.mock('./PodcastPlayer', () => ({
  default: () => <div data-testid="podcast-player" />,
}))

// ─── Mock podcast store ───────────────────────────────────────────────────────
const podState = {
  status: 'idle' as string,
  blobUrl: null as string | null,
}

vi.mock('@/lib/podcastStore', () => ({
  usePodcastStore: (selector: (s: typeof podState) => unknown) => selector(podState),
}))

import PodcastSection from './PodcastSection'

function setPodState(overrides: Partial<typeof podState>) {
  Object.assign(podState, { status: 'idle', blobUrl: null, ...overrides })
}

beforeEach(() => {
  setPodState({})
})

describe('PodcastSection', () => {
  // 1. Returns null when status === 'idle'
  it('returns null when status === idle', () => {
    setPodState({ status: 'idle' })
    const { container } = render(<PodcastSection />)
    expect(container.firstChild).toBeNull()
  })

  // 2. Renders GenerationPanel when status === 'generating'
  it('renders GenerationPanel when status === generating', () => {
    setPodState({ status: 'generating' })
    render(<PodcastSection />)
    expect(screen.getByTestId('generation-panel')).toBeInTheDocument()
    expect(screen.queryByTestId('podcast-player')).toBeNull()
  })

  // 3. Renders GenerationPanel (error banner path) when status === 'error'
  it('renders GenerationPanel when status === error', () => {
    setPodState({ status: 'error' })
    render(<PodcastSection />)
    expect(screen.getByTestId('generation-panel')).toBeInTheDocument()
    expect(screen.queryByTestId('podcast-player')).toBeNull()
  })

  // 4. Renders PodcastPlayer when status === 'done' AND blobUrl is set
  it('renders PodcastPlayer when status === done and blobUrl is set', () => {
    setPodState({ status: 'done', blobUrl: 'blob:mock-1' })
    render(<PodcastSection />)
    expect(screen.getByTestId('podcast-player')).toBeInTheDocument()
    expect(screen.queryByTestId('generation-panel')).toBeNull()
  })

  // 5. Returns null when status === 'done' but blobUrl is null (defensive)
  it('returns null when status === done but blobUrl is null', () => {
    setPodState({ status: 'done', blobUrl: null })
    const { container } = render(<PodcastSection />)
    expect(container.firstChild).toBeNull()
  })
})
