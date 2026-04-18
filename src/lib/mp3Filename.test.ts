import { describe, it, expect } from 'vitest'
import { toKebabFilenameStrict, buildMp3Filename } from '@/lib/mp3Filename'
import { buildDebriefFilename } from '@/lib/debriefExporter'

describe('toKebabFilenameStrict', () => {
  it('basics — lowercases and replaces spaces with hyphens', () => {
    expect(toKebabFilenameStrict('Pandemic Rehearsal')).toBe('pandemic-rehearsal')
  })

  it('collapses runs of spaces and hyphens', () => {
    expect(toKebabFilenameStrict('Foo   Bar')).toBe('foo-bar')
    expect(toKebabFilenameStrict('a--b')).toBe('a-b')
    expect(toKebabFilenameStrict('a  --  b')).toBe('a-b')
  })

  it('strips non-alphanumeric characters after spaces become hyphens', () => {
    expect(toKebabFilenameStrict('Game!! @#$%')).toBe('game')
    expect(toKebabFilenameStrict('Foo/Bar?')).toBe('foobar')
  })

  it('trims edge hyphens', () => {
    expect(toKebabFilenameStrict('-foo-')).toBe('foo')
    expect(toKebabFilenameStrict('---')).toBe('session')
  })

  it('fallback session on empty, whitespace-only, and punctuation-only input', () => {
    expect(toKebabFilenameStrict('')).toBe('session')
    expect(toKebabFilenameStrict('   ')).toBe('session')
    expect(toKebabFilenameStrict('!!!')).toBe('session')
  })
})

describe('buildMp3Filename', () => {
  it('uses local time — sanity check on fixed Date', () => {
    // new Date(year, monthIndex, day, hours, minutes) — month is 0-indexed
    const d = new Date(2026, 3, 18, 15, 47) // April 18 2026 15:47 local
    expect(buildMp3Filename('foo', d)).toBe('debrief-foo-2026-04-18-1547.mp3')
  })

  it('pads single-digit month, day, hour, and minute', () => {
    const d = new Date(2026, 0, 5, 9, 3) // January 5 2026 09:03 local
    expect(buildMp3Filename('x', d)).toBe('debrief-x-2026-01-05-0903.mp3')
  })

  it('uses session fallback for empty game name', () => {
    const d = new Date(2026, 3, 18, 15, 47)
    expect(buildMp3Filename('', d)).toBe('debrief-session-2026-04-18-1547.mp3')
  })

  it('diverges from buildDebriefFilename on UTC-offset systems', () => {
    // buildDebriefFilename uses toISOString() (UTC); buildMp3Filename uses
    // local-time getters. They differ whenever the local timezone is not UTC.
    const d = new Date(2026, 3, 18, 15, 47)
    if (d.getTimezoneOffset() !== 0) {
      const mp3Ts = buildMp3Filename('test', d)
      const mdTs = buildDebriefFilename('test', d)
      // The timestamp portion (after the 3rd hyphen-separated segment) will differ
      expect(mp3Ts).not.toBe(mdTs.replace('.md', '.mp3'))
    } else {
      // In UTC timezone, the timestamps should match modulo extension
      // Just verify they produce valid filenames
      expect(buildMp3Filename('test', d)).toMatch(/^debrief-test-\d{4}-\d{2}-\d{2}-\d{4}\.mp3$/)
    }
  })
})
