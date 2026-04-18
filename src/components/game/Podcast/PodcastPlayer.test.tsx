import { beforeEach, describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { usePodcastStore } from '@/lib/podcastStore'
import type { PersonaKey } from '@/lib/podcastStore'

// ─── Mock podcasStore ─────────────────────────────────────────────────────────
const { mockSetActivePersona } = vi.hoisted(() => ({
  mockSetActivePersona: vi.fn(),
}))

// Mutable pod store state — tests modify this
const podState = {
  status: 'done' as string,
  blobUrl: 'blob:mock-1' as string | null,
  offsets: [0, 5, 10] as [number, number, number] | null,
  activePersona: 'kent' as PersonaKey,
  setActivePersona: mockSetActivePersona,
}

vi.mock('@/lib/podcastStore', () => ({
  usePodcastStore: (selector: (s: typeof podState) => unknown) => selector(podState),
}))

// Mock TranscriptPanel to avoid pulling in full game store dependencies
vi.mock('./TranscriptPanel', () => ({
  default: () => <div data-testid="transcript-panel" />,
}))

import PodcastPlayer from './PodcastPlayer'
import { PERSONA_META } from '@/lib/personaConfig'

// Reset podcast state before each test
function setPodState(overrides: Partial<typeof podState> = {}) {
  Object.assign(podState, {
    status: 'done',
    blobUrl: 'blob:mock-1',
    offsets: [0, 5, 10],
    activePersona: 'kent',
    setActivePersona: mockSetActivePersona,
    ...overrides,
  })
}

beforeEach(() => {
  setPodState()
  mockSetActivePersona.mockClear()
})

describe('PodcastPlayer', () => {
  // 1. Renders audio element with blob URL set imperatively
  it('renders audio element and sets src imperatively to blobUrl', () => {
    render(<PodcastPlayer />)
    const audio = document.querySelector('audio')
    expect(audio).toBeTruthy()
    // After useEffect runs, src is set imperatively — jsdom stores it with origin prefix
    // but must include the blob URL path
    expect(audio?.src).toContain('blob:mock-1')
  })

  // 2. Audio element has controls attribute
  it('audio element has controls attribute', () => {
    render(<PodcastPlayer />)
    const audio = document.querySelector('audio')
    expect(audio).toBeTruthy()
    expect(audio?.hasAttribute('controls')).toBe(true)
  })

  // 3. Audio element does NOT have autoplay — PODPLAY-01 regression guard
  it('audio element does NOT have autoplay attribute', () => {
    render(<PodcastPlayer />)
    const audio = document.querySelector('audio')
    expect(audio?.hasAttribute('autoplay')).toBe(false)
    expect(audio?.autoplay).toBe(false)
  })

  // 4. NowPlayingLabel shows Kent on initial mount (default activePersona)
  it('NowPlayingLabel reads "Now playing: Kent" when activePersona is kent', () => {
    setPodState({ activePersona: 'kent' })
    render(<PodcastPlayer />)
    // The <p> element contains both "Now playing:" and the persona name span.
    // Use a text-match function to verify the full paragraph text.
    const nowPlayingParagraph = screen.getByText((content, element) => {
      return element?.tagName === 'P' && /now playing:/i.test(element.textContent ?? '')
    })
    expect(nowPlayingParagraph).toBeInTheDocument()
    expect(nowPlayingParagraph.textContent).toContain(PERSONA_META.kent.displayName)
  })

  // 5. Skip buttons render in Kent | Finch | Chen order with terse labels
  it('skip buttons render in Kent | Finch | Chen order', () => {
    render(<PodcastPlayer />)
    const kentBtn = screen.getByRole('button', { name: /^kent$/i })
    const finchBtn = screen.getByRole('button', { name: /^finch$/i })
    const chenBtn = screen.getByRole('button', { name: /^chen$/i })
    expect(kentBtn).toBeInTheDocument()
    expect(finchBtn).toBeInTheDocument()
    expect(chenBtn).toBeInTheDocument()
    // Kent appears before Finch in DOM order
    expect(
      kentBtn.compareDocumentPosition(finchBtn) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      finchBtn.compareDocumentPosition(chenBtn) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  // 6. Clicking Finch skip button sets audio.currentTime to offsets[1]
  it('clicking the Finch skip button sets audio.currentTime to offsets[1]', () => {
    render(<PodcastPlayer />)
    const audio = document.querySelector('audio') as HTMLAudioElement
    expect(audio).toBeTruthy()

    const finchBtn = screen.getByRole('button', { name: /^finch$/i })
    fireEvent.click(finchBtn)

    expect(audio.currentTime).toBe(5) // offsets[1] = 5
  })

  // 7. Clicking a skip button also updates activePersona in the store
  it('clicking the Finch skip button calls setActivePersona with finch', () => {
    render(<PodcastPlayer />)
    const finchBtn = screen.getByRole('button', { name: /^finch$/i })
    fireEvent.click(finchBtn)

    expect(mockSetActivePersona).toHaveBeenCalledWith('finch')
  })

  // 8. Active persona's button has distinct visual class
  it("active persona's button has the amber active-state class", () => {
    setPodState({ activePersona: 'kent' })
    render(<PodcastPlayer />)
    const kentBtn = screen.getByRole('button', { name: /^kent$/i })
    expect(kentBtn.className).toContain('amber')
    // Finch button (inactive) should not have the amber active class
    const finchBtn = screen.getByRole('button', { name: /^finch$/i })
    expect(finchBtn.className).not.toContain('amber')
  })

  // 9. timeupdate listener updates activePersona as currentTime crosses offsets
  it('timeupdate at t=7 calls setActivePersona with finch (7 >= offsets[1]=5 < offsets[2]=10)', () => {
    render(<PodcastPlayer />)
    const audio = document.querySelector('audio') as HTMLAudioElement
    expect(audio).toBeTruthy()

    // Set currentTime to 7 (between finch offset 5 and chen offset 10)
    Object.defineProperty(audio, 'currentTime', {
      configurable: true,
      writable: true,
      value: 7,
    })
    fireEvent(audio, new Event('timeupdate'))

    expect(mockSetActivePersona).toHaveBeenCalledWith('finch')
  })

  // 10. Unmount removes timeupdate listener
  it('unmount removes timeupdate listener', () => {
    const removeSpy = vi.spyOn(window.HTMLMediaElement.prototype, 'removeEventListener')
    const { unmount } = render(<PodcastPlayer />)
    unmount()
    expect(removeSpy).toHaveBeenCalledWith('timeupdate', expect.any(Function))
    removeSpy.mockRestore()
  })
})
