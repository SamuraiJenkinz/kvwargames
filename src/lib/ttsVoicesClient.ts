/**
 * ttsVoicesClient.ts — fetch the per-persona voice ID map from the backend.
 *
 * The backend GET /api/config/tts-voices returns the correct voice IDs for
 * whichever TTS provider is active:
 *   - TTS_PROVIDER=elevenlabs  →  real ElevenLabs voice IDs from settings
 *   - TTS_PROVIDER=fake        →  __fake_kent__ / __fake_finch__ / __fake_chen__
 *
 * This replaces the hardcoded sentinel strings that ActionToolbar.tsx previously
 * embedded directly in handleGenerate (Phase 16 fix — 16-RESEARCH.md §4).
 */

/** Shape of the voice map returned by GET /api/config/tts-voices. */
export interface TtsVoiceMap {
  kent: string
  finch: string
  chen: string
}

/**
 * Fetch the TTS voice ID map for the current backend configuration.
 *
 * @throws {Error} If the HTTP response is non-2xx.
 * @returns Resolved TtsVoiceMap with kent, finch, and chen voice IDs.
 */
export async function fetchTtsVoices(): Promise<TtsVoiceMap> {
  const res = await fetch('/api/config/tts-voices')
  if (!res.ok) {
    throw new Error(`Failed to fetch TTS voices: HTTP ${res.status}`)
  }
  return res.json() as Promise<TtsVoiceMap>
}
