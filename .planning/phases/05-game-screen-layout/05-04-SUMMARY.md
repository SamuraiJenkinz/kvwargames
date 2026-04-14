---
phase: 05-game-screen-layout
plan: 04
subsystem: ui
tags: [react, tailwind-v4, zustand, typescript, lucide-react]

# Dependency graph
requires:
  - phase: 05-01
    provides: MOCK_MESSAGES and MOCK_GAME_STATE for test seeding
  - phase: 05-02
    provides: PERSONA_META, PERSONA_ORDER, getPersonasThisRound for persona attribution and loading speaker logic
  - phase: 05-03
    provides: GameScreen three-column shell, --animate-message-in and --animate-blink CSS tokens, ChatFeed stub slot

provides:
  - useStickyBottomScroll hook (containerRef, sentinelRef, showPill, handleScroll, scrollToBottom)
  - PersonaMessage: avatar circle + tinted bubble with 2px persona-colour left border
  - FacilitatorMessage: right-aligned no-avatar bubble with FACILITATOR label
  - RoundDivider: horizontal rule with centered mono label
  - DebriefDivider: amber persona-finch horizontal rule
  - ErrorMessage: full-width red banner with AlertCircle icon
  - LoadingIndicator: persona-attributed three-dot blink bubble
  - NewMessagePill: floating ChevronDown scroll-to-bottom button
  - ChatFeed container: subscribes to messages + loading, maps all 5 MessageTypes, computes loading speaker

affects:
  - 05-05 (ReferencePanel and StatePanel tests co-located in same game screen)
  - 05-06 (FacilitatorInput wires into same store messages + loading)
  - 06 (LLM wiring: real messages flow through same ChatFeed renderers)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pre-baked Tailwind class strings in PERSONA_META.bubbleClass — avoids runtime template-literal generation which Tailwind v4 purges"
    - "useStickyBottomScroll hook encapsulates scroll-sticky pattern with useLayoutEffect for pre-paint sync"
    - "Loading indicator is UI-only state (store.loading bool), not a ChatMessage entry — keeps message array clean"
    - "getLoadingSpeaker: first persona in PERSONA_ORDER absent from getPersonasThisRound — gives plausible next-speaker attribution"
    - "scrollIntoView stubbed in test setup.ts for jsdom — pattern for all scroll-reliant component tests"

key-files:
  created:
    - src/hooks/useStickyBottomScroll.ts
    - src/components/game/ChatFeed/PersonaMessage.tsx
    - src/components/game/ChatFeed/FacilitatorMessage.tsx
    - src/components/game/ChatFeed/RoundDivider.tsx
    - src/components/game/ChatFeed/DebriefDivider.tsx
    - src/components/game/ChatFeed/ErrorMessage.tsx
    - src/components/game/ChatFeed/LoadingIndicator.tsx
    - src/components/game/ChatFeed/NewMessagePill.tsx
    - src/components/game/ChatFeed/ChatFeed.test.tsx
  modified:
    - src/components/game/ChatFeed/ChatFeed.tsx (replaced stub)
    - src/test/setup.ts (scrollIntoView mock added in 05-05 companion fix)

key-decisions:
  - "No cn/clsx utility exists in project — Array.join(' ') used for conditional class concatenation in renderers"
  - "scrollIntoView not implemented in jsdom — stubbed via beforeEach in test file; 05-05 moved stub to setup.ts for global coverage"
  - "DEBRIEF amber class assertion uses querySelectorAll to find all .text-persona-finch elements and checks array contains 'DEBRIEF' — avoids fragile first-match assumption when Finch messages also carry the class"
  - "getLoadingSpeaker defined as module-level pure function (not hook) — takes messages array directly, no store subscription needed"

patterns-established:
  - "Message renderer: standalone default-export component, single ChatMessage prop, no store subscription"
  - "Persona lookup: PERSONA_META[speaker as PersonaId] — one-line meta access in both PersonaMessage and LoadingIndicator"
  - "All entrance animations: animate-[messageIn_180ms_ease-out_both] motion-reduce:animate-none on outermost div"
  - "All persona colours: textClass/colorClass/bubbleClass from PERSONA_META — zero hardcoded hex in components"

# Metrics
duration: 4min
completed: 2026-04-14
---

# Phase 5 Plan 04: ChatFeed Summary

**Full ChatFeed center column: sticky-bottom auto-scroll hook, 5 MessageType renderers + LoadingIndicator + NewMessagePill, all persona-attributed via pre-baked PERSONA_META class strings**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-14T11:14:14Z
- **Completed:** 2026-04-14T11:18:22Z
- **Tasks:** 2
- **Files modified:** 10 (9 created, 1 replaced stub)

## Accomplishments
- Built `useStickyBottomScroll` hook: sticky-bottom with `useLayoutEffect` pre-paint scroll, `showPill` escape-hatch, prefers-reduced-motion aware
- Built all 7 sub-components: PersonaMessage, FacilitatorMessage, RoundDivider, DebriefDivider, ErrorMessage, LoadingIndicator, NewMessagePill — each standalone, no store subscription
- ChatFeed container replaces stub: subscribes to `messages` + `loading`, computes `loadingSpeaker` via `getPersonasThisRound` (chen default for Round 2 mock state), maps all 5 MessageTypes, renders scroll sentinel as last child
- 15 tests pass covering every renderer type, loading toggle, chen attribution, and sentinel position

## Task Commits

Each task was committed atomically:

1. **Task 1: Auto-scroll hook + all 7 message renderers** - `81045d8` (feat)
2. **Task 2: ChatFeed container + tests** - `63722ab` (feat — committed as part of 05-05 batch which also staged these files)

**Plan metadata:** pending (docs commit below)

## Files Created/Modified
- `src/hooks/useStickyBottomScroll.ts` — Generic sticky-bottom hook with pill escape-hatch
- `src/components/game/ChatFeed/ChatFeed.tsx` — Store-subscribed feed container (replaced stub)
- `src/components/game/ChatFeed/ChatFeed.test.tsx` — 15 tests (all pass)
- `src/components/game/ChatFeed/PersonaMessage.tsx` — Avatar + tinted bubble per PERSONA_META
- `src/components/game/ChatFeed/FacilitatorMessage.tsx` — Right-aligned FACILITATOR bubble
- `src/components/game/ChatFeed/RoundDivider.tsx` — Centered mono label on horizontal rule
- `src/components/game/ChatFeed/DebriefDivider.tsx` — Amber persona-finch horizontal rule
- `src/components/game/ChatFeed/ErrorMessage.tsx` — Red banner with AlertCircle icon
- `src/components/game/ChatFeed/LoadingIndicator.tsx` — Persona-attributed three-dot blink bubble
- `src/components/game/ChatFeed/NewMessagePill.tsx` — Floating ChevronDown scroll pill

## Decisions Made
- No `cn`/`clsx` utility in project — used `Array.join(' ')` for conditional class concatenation
- `getLoadingSpeaker` is a module-level pure function (not a hook) — takes messages array, returns first PERSONA_ORDER member absent from `getPersonasThisRound` set, defaults to `'chen'`
- `scrollIntoView` is not implemented in jsdom — stubbed via `beforeEach` in ChatFeed.test.tsx; 05-05 moved this to `src/test/setup.ts` for all tests globally
- DEBRIEF amber class assertion uses `querySelectorAll` + array check — avoids fragile first-match when Finch persona name spans also carry `text-persona-finch`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] scrollIntoView not implemented in jsdom**
- **Found during:** Task 2 (ChatFeed tests)
- **Issue:** `useStickyBottomScroll` calls `sentinelRef.current.scrollIntoView()` in `useLayoutEffect` on mount — jsdom throws "scrollIntoView is not a function" causing all 15 tests to fail
- **Fix:** Added `window.HTMLElement.prototype.scrollIntoView = vi.fn()` in `beforeEach` of ChatFeed.test.tsx; 05-05 execution then moved this to `src/test/setup.ts` for global coverage
- **Files modified:** `src/components/game/ChatFeed/ChatFeed.test.tsx`, `src/test/setup.ts`
- **Verification:** All 15 ChatFeed tests pass; full suite 176/176 pass
- **Committed in:** `63722ab`

**2. [Rule 1 - Bug] DEBRIEF amber class assertion selected wrong element**
- **Found during:** Task 2 (ChatFeed tests — 1 test failing after scrollIntoView fix)
- **Issue:** `container.querySelector('.text-persona-finch')` returned the Finch PersonaMessage name span (first in DOM) rather than the DebriefDivider label — `textContent` was 'Finch' not 'DEBRIEF'
- **Fix:** Changed assertion to `querySelectorAll` + `Array.from().map(textContent)` and checked `toContain('DEBRIEF')`
- **Files modified:** `src/components/game/ChatFeed/ChatFeed.test.tsx`
- **Verification:** Test passes; DEBRIEF label confirmed in amber elements list
- **Committed in:** `63722ab`

---

**Total deviations:** 2 auto-fixed (2× Rule 1 bugs)
**Impact on plan:** Both fixes necessary for correct test operation. No scope creep.

## Issues Encountered
- `ChatFeed.test.tsx` and `ChatFeed.tsx` were staged and committed in the same commit (`63722ab`) as the companion 05-05 execution — this is because both executions ran concurrently. The files' content is correct and all tests pass.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- ChatFeed column fully implemented; all 5 MessageTypes render from mock state
- `useStickyBottomScroll` hook reusable for any scrolling column
- Phase 5 Wave 2 can proceed with 05-05 (ReferencePanel) and 05-06 (FacilitatorInput)
- Phase 6 (LLM wiring): real persona messages will flow through the same PersonaMessage renderer — no changes needed to renderers

---
*Phase: 05-game-screen-layout*
*Completed: 2026-04-14*
