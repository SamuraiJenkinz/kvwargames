import { useCallback, useLayoutEffect, useRef, useState } from 'react'

interface Options {
  threshold?: number
}

/**
 * Sticky-bottom auto-scroll hook.
 *
 * When the scroll container is within `threshold` px of the bottom,
 * new content scrolls into view automatically (useLayoutEffect — pre-paint).
 * When the user has scrolled up, a pill appears; clicking it smooth-scrolls
 * back to the bottom (respects prefers-reduced-motion).
 *
 * Returns { containerRef, sentinelRef, showPill, handleScroll, scrollToBottom }
 */
export function useStickyBottomScroll<T>(
  dependencyList: T[],
  loading: boolean,
  opts: Options = {},
) {
  const threshold = opts.threshold ?? 100
  const containerRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [showPill, setShowPill] = useState(false)

  const isNearBottom = useCallback(() => {
    const el = containerRef.current
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight < threshold
  }, [threshold])

  const prefersReducedMotion = useCallback(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  const scrollToBottom = useCallback(
    (smooth: boolean) => {
      const behavior =
        smooth && !prefersReducedMotion() ? 'smooth' : 'instant'
      sentinelRef.current?.scrollIntoView({
        behavior: behavior as ScrollBehavior,
      })
      setShowPill(false)
    },
    [prefersReducedMotion],
  )

  // Auto-scroll on new message or loading toggle — synchronous pre-paint
  useLayoutEffect(() => {
    if (isNearBottom()) {
      scrollToBottom(false)
    } else {
      setShowPill(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dependencyList.length, loading])

  const handleScroll = useCallback(() => {
    if (isNearBottom()) setShowPill(false)
  }, [isNearBottom])

  return { containerRef, sentinelRef, showPill, handleScroll, scrollToBottom }
}
