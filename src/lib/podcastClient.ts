import type { PersonaTexts } from '@/lib/wordCountEstimate'

export interface PodcastVoices {
  kent: string
  finch: string
  chen: string
}

export interface GeneratePodcastArgs {
  gameName: string
  personaTexts: PersonaTexts
  voices: PodcastVoices
  forceFresh?: boolean
  signal: AbortSignal
  /** Called once per persona as the backend emits persona_done events. */
  onPersonaDone: (persona: 'kent' | 'finch' | 'chen') => void
}

export interface PodcastGenerationResult {
  blobUrl: string
  offsets: [number, number, number]
  wordCount: number
  cached: boolean
}

export class PodcastGenerationError extends Error {
  readonly code: string
  readonly persona?: 'kent' | 'finch' | 'chen'
  constructor(code: string, message: string, persona?: 'kent' | 'finch' | 'chen') {
    super(message)
    this.name = 'PodcastGenerationError'
    this.code = code
    this.persona = persona
  }
}

/**
 * Parse an SSE text buffer into [{event, data}, ...] tuples.
 *
 * Wire format per event (from FastAPI EventSourceResponse):
 *   event: persona_done\n
 *   data: {"persona":"kent"}\n
 *   \n
 *
 * Events are separated by blank lines. Exported for unit testing.
 */
export function parseSSEStream(buffer: string): Array<{ event: string; data: string }> {
  const frames = buffer.split('\n\n').filter((f) => f.trim().length > 0)
  return frames.map((frame) => {
    const lines = frame.split('\n')
    let event = 'message'
    const dataLines: string[] = []
    for (const line of lines) {
      if (line.startsWith('event:')) event = line.slice('event:'.length).trim()
      else if (line.startsWith('data:')) dataLines.push(line.slice('data:'.length).trim())
    }
    return { event, data: dataLines.join('\n') }
  })
}

/**
 * Generate a podcast end-to-end against the backend:
 *   1. POST /api/debrief/podcast (SSE) — yields three persona_done events, then done (or error).
 *   2. On done, GET /api/debrief/podcast/audio?token=... — returns the stitched MP3.
 *   3. Wrap the audio blob in URL.createObjectURL and resolve.
 *
 * Throws:
 *   - DOMException name='AbortError' if the signal aborts (callers handle as cancel).
 *   - PodcastGenerationError for structured backend error events.
 *   - Error for transport failures.
 */
export async function generatePodcast(args: GeneratePodcastArgs): Promise<PodcastGenerationResult> {
  const { gameName, personaTexts, voices, forceFresh = false, signal, onPersonaDone } = args

  const sseResponse = await fetch('/api/debrief/podcast', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      game_name: gameName,
      persona_texts: personaTexts,
      voices,
      force_fresh: forceFresh,
    }),
    signal,
  })

  if (!sseResponse.ok || !sseResponse.body) {
    throw new Error(
      `Podcast SSE request failed: ${sseResponse.status} ${sseResponse.statusText || ''}`.trim(),
    )
  }

  const reader = sseResponse.body.getReader()
  const decoder = new TextDecoder()
  let textBuffer = ''
  let doneData: { token: string; offsets: number[]; word_count: number; cached: boolean } | null =
    null
  let errorPayload: { code: string; message: string; persona?: 'kent' | 'finch' | 'chen' } | null =
    null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    textBuffer += decoder.decode(value, { stream: true })

    // Split on \n\n to find completed frames; keep any trailing partial frame in textBuffer.
    const lastSep = textBuffer.lastIndexOf('\n\n')
    if (lastSep === -1) continue
    const completed = textBuffer.slice(0, lastSep + 2)
    textBuffer = textBuffer.slice(lastSep + 2)

    for (const evt of parseSSEStream(completed)) {
      if (evt.event === 'persona_done') {
        const payload = JSON.parse(evt.data) as { persona: 'kent' | 'finch' | 'chen' }
        onPersonaDone(payload.persona)
      } else if (evt.event === 'done') {
        doneData = JSON.parse(evt.data)
      } else if (evt.event === 'error') {
        errorPayload = JSON.parse(evt.data)
      }
    }
  }

  if (errorPayload) {
    throw new PodcastGenerationError(errorPayload.code, errorPayload.message, errorPayload.persona)
  }
  if (!doneData) {
    throw new Error('Podcast SSE stream ended without a done event')
  }

  // Pull the audio by token
  const audioResponse = await fetch(
    `/api/debrief/podcast/audio?token=${encodeURIComponent(doneData.token)}`,
    { signal },
  )
  if (!audioResponse.ok) {
    throw new Error(
      `Podcast audio fetch failed: ${audioResponse.status} ${audioResponse.statusText || ''}`.trim(),
    )
  }
  const blob = await audioResponse.blob()
  const blobUrl = URL.createObjectURL(blob)

  // Runtime narrowing — backend guarantees length 3 but TS can't see that
  const [o0, o1, o2] = doneData.offsets
  if (o0 === undefined || o1 === undefined || o2 === undefined) {
    throw new Error('Podcast done event missing three offsets')
  }

  return {
    blobUrl,
    offsets: [o0, o1, o2],
    wordCount: doneData.word_count,
    cached: doneData.cached,
  }
}
