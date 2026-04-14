import { describe, it, expect } from 'vitest'
import { getPcBadge, getPersonasThisRound } from './pcThresholds'
import type { ChatMessage } from '@/types/game'

// ─── Helper ──────────────────────────────────────────────────────────────────

function msg(
  id: string,
  type: ChatMessage['type'],
  speaker?: ChatMessage['speaker'],
  label?: string,
): ChatMessage {
  return {
    id,
    type,
    speaker,
    label,
    timestamp: '2026-01-01T00:00:00Z',
  }
}

// ─── getPcBadge ──────────────────────────────────────────────────────────────

describe('getPcBadge', () => {
  it('returns CRISIS when pc is 0', () => {
    expect(getPcBadge(0)).toBe('CRISIS')
  })

  it('returns STRAINED when pc is 1', () => {
    expect(getPcBadge(1)).toBe('STRAINED')
  })

  it('returns null when pc is 2', () => {
    expect(getPcBadge(2)).toBeNull()
  })

  it('returns null when pc is 6', () => {
    expect(getPcBadge(6)).toBeNull()
  })
})

// ─── getPersonasThisRound ─────────────────────────────────────────────────────

describe('getPersonasThisRound', () => {
  it('returns empty Set for empty messages array', () => {
    const result = getPersonasThisRound([])
    expect(result.size).toBe(0)
  })

  it('returns only kent and finch when they speak after the last round_divider (not chen)', () => {
    const messages: ChatMessage[] = [
      msg('d1', 'round_divider', undefined, 'Round 1'),
      msg('m1', 'persona', 'kent'),
      msg('m2', 'persona', 'finch'),
    ]
    const result = getPersonasThisRound(messages)
    expect(result.has('kent')).toBe(true)
    expect(result.has('finch')).toBe(true)
    expect(result.has('chen')).toBe(false)
    expect(result.size).toBe(2)
  })

  it('ignores persona messages that appear BEFORE the last round_divider', () => {
    const messages: ChatMessage[] = [
      msg('m1', 'persona', 'chen'),      // before divider — should be ignored
      msg('d1', 'round_divider', undefined, 'Round 2'),
      msg('m2', 'persona', 'kent'),      // after divider — should be included
    ]
    const result = getPersonasThisRound(messages)
    expect(result.has('kent')).toBe(true)
    expect(result.has('chen')).toBe(false)
  })

  it('scans entire message list when there is no round_divider', () => {
    const messages: ChatMessage[] = [
      msg('m1', 'persona', 'kent'),
      msg('m2', 'persona', 'chen'),
    ]
    const result = getPersonasThisRound(messages)
    expect(result.has('kent')).toBe(true)
    expect(result.has('chen')).toBe(true)
    expect(result.has('finch')).toBe(false)
  })

  it('uses the LAST round_divider as the boundary (not the first)', () => {
    const messages: ChatMessage[] = [
      msg('d1', 'round_divider', undefined, 'Round 1'),
      msg('m1', 'persona', 'chen'),      // Round 1 — before last divider
      msg('d2', 'round_divider', undefined, 'Round 2'),
      msg('m2', 'persona', 'kent'),      // Round 2 — after last divider
    ]
    const result = getPersonasThisRound(messages)
    expect(result.has('kent')).toBe(true)
    expect(result.has('chen')).toBe(false)
  })

  it('does not include facilitator messages as persona coverage', () => {
    const messages: ChatMessage[] = [
      msg('d1', 'round_divider', undefined, 'Round 1'),
      msg('m1', 'facilitator', 'facilitator'),
      msg('m2', 'persona', 'finch'),
    ]
    const result = getPersonasThisRound(messages)
    expect(result.has('finch')).toBe(true)
    expect(result.size).toBe(1)
  })
})
