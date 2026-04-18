import { describe, it, expect } from 'vitest'
import type { ChatMessage } from '@/types/game'
import {
  extractPersonaTexts,
  countDebriefWords,
  estimateAudioMinutes,
  estimateGenerationSeconds,
  WORD_COUNT_SOFT_CEILING,
} from '@/lib/wordCountEstimate'

// Helper to build minimal ChatMessage fixtures
function makePersonaMsg(
  speaker: 'kent' | 'finch' | 'chen' | 'facilitator',
  text: string,
  isDebrief: boolean,
): ChatMessage {
  return {
    id: `msg-${Math.random()}`,
    type: 'persona',
    speaker,
    text,
    timestamp: new Date().toISOString(),
    isDebrief,
  }
}

function makeFacilitatorMsg(text: string): ChatMessage {
  return {
    id: `msg-${Math.random()}`,
    type: 'facilitator',
    speaker: 'facilitator',
    text,
    timestamp: new Date().toISOString(),
  }
}

function makeDividerMsg(): ChatMessage {
  return {
    id: `msg-${Math.random()}`,
    type: 'debrief_divider',
    label: '--- Debrief ---',
    timestamp: new Date().toISOString(),
  }
}

describe('extractPersonaTexts', () => {
  it('returns empty strings for missing personas when messages is empty', () => {
    const result = extractPersonaTexts([])
    expect(result).toEqual({ kent: '', finch: '', chen: '' })
  })

  it('picks the latest debrief message per persona', () => {
    const messages: ChatMessage[] = [
      makePersonaMsg('kent', 'first kent debrief', true),
      makePersonaMsg('kent', 'second kent debrief', true),
      makePersonaMsg('finch', 'finch debrief', true),
    ]
    const result = extractPersonaTexts(messages)
    expect(result.kent).toBe('second kent debrief')
    expect(result.finch).toBe('finch debrief')
    expect(result.chen).toBe('')
  })

  it('ignores non-debrief persona messages', () => {
    const messages: ChatMessage[] = [
      makePersonaMsg('kent', 'regular game message', false),
      makePersonaMsg('finch', 'another regular message', false),
    ]
    const result = extractPersonaTexts(messages)
    expect(result).toEqual({ kent: '', finch: '', chen: '' })
  })

  it('ignores facilitator messages and debrief dividers', () => {
    const messages: ChatMessage[] = [
      makeFacilitatorMsg('facilitator text'),
      makeDividerMsg(),
      makePersonaMsg('chen', 'chen debrief', true),
    ]
    const result = extractPersonaTexts(messages)
    expect(result.kent).toBe('')
    expect(result.finch).toBe('')
    expect(result.chen).toBe('chen debrief')
  })

  it('ignores persona messages with no text', () => {
    const msg: ChatMessage = {
      id: 'no-text',
      type: 'persona',
      speaker: 'kent',
      timestamp: new Date().toISOString(),
      isDebrief: true,
      // text intentionally omitted
    }
    const result = extractPersonaTexts([msg])
    expect(result.kent).toBe('')
  })
})

describe('countDebriefWords', () => {
  it('sums whitespace-split words across three personas', () => {
    const texts = {
      kent: 'one two three',
      finch: 'four five',
      chen: 'six',
    }
    expect(countDebriefWords(texts)).toBe(6)
  })

  it('treats pure-whitespace and empty strings as 0 words', () => {
    const texts = { kent: '   ', finch: '', chen: '\t\n' }
    expect(countDebriefWords(texts)).toBe(0)
  })

  it('handles mixed empty and non-empty', () => {
    const texts = { kent: 'hello world', finch: '', chen: '' }
    expect(countDebriefWords(texts)).toBe(2)
  })
})

describe('estimateAudioMinutes', () => {
  it('rounds up at 150 wpm boundary', () => {
    expect(estimateAudioMinutes(150)).toBe(1)
    expect(estimateAudioMinutes(151)).toBe(2)
    expect(estimateAudioMinutes(300)).toBe(2)
  })

  it('returns 0 for zero or negative word counts', () => {
    expect(estimateAudioMinutes(0)).toBe(0)
    expect(estimateAudioMinutes(-1)).toBe(0)
  })

  it('rounds up for fractional results', () => {
    // 1 word / 150 wpm → 0.0066... → ceil = 1
    expect(estimateAudioMinutes(1)).toBe(1)
    // 299 words / 150 wpm → 1.99... → ceil = 2
    expect(estimateAudioMinutes(299)).toBe(2)
  })
})

describe('estimateGenerationSeconds', () => {
  it('uses 3× multiplier with default delay of 2.0s', () => {
    expect(estimateGenerationSeconds()).toBe(6)
    expect(estimateGenerationSeconds(2.0)).toBe(6)
  })

  it('applies Math.ceil to fractional results', () => {
    // 3 * 0.5 = 1.5 → ceil = 2
    expect(estimateGenerationSeconds(0.5)).toBe(2)
  })

  it('handles 0 delay', () => {
    expect(estimateGenerationSeconds(0)).toBe(0)
  })

  it('handles larger delays', () => {
    // 3 * 5.0 = 15
    expect(estimateGenerationSeconds(5.0)).toBe(15)
  })
})

describe('WORD_COUNT_SOFT_CEILING', () => {
  it('equals 2000', () => {
    expect(WORD_COUNT_SOFT_CEILING).toBe(2000)
  })
})
