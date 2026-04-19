import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchTtsVoices } from '@/lib/ttsVoicesClient'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchTtsVoices', () => {
  it('returns parsed voice map on HTTP 200', async () => {
    const mockMap = { kent: 'a', finch: 'b', chen: 'c' }
    const mockFetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify(mockMap), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', mockFetch)

    const result = await fetchTtsVoices()

    expect(result).toEqual({ kent: 'a', finch: 'b', chen: 'c' })
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledWith('/api/config/tts-voices')
  })

  it('throws on HTTP non-2xx', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(
      new Response('Internal Server Error', { status: 500 }),
    )
    vi.stubGlobal('fetch', mockFetch)

    await expect(fetchTtsVoices()).rejects.toThrow('HTTP 500')
  })
})
