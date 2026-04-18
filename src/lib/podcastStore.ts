import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { generatePodcast, PodcastGenerationError } from '@/lib/podcastClient'
import type { PersonaTexts } from '@/lib/wordCountEstimate'

export type PodcastStatus = 'idle' | 'generating' | 'done' | 'error'
export type PersonaKey = 'kent' | 'finch' | 'chen'
export type PersonaProgressState = 'waiting' | 'rendering' | 'done'
export type PersonaProgressMap = Record<PersonaKey, PersonaProgressState>

export interface PodcastStoreState {
  status: PodcastStatus
  personaProgress: PersonaProgressMap
  blobUrl: string | null
  offsets: [number, number, number] | null
  activePersona: PersonaKey
  wordCount: number
  cached: boolean
  error: { code: string; message: string; persona?: PersonaKey } | null
  /** Milliseconds since epoch at generation click — used for MP3 filename timestamp. */
  generatedAt: number | null
  /** Internal — the AbortController owning the in-flight fetch. */
  abortController: AbortController | null

  /** Actions */
  startGeneration: (args: {
    gameName: string
    personaTexts: PersonaTexts
    voices: { kent: string; finch: string; chen: string }
    forceFresh?: boolean
  }) => Promise<void>
  cancel: () => void
  setActivePersona: (p: PersonaKey) => void
  reset: () => void
}

const INITIAL_PROGRESS: PersonaProgressMap = {
  kent: 'rendering',
  finch: 'waiting',
  chen: 'waiting',
}

const EMPTY_PROGRESS: PersonaProgressMap = {
  kent: 'waiting',
  finch: 'waiting',
  chen: 'waiting',
}

const NEXT_PERSONA: Record<PersonaKey, PersonaKey | null> = {
  kent: 'finch',
  finch: 'chen',
  chen: null,
}

export const usePodcastStore = create<PodcastStoreState>()(
  devtools(
    (set, get) => ({
      status: 'idle',
      personaProgress: EMPTY_PROGRESS,
      blobUrl: null,
      offsets: null,
      activePersona: 'kent',
      wordCount: 0,
      cached: false,
      error: null,
      generatedAt: null,
      abortController: null,

      startGeneration: async ({ gameName, personaTexts, voices, forceFresh = false }) => {
        // Revoke any existing blobUrl BEFORE starting a new generation.
        const prev = get().blobUrl
        if (prev) URL.revokeObjectURL(prev)

        const controller = new AbortController()
        set({
          status: 'generating',
          personaProgress: INITIAL_PROGRESS,
          blobUrl: null,
          offsets: null,
          activePersona: 'kent',
          error: null,
          cached: false,
          generatedAt: Date.now(),
          abortController: controller,
        })

        try {
          const result = await generatePodcast({
            gameName,
            personaTexts,
            voices,
            forceFresh,
            signal: controller.signal,
            onPersonaDone: (persona) => {
              set((s) => {
                const nextProgress: PersonaProgressMap = { ...s.personaProgress, [persona]: 'done' }
                const next = NEXT_PERSONA[persona]
                if (next && nextProgress[next] === 'waiting') {
                  nextProgress[next] = 'rendering'
                }
                return { personaProgress: nextProgress }
              })
            },
          })

          set({
            status: 'done',
            blobUrl: result.blobUrl,
            offsets: result.offsets,
            wordCount: result.wordCount,
            cached: result.cached,
            personaProgress: { kent: 'done', finch: 'done', chen: 'done' },
            abortController: null,
          })
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') {
            // Cancel path — silent reset per CONTEXT.md (no partial MP3, no toast).
            set({
              status: 'idle',
              personaProgress: EMPTY_PROGRESS,
              blobUrl: null,
              offsets: null,
              error: null,
              abortController: null,
              generatedAt: null,
            })
            return
          }
          if (err instanceof PodcastGenerationError) {
            set({
              status: 'error',
              error: { code: err.code, message: err.message, persona: err.persona },
              abortController: null,
            })
            return
          }
          const message = err instanceof Error ? err.message : 'Unknown podcast error'
          set({
            status: 'error',
            error: { code: 'network_error', message },
            abortController: null,
          })
        }
      },

      cancel: () => {
        const ctrl = get().abortController
        if (ctrl) ctrl.abort()
      },

      setActivePersona: (p) => set({ activePersona: p }),

      reset: () => {
        const prev = get().blobUrl
        if (prev) URL.revokeObjectURL(prev)
        set({
          status: 'idle',
          personaProgress: EMPTY_PROGRESS,
          blobUrl: null,
          offsets: null,
          activePersona: 'kent',
          wordCount: 0,
          cached: false,
          error: null,
          generatedAt: null,
          abortController: null,
        })
      },
    }),
    { name: 'podcast-store' },
  ),
)
