/**
 * Mid-generation TTS failure safety net (SC4 engineering layer, Phase 15-02)
 *
 * Verifies that mid-generation TTS failures surface through podcastStore.error.code
 * via the existing Phase-14 error pathway, and that the markdown download path is
 * structurally decoupled from podcastStore state.
 *
 * Approach: mirrors podcastStore.test.ts by mocking @/lib/podcastClient at module
 * level so the store's catch branch is exercised without needing to replicate the
 * full SSE transport layer (that is covered in podcastClient.test.ts).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

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
import { generateDebriefMarkdown, type DebriefSnapshot } from '@/lib/debriefExporter'

const mockedGeneratePodcast = generatePodcast as ReturnType<typeof vi.fn>

const startArgs = {
  gameName: 'Test Game',
  personaTexts: { kent: 'k', finch: 'f', chen: 'c' },
  voices: { kent: 'v-kent', finch: 'v-finch', chen: 'v-chen' },
}

beforeEach(() => {
  // Reset store to idle before each test
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
  ;(URL.createObjectURL as ReturnType<typeof vi.fn>).mockClear()
  ;(URL.revokeObjectURL as ReturnType<typeof vi.fn>).mockClear()
  let counter = 0
  ;(URL.createObjectURL as ReturnType<typeof vi.fn>).mockImplementation(
    () => `blob:mock-${++counter}`,
  )
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('mid-gen failure safety net (SC4 — Phase 15-02)', () => {

  // ── Test 1: mid-gen network error surfaces in podcastStore as 'network_error' ──

  it('mid-gen TypeError (network failure) surfaces in podcastStore as network_error', async () => {
    // Simulate a mid-generation network-layer failure.
    // podcastStore.ts catch block maps bare Error/TypeError to code: 'network_error' (line ~138).
    mockedGeneratePodcast.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    await usePodcastStore.getState().startGeneration(startArgs)

    const state = usePodcastStore.getState()
    expect(state.status).toBe('error')
    expect(state.error?.code).toBe('network_error')
    expect(state.error?.message).toBeTruthy()
  })

  // ── Test 2: mid-gen PodcastGenerationError with auth_error surfaces correctly ─

  it('mid-gen PodcastGenerationError auth_error surfaces in podcastStore.error.code', async () => {
    // Simulates an SSE error event from backend: { code: 'auth_error', ... }
    // podcastClient.ts throws PodcastGenerationError which podcastStore catches (line ~129).
    mockedGeneratePodcast.mockRejectedValueOnce(
      new PodcastGenerationError('auth_error', 'ElevenLabs authentication failed', 'finch'),
    )

    await usePodcastStore.getState().startGeneration(startArgs)

    const state = usePodcastStore.getState()
    expect(state.status).toBe('error')
    expect(state.error?.code).toBe('auth_error')
    expect(state.error?.message).toContain('ElevenLabs authentication failed')
    expect(state.error?.persona).toBe('finch')
  })

  // ── Test 3: markdown download path is structurally decoupled from podcastStore ─

  it('generateDebriefMarkdown succeeds even when podcastStore is in error state', () => {
    // Poison podcastStore with an error state (simulates post-failure scenario)
    usePodcastStore.setState({
      status: 'error',
      error: { code: 'auth_error', message: 'ElevenLabs key invalid — SC4 test poison' },
    })

    expect(usePodcastStore.getState().status).toBe('error')
    expect(usePodcastStore.getState().error?.code).toBe('auth_error')

    // Call generateDebriefMarkdown exactly as ActionToolbar.handleDownload does.
    // generateDebriefMarkdown reads only from its DebriefSnapshot argument — zero podcastStore access.
    // If it imported podcastStore, a circular dep or missing mock would cause this to fail.
    const snapshot = {
      gameConfig: {
        name: 'Test Game',
        scenarios: [{ id: 's1', name: 'Scenario 1', injects: ['inject 1'] }],
        teams: [{ id: 't1', name: 'Team 1', pc: 3, po: 0, readiness: 3, stock: 2, crm: 2, ic: 2 }],
        pcThresholds: { critical: 1, low: 2 },
        nationalActions: [],
        cards: [],
      },
      gameState: {
        round: 1,
        scenarioIndex: 0,
        crisisSeverity: 0,
        crisisState: 'No Crisis' as const,
        edipLegitimacy: 0,
        teams: [{ id: 't1', name: 'Team 1', pc: 3, po: 0, readiness: 3, stock: 2, crm: 2, ic: 2 }],
        cardsThisRound: [],
      },
      stateSnapshots: {},
      messages: [],
      exportedAt: new Date(),
    }

    const md = generateDebriefMarkdown(snapshot as unknown as DebriefSnapshot)

    expect(md).toBeTruthy()
    expect(typeof md).toBe('string')
    expect(md.length).toBeGreaterThan(0)
    // Structural decoupling confirmed: podcastStore error state did not prevent markdown generation.
  })
})
