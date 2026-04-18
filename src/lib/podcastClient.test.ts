import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generatePodcast, parseSSEStream, PodcastGenerationError } from '@/lib/podcastClient'

// ─── SSE Helpers ──────────────────────────────────────────────────────────────

function sseReadable(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  let i = 0
  return new ReadableStream({
    pull(controller) {
      if (i >= chunks.length) {
        controller.close()
        return
      }
      controller.enqueue(encoder.encode(chunks[i]!))
      i += 1
    },
  })
}

function mockSSEThenBlob(
  sseChunks: string[],
  audioBytes: Uint8Array = new Uint8Array([1, 2, 3]),
) {
  const sseResp = new Response(sseReadable(sseChunks), {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  })
  const audioBlob = new Blob([audioBytes], { type: 'audio/mpeg' })
  const audioResp = new Response(audioBlob, {
    status: 200,
    headers: { 'content-type': 'audio/mpeg' },
  })
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(sseResp)
    .mockResolvedValueOnce(audioResp)
  globalThis.fetch = fetchMock as unknown as typeof fetch
  return fetchMock
}

// Default args for generatePodcast
const defaultArgs = {
  gameName: 'Test Game',
  personaTexts: { kent: 'kent text', finch: 'finch text', chen: 'chen text' },
  voices: { kent: 'voice-kent', finch: 'voice-finch', chen: 'voice-chen' },
  signal: new AbortController().signal,
  onPersonaDone: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
  // Reset the mock counter via casting (it's a vi.fn() from setup.ts)
  ;(URL.createObjectURL as ReturnType<typeof vi.fn>).mockClear()
  ;(URL.revokeObjectURL as ReturnType<typeof vi.fn>).mockClear()
  // Reset the counter-based mock to return predictable values
  let counter = 0
  ;(URL.createObjectURL as ReturnType<typeof vi.fn>).mockImplementation(
    () => `blob:mock-${++counter}`,
  )
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ─── parseSSEStream tests ─────────────────────────────────────────────────────

describe('parseSSEStream', () => {
  it('parses three persona_done + done frames', () => {
    const raw = [
      'event: persona_done\ndata: {"persona":"kent"}\n\n',
      'event: persona_done\ndata: {"persona":"finch"}\n\n',
      'event: persona_done\ndata: {"persona":"chen"}\n\n',
      'event: done\ndata: {"token":"abc","offsets":[0,5.04,10.78],"word_count":123,"cached":false}\n\n',
    ].join('')

    const frames = parseSSEStream(raw)
    expect(frames).toHaveLength(4)
    expect(frames[0]).toEqual({ event: 'persona_done', data: '{"persona":"kent"}' })
    expect(frames[1]).toEqual({ event: 'persona_done', data: '{"persona":"finch"}' })
    expect(frames[2]).toEqual({ event: 'persona_done', data: '{"persona":"chen"}' })
    expect(frames[3]?.event).toBe('done')
    expect(JSON.parse(frames[3]!.data)).toMatchObject({
      token: 'abc',
      offsets: [0, 5.04, 10.78],
      word_count: 123,
      cached: false,
    })
  })

  it('ignores empty frames and trailing newlines', () => {
    const raw = '\n\n\nevent: done\ndata: {"token":"t","offsets":[0,1,2],"word_count":10,"cached":false}\n\n\n\n'
    const frames = parseSSEStream(raw)
    expect(frames).toHaveLength(1)
    expect(frames[0]?.event).toBe('done')
  })

  it('defaults event to "message" when no event line is present', () => {
    const raw = 'data: {"hello":"world"}\n\n'
    const frames = parseSSEStream(raw)
    expect(frames).toHaveLength(1)
    expect(frames[0]).toEqual({ event: 'message', data: '{"hello":"world"}' })
  })
})

// ─── generatePodcast tests ────────────────────────────────────────────────────

describe('generatePodcast', () => {
  it('happy path — SSE → blob URL + offsets', async () => {
    const onPersonaDone = vi.fn()
    const chunks = [
      'event: persona_done\ndata: {"persona":"kent"}\n\n',
      'event: persona_done\ndata: {"persona":"finch"}\n\n',
      'event: persona_done\ndata: {"persona":"chen"}\n\n',
      'event: done\ndata: {"token":"abc","offsets":[0,5.04,10.78],"word_count":123,"cached":false}\n\n',
    ]
    const fetchMock = mockSSEThenBlob(chunks)

    const result = await generatePodcast({
      ...defaultArgs,
      onPersonaDone,
    })

    expect(onPersonaDone).toHaveBeenCalledTimes(3)
    expect(onPersonaDone).toHaveBeenNthCalledWith(1, 'kent')
    expect(onPersonaDone).toHaveBeenNthCalledWith(2, 'finch')
    expect(onPersonaDone).toHaveBeenNthCalledWith(3, 'chen')

    expect(result.blobUrl).toMatch(/^blob:mock-/)
    expect(result.offsets).toEqual([0, 5.04, 10.78])
    expect(result.wordCount).toBe(123)
    expect(result.cached).toBe(false)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][0]).toBe('/api/debrief/podcast')
    expect(fetchMock.mock.calls[1][0]).toBe('/api/debrief/podcast/audio?token=abc')
  })

  it('handles chunk-boundary splits in SSE text', async () => {
    const onPersonaDone = vi.fn()
    // Deliberately split a frame across two chunks at an arbitrary byte boundary
    const chunks = [
      'event: persona_done\ndata: {"persona":"kent"}\n\nevent: persona_done\ndata: {"per',
      'sona":"finch"}\n\nevent: persona_done\ndata: {"persona":"chen"}\n\nevent: done\ndata: {"token":"t","offsets":[0,1,2],"word_count":50,"cached":false}\n\n',
    ]
    mockSSEThenBlob(chunks)

    const result = await generatePodcast({ ...defaultArgs, onPersonaDone })

    // All three persona_done events should be parsed despite the boundary split
    expect(onPersonaDone).toHaveBeenCalledTimes(3)
    expect(result.wordCount).toBe(50)
  })

  it('propagates abort — throws DOMException AbortError', async () => {
    const controller = new AbortController()
    controller.abort()

    const fetchMock = vi.fn().mockRejectedValueOnce(new DOMException('aborted', 'AbortError'))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    await expect(
      generatePodcast({ ...defaultArgs, signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' })

    expect(fetchMock).toHaveBeenCalledTimes(1) // no second audio fetch
  })

  it('throws PodcastGenerationError on error event', async () => {
    const onPersonaDone = vi.fn()
    const chunks = [
      'event: persona_done\ndata: {"persona":"kent"}\n\n',
      'event: error\ndata: {"code":"upstream_error","message":"boom","persona":"finch"}\n\n',
    ]

    const sseResp = new Response(sseReadable(chunks), {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    })
    const fetchMock = vi.fn().mockResolvedValueOnce(sseResp)
    globalThis.fetch = fetchMock as unknown as typeof fetch

    await expect(
      generatePodcast({ ...defaultArgs, onPersonaDone }),
    ).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof PodcastGenerationError &&
        err.code === 'upstream_error' &&
        err.persona === 'finch',
    )

    // No audio fetch should have been attempted
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('throws if stream ends without done event', async () => {
    const chunks = [
      'event: persona_done\ndata: {"persona":"kent"}\n\n',
      'event: persona_done\ndata: {"persona":"finch"}\n\n',
    ]
    const sseResp = new Response(sseReadable(chunks), {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    })
    vi.fn().mockResolvedValueOnce(sseResp)
    globalThis.fetch = vi.fn().mockResolvedValueOnce(sseResp) as unknown as typeof fetch

    await expect(generatePodcast({ ...defaultArgs })).rejects.toThrow('without a done event')
  })

  it('forwards force_fresh in request body', async () => {
    const chunks = [
      'event: persona_done\ndata: {"persona":"kent"}\n\n',
      'event: persona_done\ndata: {"persona":"finch"}\n\n',
      'event: persona_done\ndata: {"persona":"chen"}\n\n',
      'event: done\ndata: {"token":"t","offsets":[0,1,2],"word_count":10,"cached":false}\n\n',
    ]
    const fetchMock = mockSSEThenBlob(chunks)

    await generatePodcast({ ...defaultArgs, forceFresh: true })

    const postBody = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(postBody.force_fresh).toBe(true)
  })

  it('surfaces non-200 SSE response as an error', async () => {
    const errorResp = new Response(null, { status: 500, statusText: 'Internal Server Error' })
    globalThis.fetch = vi.fn().mockResolvedValueOnce(errorResp) as unknown as typeof fetch

    await expect(generatePodcast({ ...defaultArgs })).rejects.toThrow('500')
  })

  it('cached=true is passed through in result', async () => {
    const chunks = [
      'event: persona_done\ndata: {"persona":"kent"}\n\n',
      'event: persona_done\ndata: {"persona":"finch"}\n\n',
      'event: persona_done\ndata: {"persona":"chen"}\n\n',
      'event: done\ndata: {"token":"t","offsets":[0,5,10],"word_count":99,"cached":true}\n\n',
    ]
    mockSSEThenBlob(chunks)

    const result = await generatePodcast({ ...defaultArgs })
    expect(result.cached).toBe(true)
  })
})
