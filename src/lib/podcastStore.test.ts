import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act } from '@testing-library/react'

vi.mock('@/lib/podcastClient', () => ({
  generatePodcast: vi.fn(),
  PodcastGenerationError: class PodcastGenerationError extends Error {
    code: string
    persona?: 'kent' | 'finch' | 'chen'
    constructor(code: string, message: string, persona?: 'kent' | 'finch' | 'chen') {
      super(message)
      this.name = 'PodcastGenerationError'
      this.code = code
      this.persona = persona
    }
  },
}))

import { generatePodcast, PodcastGenerationError } from '@/lib/podcastClient'
import { usePodcastStore } from '@/lib/podcastStore'

const mockGenerate = generatePodcast as ReturnType<typeof vi.fn>

const defaultArgs = {
  gameName: 'Test Game',
  personaTexts: { kent: 'k', finch: 'f', chen: 'c' },
  voices: { kent: 'v-kent', finch: 'v-finch', chen: 'v-chen' },
}

beforeEach(() => {
  // Reset store to idle between tests
  usePodcastStore.setState({
    status: 'idle',
    personaProgress: { kent: 'waiting', finch: 'waiting', chen: 'waiting' },
    blobUrl: null,
    offsets: null,
    activePersona: 'kent',
    wordCount: 0,
    cached: false,
    error: null,
    generatedAt: null,
    abortController: null,
  })
  vi.clearAllMocks()
  // Re-set URL mocks to clean state
  ;(URL.createObjectURL as ReturnType<typeof vi.fn>).mockClear()
  ;(URL.revokeObjectURL as ReturnType<typeof vi.fn>).mockClear()
  let counter = 0
  ;(URL.createObjectURL as ReturnType<typeof vi.fn>).mockImplementation(
    () => `blob:mock-${++counter}`,
  )
})

describe('podcastStore initial state', () => {
  it('is idle with empty progress and null blob', () => {
    const state = usePodcastStore.getState()
    expect(state.status).toBe('idle')
    expect(state.personaProgress).toEqual({ kent: 'waiting', finch: 'waiting', chen: 'waiting' })
    expect(state.blobUrl).toBeNull()
    expect(state.offsets).toBeNull()
    expect(state.wordCount).toBe(0)
    expect(state.error).toBeNull()
    expect(state.generatedAt).toBeNull()
  })
})

describe('startGeneration', () => {
  it('transitions to generating + INITIAL_PROGRESS (Kent rendering) while in-flight', async () => {
    // Mock that never resolves
    mockGenerate.mockReturnValue(new Promise(() => {}))

    // Don't await — let it sit in-flight
    usePodcastStore.getState().startGeneration(defaultArgs)

    // Flush microtasks enough for the initial setState to fire
    await act(async () => {
      await Promise.resolve()
    })

    const state = usePodcastStore.getState()
    expect(state.status).toBe('generating')
    expect(state.personaProgress.kent).toBe('rendering')
    expect(state.personaProgress.finch).toBe('waiting')
    expect(state.personaProgress.chen).toBe('waiting')
  })

  it('advances persona progress via onPersonaDone callbacks', async () => {
    let capturedOnPersonaDone: ((p: 'kent' | 'finch' | 'chen') => void) | null = null

    mockGenerate.mockImplementation(
      ({ onPersonaDone }: { onPersonaDone: (p: 'kent' | 'finch' | 'chen') => void }) => {
        capturedOnPersonaDone = onPersonaDone
        return new Promise(() => {}) // never resolves — we drive it manually
      },
    )

    usePodcastStore.getState().startGeneration(defaultArgs)
    await act(async () => { await Promise.resolve() })

    // Fire persona_done(kent) — should mark kent done, finch rendering
    act(() => { capturedOnPersonaDone!('kent') })
    expect(usePodcastStore.getState().personaProgress).toEqual({
      kent: 'done',
      finch: 'rendering',
      chen: 'waiting',
    })

    // Fire persona_done(finch) — should mark finch done, chen rendering
    act(() => { capturedOnPersonaDone!('finch') })
    expect(usePodcastStore.getState().personaProgress).toEqual({
      kent: 'done',
      finch: 'done',
      chen: 'rendering',
    })
  })

  it('sets status=done + blobUrl + offsets on successful generation', async () => {
    mockGenerate.mockResolvedValue({
      blobUrl: 'blob:a',
      offsets: [0, 5, 10] as [number, number, number],
      wordCount: 100,
      cached: false,
    })

    await act(async () => {
      await usePodcastStore.getState().startGeneration(defaultArgs)
    })

    const state = usePodcastStore.getState()
    expect(state.status).toBe('done')
    expect(state.blobUrl).toBe('blob:a')
    expect(state.offsets).toEqual([0, 5, 10])
    expect(state.wordCount).toBe(100)
    expect(state.cached).toBe(false)
    expect(state.abortController).toBeNull()
  })

  it('cancel() aborts the in-flight controller and resets state to idle', async () => {
    mockGenerate.mockRejectedValue(new DOMException('aborted', 'AbortError'))

    const promise = act(async () => {
      await usePodcastStore.getState().startGeneration(defaultArgs)
    })

    usePodcastStore.getState().cancel()
    await promise

    const state = usePodcastStore.getState()
    expect(state.status).toBe('idle')
    expect(state.blobUrl).toBeNull()
    expect(state.error).toBeNull()
    expect(state.generatedAt).toBeNull()
  })

  it('revokes prior blobUrl before starting a new generation', async () => {
    // Inject an existing blob URL into the store
    usePodcastStore.setState({ blobUrl: 'blob:old' })

    mockGenerate.mockResolvedValue({
      blobUrl: 'blob:new',
      offsets: [0, 1, 2] as [number, number, number],
      wordCount: 50,
      cached: false,
    })

    await act(async () => {
      await usePodcastStore.getState().startGeneration({ ...defaultArgs, forceFresh: true })
    })

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:old')
    expect(usePodcastStore.getState().blobUrl).toBe('blob:new')
  })

  it('PodcastGenerationError lands in status=error with code/message/persona', async () => {
    mockGenerate.mockRejectedValue(
      new PodcastGenerationError('upstream_error', 'boom', 'finch'),
    )

    await act(async () => {
      await usePodcastStore.getState().startGeneration(defaultArgs)
    })

    const state = usePodcastStore.getState()
    expect(state.status).toBe('error')
    expect(state.error).toEqual({ code: 'upstream_error', message: 'boom', persona: 'finch' })
    expect(state.abortController).toBeNull()
  })

  it('unknown error surfaces as network_error', async () => {
    mockGenerate.mockRejectedValue(new Error('ECONNREFUSED'))

    await act(async () => {
      await usePodcastStore.getState().startGeneration(defaultArgs)
    })

    const state = usePodcastStore.getState()
    expect(state.status).toBe('error')
    expect(state.error?.code).toBe('network_error')
    expect(state.error?.message).toContain('ECONNREFUSED')
  })

  it('forceFresh=true is forwarded to generatePodcast', async () => {
    mockGenerate.mockResolvedValue({
      blobUrl: 'blob:x',
      offsets: [0, 1, 2] as [number, number, number],
      wordCount: 10,
      cached: false,
    })

    await act(async () => {
      await usePodcastStore.getState().startGeneration({ ...defaultArgs, forceFresh: true })
    })

    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({ forceFresh: true }),
    )
  })
})

describe('reset', () => {
  it('revokes blob URL and clears all state', async () => {
    usePodcastStore.setState({
      status: 'done',
      blobUrl: 'blob:to-revoke',
      offsets: [0, 5, 10],
      wordCount: 200,
      error: null,
    })

    act(() => { usePodcastStore.getState().reset() })

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:to-revoke')
    const state = usePodcastStore.getState()
    expect(state.status).toBe('idle')
    expect(state.blobUrl).toBeNull()
    expect(state.offsets).toBeNull()
    expect(state.wordCount).toBe(0)
  })
})

describe('setActivePersona', () => {
  it('updates activePersona', () => {
    usePodcastStore.getState().setActivePersona('finch')
    expect(usePodcastStore.getState().activePersona).toBe('finch')
  })
})
