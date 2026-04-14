import '@testing-library/jest-dom'

// jsdom does not implement scrollIntoView — mock it globally so components
// that call sentinelRef.current?.scrollIntoView() don't throw in tests.
if (typeof window !== 'undefined') {
  window.HTMLElement.prototype.scrollIntoView = () => {}
}
