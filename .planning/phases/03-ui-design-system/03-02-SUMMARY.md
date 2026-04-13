---
phase: 03-ui-design-system
plan: 02
subsystem: ui
tags: [tailwind-v4, design-tokens, google-fonts, scrollbar, css]
requires:
  - phase: 01-foundation
    provides: "Tailwind v4 CSS-first setup, @tailwindcss/vite plugin"
provides:
  - "Complete @theme token block with all design tokens"
  - "Google Fonts loading (Syne, DM Sans, IBM Plex Mono)"
  - "Custom scrollbar styles (3px thin)"
  - "Body base styles (dark bg, text color, font-family, antialiasing)"
affects: [03-ui-design-system, 04-setup-screen, 05-game-screen-layout]
tech-stack:
  added: []
  patterns: ["Tailwind v4 @theme for all design tokens", "@layer base for global styles", "Google Fonts via preconnect + link for non-blocking load"]
key-files:
  created: []
  modified: [src/styles/index.css, index.html]
key-decisions:
  - "Placed @keyframes blink inside @theme block alongside --animate-blink token — keeps animation definition co-located with its reference token"
  - "Used preconnect + stylesheet link in HTML (not CSS @import) — avoids render-blocking font load"
patterns-established:
  - "All hex values live exclusively inside @theme — components use utility classes, never hardcoded colors"
  - "@layer base applies global resets (scrollbar, body) using @theme CSS variables via var()"
duration: 1min
completed: 2026-04-13
---

# Plan 03-02: Tailwind v4 Tokens + Google Fonts Summary

**Extended index.css with 20 new design tokens (7 card categories, 3 crisis states, 2 track bars, 3 radii, 1 animation) and wired Google Fonts + custom scrollbar via @layer base.**

## Performance

- Duration: ~1 minute
- Build time: 137–138ms (unchanged from baseline)
- Token match count: 20 (target: ≥20)

## Accomplishments

- Added all 7 card category colors to @theme (`color-category-crisis` through `color-category-transfers`)
- Added all 3 crisis state colors (`color-crisis-none`, `color-crisis-supply`, `color-crisis-security`)
- Added 2 track bar colors (`color-track-severity`, `color-track-legitimacy`)
- Added 3 border radius tokens (`radius-sm: 2px`, `radius-md: 4px`, `radius-lg: 6px`)
- Added `--animate-blink` token with co-located `@keyframes blink` definition
- Added `@layer base` with 3px thin custom scrollbar styles (webkit + Firefox)
- Added `body` base styles: dark bg, primary text, DM Sans font, antialiasing
- Added Google Fonts preconnect links and stylesheet link to index.html
- All three fonts loaded: Syne (600/700/800), DM Sans (400/500/600), IBM Plex Mono (400/500)
- Build passes cleanly in 137ms with zero CSS errors

## Task Commits

1. Task 1: Complete @theme token block and @layer base styles — `148ffe9` (feat)
2. Task 2: Add Google Fonts preconnect and stylesheet links — `8a50004` (feat)

## Files Created/Modified

| File | Change | Key additions |
|------|--------|---------------|
| `src/styles/index.css` | Modified | +45 lines: 20 new tokens, @keyframes blink, @layer base block |
| `index.html` | Modified | +3 lines: preconnect x2, Google Fonts stylesheet link |

## Decisions Made

1. **@keyframes blink inside @theme** — Tailwind v4 supports @keyframes directly in @theme alongside the --animate-blink token. Keeps animation definition co-located with its reference.
2. **Google Fonts via HTML link, not CSS @import** — CSS @import blocks rendering until the stylesheet downloads. HTML preconnect + link tag allows parallel loading and is the Google Fonts recommended approach.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- 03-03 (Component Architecture) can proceed immediately — all utility classes are now resolvable: `bg-category-crisis`, `text-persona-kent`, `font-display`, `rounded-sm`, `animate-blink`
- 03-04 (Typography Scale) can use `font-display`, `font-body`, `font-mono` tokens as its foundation
- 04-setup-screen and 05-game-screen-layout have access to the full token vocabulary
