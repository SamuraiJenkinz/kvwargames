import { describe, it, expect } from 'vitest'
import { formatLatency } from './formatLatency'

describe('formatLatency', () => {
  it('formats 0ms as "0ms"', () => {
    expect(formatLatency(0)).toBe('0ms')
  })
  it('formats 999ms as "999ms" (boundary)', () => {
    expect(formatLatency(999)).toBe('999ms')
  })
  it('formats 1000ms as "1.0s" (boundary)', () => {
    expect(formatLatency(1000)).toBe('1.0s')
  })
  it('formats 1234ms as "1.2s" (one decimal)', () => {
    expect(formatLatency(1234)).toBe('1.2s')
  })
  it('formats 12500ms as "12.5s"', () => {
    expect(formatLatency(12500)).toBe('12.5s')
  })
})
