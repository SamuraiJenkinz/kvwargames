import type { ChatMessage } from '@/types/game'

/** Soft ceiling above which the word-count confirmation dialog is shown. */
export const WORD_COUNT_SOFT_CEILING = 2000

/** Spoken narration midpoint — multiple authoritative sources align on 150–160 wpm. */
export const WORDS_PER_MINUTE = 150

/** Default FakeTTSProvider delay — matches Settings.fake_tts_delay_seconds default. */
export const DEFAULT_FAKE_TTS_DELAY_SECONDS = 2.0

export interface PersonaTexts {
  kent: string
  finch: string
  chen: string
}

/**
 * Extract the latest debrief text for each of the three personas from the
 * chat message history. The LAST `debrief_divider` message anchors the
 * debrief region: every persona message after that divider is a debrief
 * message (gameStore pushes the divider from triggerDebrief / endGame
 * immediately before firing the debrief LLM turn).
 *
 * If a session contains multiple dividers (interim `triggerDebrief` followed
 * by final `endGame`), we return the texts from the FINAL debrief.
 */
export function extractPersonaTexts(messages: ChatMessage[]): PersonaTexts {
  let lastDividerIdx = -1
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.type === 'debrief_divider') {
      lastDividerIdx = i
      break
    }
  }
  if (lastDividerIdx === -1) {
    return { kent: '', finch: '', chen: '' }
  }
  const latest: Partial<PersonaTexts> = {}
  for (let i = lastDividerIdx + 1; i < messages.length; i++) {
    const m = messages[i]
    if (!m || m.type !== 'persona' || !m.text) continue
    if (m.speaker === 'kent' || m.speaker === 'finch' || m.speaker === 'chen') {
      latest[m.speaker] = m.text
    }
  }
  return {
    kent: latest.kent ?? '',
    finch: latest.finch ?? '',
    chen: latest.chen ?? '',
  }
}

/** Whitespace-split word count across a single string. */
function countWords(text: string): number {
  return text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length
}

/** Combined word count across the three persona debrief texts. */
export function countDebriefWords(texts: PersonaTexts): number {
  return countWords(texts.kent) + countWords(texts.finch) + countWords(texts.chen)
}

/**
 * Round-up estimated spoken duration in minutes.
 * E.g. 300 words → 2 min; 150 words → 1 min; 0 → 0; 1 word → 1 min.
 */
export function estimateAudioMinutes(wordCount: number): number {
  if (wordCount <= 0) return 0
  return Math.ceil(wordCount / WORDS_PER_MINUTE)
}

/**
 * Round-up estimated generation time in seconds for the fake provider.
 * Three serial calls × delay_seconds each. Client-side formula since the
 * fake provider is the only provider exercised in Phase 14 (real ElevenLabs
 * is Phase 16).
 */
export function estimateGenerationSeconds(
  fakeDelaySeconds: number = DEFAULT_FAKE_TTS_DELAY_SECONDS,
): number {
  return Math.ceil(3 * fakeDelaySeconds)
}
