import '@testing-library/jest-dom'
import { vi } from 'vitest'

// jsdom does not implement scrollIntoView — mock it globally so components
// that call sentinelRef.current?.scrollIntoView() don't throw in tests.
if (typeof window !== 'undefined') {
  window.HTMLElement.prototype.scrollIntoView = () => {}
}

// jsdom does not implement HTMLMediaElement playback methods. Stub them so
// audio-element-carrying components under test don't throw when React effects
// call .load() / .play() / .pause(). currentTime is a writable property in
// jsdom and does not need mocking. See RESEARCH.md frontend test strategy.
if (typeof window !== 'undefined') {
  Object.defineProperty(window.HTMLMediaElement.prototype, 'load', {
    configurable: true,
    writable: true,
    value: () => {},
  })
  Object.defineProperty(window.HTMLMediaElement.prototype, 'play', {
    configurable: true,
    writable: true,
    value: () => Promise.resolve(),
  })
  Object.defineProperty(window.HTMLMediaElement.prototype, 'pause', {
    configurable: true,
    writable: true,
    value: () => {},
  })
}

// Vitest v4 + jsdom has a known Blob/URL.createObjectURL conflict
// (vitest issue #8917). Provide a simple counter-based mock so component
// tests can assert on revokeObjectURL call counts without fighting jsdom.
if (typeof globalThis.URL !== 'undefined') {
  let urlCounter = 0
  globalThis.URL.createObjectURL = vi.fn(
    () => `blob:mock-${++urlCounter}`,
  ) as unknown as typeof URL.createObjectURL
  globalThis.URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL
}
