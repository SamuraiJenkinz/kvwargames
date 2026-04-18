---
phase: 14-podcast-endpoint-player
plan: "02"
subsystem: ui
tags: [zustand, vitest, jsdom, sse, fetch, readablestream, blob-url, fsm, mp3]

# Dependency graph
requires:
  - phase: 13-firewall-spike-mockable-backend-foundation
    provides: FakeTTSProvider contract + TTSProvider abstraction established
  - phase: 14-podcast-endpoint-player
    plan: "01"
    provides: Backend SSE contract (POST /api/debrief/podcast + GET /api/debrief/podcast/audio?token=)
provides:
  - podcastClient.ts — generatePodcast() SSE consumer + parseSSEStream helper
  - podcastStore.ts — Zustand FSM (idle→generating→done|error) + blob URL lifecycle
  - mp3Filename.ts — local-time MP3 filename builder + toKebabFilenameStrict
  - wordCountEstimate.ts — estimateAudioMinutes, estimateGenerationSeconds, WORD_COUNT_SOFT_CEILING, extractPersonaTexts
  - Extended src/test/setup.ts with HTMLMediaElement + URL.createObjectURL mocks for plan 14-03
affects:
  - 14-03 (podcast player UI component subscribes to usePodcastStore + calls startGeneration/cancel/reset)
  - 15-01 (graceful degradation — store error path exercised when ElevenLabs key is garbage)
  - 16-01 (live ElevenLabs path reuses same client/store surface without changes)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Zustand standalone store (not gameStore slice) — avoids polluting 700-line gameStore"
    - "fetch+ReadableStream SSE parsing (NOT EventSource) — enables POST bodies per SC4"
    - "Blob URL revoke-before-create invariant — enforced in startGeneration and reset"
    - "Four-state FSM with silent AbortError path — idle/generating/done/error"

key-files:
  created:
    - src/lib/mp3Filename.ts
    - src/lib/mp3Filename.test.ts
    - src/lib/wordCountEstimate.ts
    - src/lib/wordCountEstimate.test.ts
    - src/lib/podcastClient.ts
    - src/lib/podcastClient.test.ts
    - src/lib/podcastStore.ts
    - src/lib/podcastStore.test.ts
  modified:
    - src/test/setup.ts

key-decisions:
  - "fetch+ReadableStream over EventSource — EventSource lacks POST body support (SC4 reconciliation)"
  - "Separate usePodcastStore (not gameStore slice) — keeps 700-line gameStore clean; podcast state has its own lifecycle"
  - "Local time in buildMp3Filename — facilitators in non-UTC zones expect local timestamps in filenames"
  - "Session fallback in toKebabFilenameStrict (not 'game') — semantically cleaner for MP3 context"
  - "cached boolean retained in store for testability but not surfaced in UI — speed is the feedback"
  - "Pre-existing 37 lint errors are not regressions from this plan — confirmed via git stash baseline"

patterns-established:
  - "SSE consumer pattern: fetch → ReadableStream → decoder → lastSep buffer splitting → parseSSEStream"
  - "Zustand test pattern: vi.mock('@/lib/podcastClient'), usePodcastStore.setState for injection, act() wrapping"
  - "Blob URL lifecycle invariant: revokeObjectURL(prev) always called before URL.createObjectURL"

# Metrics
duration: ~12min
completed: 2026-04-18
---

# Phase 14 Plan 02: Podcast Frontend Data Layer Summary

**SSE-consuming podcastClient + Zustand FSM store + local-time MP3 filename + word-count estimators shipping the full frontend data layer for the podcast UX, closing PODGEN-06/07/08 and PODUX-03**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-18T08:19:00Z
- **Completed:** 2026-04-18T08:22:00Z
- **Tasks:** 3
- **Files modified:** 9 (8 created + 1 modified)

## Accomplishments

- Four library modules with clean export surfaces and zero new runtime dependencies
- 47 new tests (25 utility + 11 podcastClient + 11 podcastStore) — total suite grew from 537 → 584
- Extended jsdom harness (`src/test/setup.ts`) with HTMLMediaElement stubs and URL mock so plan 14-03 can mount `<audio>` elements without fighting jsdom
- Blob URL lifecycle invariant: `revokeObjectURL(prev)` is always called before a new blobUrl is set in both `startGeneration` and `reset`
- AbortError silently resets to idle — no partial MP3 surfaced, no error toast

## Task Commits

Each task was committed atomically:

1. **Task 1: Pure utility modules — mp3Filename + wordCountEstimate** - `0710704` (feat)
2. **Task 2: podcastClient SSE consumer + extended test setup harness** - `f86b27c` (feat)
3. **Task 3: podcastStore Zustand FSM + blob URL lifecycle + cache/regenerate wiring** - `e6374de` (feat)

## 14-02 → 14-03 Contract

Plan 14-03 (podcast player UI) subscribes to and calls the following:

| Store getter | Used for |
|---|---|
| `status` | Show generating/done/error states |
| `personaProgress` | Per-persona progress indicators |
| `blobUrl` | Feed into `<audio src>` |
| `offsets` | Seek to persona-specific timestamps |
| `activePersona` | Highlight active persona tab |
| `wordCount` | Word-count confirmation dialog |
| `generatedAt` | Build MP3 download filename via `buildMp3Filename` |
| `error` | Show error message + retry |

| Store action | Triggered by |
|---|---|
| `startGeneration({gameName, personaTexts, voices})` | Generate button click |
| `startGeneration({..., forceFresh: true})` | Regenerate button (after confirmation dialog) |
| `cancel()` | Cancel button during generating |
| `setActivePersona(p)` | Persona tab click |
| `reset()` | Dismiss error or close player |

Word-count confirmation dialog uses `estimateAudioMinutes(wordCount)`, `estimateGenerationSeconds()`, and `WORD_COUNT_SOFT_CEILING` from `wordCountEstimate.ts`.

## FSM Diagram

```
idle ──startGeneration()──▶ generating ──success──▶ done
 ▲                              │                    │
 │                         AbortError               reset()
 │                              │                    │
 └──────────────────────────────┘◀───────────────────┘
 
generating ──PodcastGenerationError──▶ error ──reset()──▶ idle
```

## Files Created/Modified

- `src/lib/mp3Filename.ts` — `buildMp3Filename` (local time) + `toKebabFilenameStrict` ('session' fallback)
- `src/lib/mp3Filename.test.ts` — 8 tests covering local time, kebab edge cases, UTC divergence
- `src/lib/wordCountEstimate.ts` — `estimateAudioMinutes`, `estimateGenerationSeconds`, `WORD_COUNT_SOFT_CEILING`, `extractPersonaTexts`, `countDebriefWords`
- `src/lib/wordCountEstimate.test.ts` — 13 tests covering 150 wpm boundary, 3× multiplier, debrief filtering
- `src/lib/podcastClient.ts` — `generatePodcast()` (fetch+ReadableStream SSE), `parseSSEStream`, `PodcastGenerationError`
- `src/lib/podcastClient.test.ts` — 11 tests covering happy path, chunk splits, abort, error event, missing done, force_fresh, non-200
- `src/lib/podcastStore.ts` — `usePodcastStore` with 4-state FSM, blob URL lifecycle, persona progress chain
- `src/lib/podcastStore.test.ts` — 11 tests covering full lifecycle, blobUrl revocation, cancel, all error paths
- `src/test/setup.ts` — Extended with HTMLMediaElement load/play/pause stubs + URL.createObjectURL/revokeObjectURL mocks

## Decisions Made

- **fetch+ReadableStream over EventSource** — EventSource does not support POST bodies; the podcast endpoint requires a POST body with persona texts, voices, and game name. Matches SC4 reconciliation decision in plan frontmatter.
- **Separate usePodcastStore** — podcast generation/playback state has its own lifecycle distinct from game state; keeping it out of the 700-line gameStore prevents coupling and simplifies future removal.
- **Local time in mp3Filename** — `toISOString()` (UTC) would give AEST facilitators an "0500" timestamp when they clicked at "1500"; `getHours()` / `getMinutes()` respect the user's locale.
- **'session' fallback** — distinct from debriefExporter.ts which returns 'game'; semantically correct for the MP3 context.
- **Pre-existing lint errors not regressions** — confirmed 37 errors existed before this plan via `git stash` baseline; no new lint errors introduced.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- ESLint reported 37 errors in pre-existing files (non-null assertions, missing react-hooks plugin). Verified via `git stash` baseline: all 37 errors existed before this plan. Zero new lint errors introduced by plan 14-02.

## Next Phase Readiness

- Plan 14-03 can import `usePodcastStore`, `buildMp3Filename`, and `estimateAudioMinutes` directly and mount the podcast player UI
- `src/test/setup.ts` is extended so `<audio>` element tests in plan 14-03 work on jsdom out of the box
- No blockers; all 584 frontend tests passing

---
*Phase: 14-podcast-endpoint-player*
*Completed: 2026-04-18*
