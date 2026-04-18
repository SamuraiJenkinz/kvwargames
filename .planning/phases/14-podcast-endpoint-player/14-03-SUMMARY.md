---
phase: 14-podcast-endpoint-player
plan: "03"
subsystem: ui
tags: [react, vitest, zustand, audio, sse, dialog, tailwind, lucide, html5-audio]

# Dependency graph
requires:
  - phase: 14-podcast-endpoint-player
    plan: "01"
    provides: POST /api/debrief/podcast SSE endpoint + GET /api/debrief/podcast/audio?token=
  - phase: 14-podcast-endpoint-player
    plan: "02"
    provides: usePodcastStore FSM + podcastClient + buildMp3Filename + wordCountEstimate + extractPersonaTexts + extended jsdom harness

provides:
  - ConfirmDialog.tsx — shared modal primitive (overlay + card + escape dismiss + backdrop click)
  - WordCountConfirmDialog.tsx — word-count gate dialog (audio minutes + generation seconds)
  - RegenerateConfirmDialog.tsx — force-fresh confirmation dialog
  - GenerationPanel.tsx — per-persona status rows (waiting/rendering/done) + discrete 0/33/66/100% progress bar + Cancel button + error banner
  - PodcastPlayer.tsx — NowPlayingLabel + <audio controls> (no autoplay) + SkipButtonRow + TranscriptPanel + timeupdate segment-boundary detection
  - TranscriptPanel.tsx — collapsible transcript toggle + generateDebriefMarkdown rendered in <pre>
  - PodcastSection.tsx — status-gated orchestrator (idle→null, generating/error→GenerationPanel, done→PodcastPlayer)
  - ActionToolbar.tsx — extended with Generate Podcast / Download MP3 + Re-generate three-state button row + both confirm dialogs
  - FacilitatorInput.tsx — <PodcastSection /> mounted between ActionToolbar and MessageInput
  - E2E human verification: SC1..SC6 all confirmed with TTS_PROVIDER=fake + FAKE_TTS_DELAY_SECONDS=0.5

affects:
  - 15-01 (graceful degradation exercises error path in GenerationPanel + store)
  - 15-02 (health endpoint UI consumes same TTS status surface)
  - 16-01 (live ElevenLabs provider — same UI surface, no component changes expected)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Imperative audio src pattern — useEffect sets audioRef.current.src = blobUrl; audioRef.current.load() to avoid React reconciler racing the blob URL"
    - "timeupdate segment-boundary detection — walk offsets[] backwards to find active persona from audio.currentTime"
    - "Overlay dialog without <dialog> element — plain div with role=dialog + aria-modal=true; jsdom <dialog> support is patchy"
    - "Discrete progress bar derived from personaProgress done count — 0/33/66/100% via count/3 × 100"
    - "extractPersonaTexts anchored on last debrief_divider — collects persona messages after the final divider, not on isDebrief flag"

key-files:
  created:
    - src/components/game/Podcast/ConfirmDialog.tsx
    - src/components/game/Podcast/WordCountConfirmDialog.tsx
    - src/components/game/Podcast/RegenerateConfirmDialog.tsx
    - src/components/game/Podcast/GenerationPanel.tsx
    - src/components/game/Podcast/PodcastPlayer.tsx
    - src/components/game/Podcast/PodcastPlayer.test.tsx
    - src/components/game/Podcast/TranscriptPanel.tsx
    - src/components/game/Podcast/PodcastSection.tsx
    - src/components/game/Podcast/PodcastSection.test.tsx
  modified:
    - src/components/game/FacilitatorInput/ActionToolbar.tsx
    - src/components/game/FacilitatorInput/ActionToolbar.test.tsx
    - src/components/game/FacilitatorInput/FacilitatorInput.tsx

key-decisions:
  - "extractPersonaTexts must anchor on last debrief_divider message, not on m.isDebrief flag — gameStore.buildPersonaMessage never sets isDebrief; only the divider message carries that semantic boundary"
  - "No autoplay on <audio> element (PODPLAY-01) — load in paused state; user explicitly hits Play"
  - "MP3 duration metadata quirk: raw-bytes stitching causes Windows Media Player to report duration from first frame header only; Chrome/VLC scan all frames and report correct duration — documented as expected outcome of no-pydub/ffmpeg decision"
  - "Blob URL not revoked on Download MP3 click — store owns lifecycle; premature revoke breaks replay"
  - "No <dialog> element — plain div overlay; jsdom support for <dialog> is patchy and adds focus-trap complexity"

patterns-established:
  - "Podcast dialog pattern: ConfirmDialog primitive wraps title + body + primaryLabel/secondaryLabel + onPrimary/onSecondary; two thin wrappers (WordCount, Regenerate) inject domain-specific text"
  - "PodcastSection gating: idle→null, generating|error→GenerationPanel, done+blobUrl→PodcastPlayer"
  - "timeupdate listener invariant: return () => audio.removeEventListener('timeupdate', onTimeUpdate) in cleanup"

# Metrics
duration: ~2 sessions (tasks 1–2 automated; task 3 human-verify checkpoint with orchestrator correction)
completed: 2026-04-18
---

# Phase 14 Plan 03: Podcast UI Components Summary

**Seven React components wiring GenerationPanel, PodcastPlayer with skip/now-playing, TranscriptPanel, and two confirm dialogs to the SSE backend via usePodcastStore — SC1..SC6 verified end-to-end with FakeTTSProvider, 608 frontend tests green**

## Performance

- **Duration:** ~2 sessions (automated tasks + checkpoint + orchestrator correction)
- **Started:** 2026-04-18
- **Completed:** 2026-04-18
- **Tasks:** 3 (2 automated + 1 human-verify checkpoint)
- **Files modified:** 12 (9 created, 3 modified)

## Accomplishments

- Shipped the complete podcast visible surface: toolbar button set, generation panel with per-persona live progress, audio player with skip/now-playing label, collapsible transcript, and two confirmation dialogs
- Wired ActionToolbar → podcastStore → backend SSE endpoint → GenerationPanel → PodcastPlayer with zero new runtime dependencies
- Discovered and fixed `extractPersonaTexts` root cause: function anchored on `isDebrief` flag which `buildPersonaMessage` never sets; reanchored on last `debrief_divider` message
- All Phase 14 requirements closed: PODGEN-01, PODGEN-06 (UX), PODGEN-07 (UX), PODGEN-08, PODPLAY-01..05, PODUX-01..03
- Human checkpoint approved: SC1..SC6 all confirmed by facilitator running a full Scenario 1 game with TTS_PROVIDER=fake

## Task Commits

Each task was committed atomically:

1. **Task 1: Dialog primitives + GenerationPanel + ActionToolbar button swap + dialog tests** - `e7cc230` (feat)
2. **Task 2: PodcastPlayer + TranscriptPanel + PodcastSection orchestrator + FacilitatorInput mount** - `7bc7abd` (feat)
3. **Task 3: End-to-end human verification** — Checkpoint approved (no new commit for checkpoint approval itself)

**Orchestrator correction (post-task-2, pre-checkpoint):** `2c79de0` (fix) — extractPersonaTexts debrief_divider boundary

**Plan metadata:** (docs commit follows this summary)

## Human Verification Results (SC1..SC6)

All scenarios verified with `TTS_PROVIDER=fake` + `FAKE_TTS_DELAY_SECONDS=0.5`, Chrome browser, VLC for MP3 playback.

| Scenario | Description | Result |
|---|---|---|
| SC1 | Generate Podcast button adjacent to Download Debrief (.md); GenerationPanel per-persona progression; audio element renders paused | Confirmed |
| SC2 | Download MP3 saves with kebab-local-timestamp filename; plays in VLC with three distinct tones Kent→Finch→Chen order | Confirmed |
| SC3 | Now-playing label changes as playback progresses; skip buttons seek correctly; active-state amber highlight | Confirmed |
| SC4 | Word-count dialog shows two numbers; Cancel dismisses; GenerationPanel progress 0→33→66→100%; Cancel resets to idle | Confirmed |
| SC5 | Re-generate button opens confirmation dialog; cache-hit path proven via 14-01 backend tests | Confirmed |
| SC6 | Transcript panel collapsed by default; Show/Hide transcript toggle; renders markdown debrief in `<pre>` | Confirmed |

## Files Created/Modified

- `src/components/game/Podcast/ConfirmDialog.tsx` — Shared modal primitive: fixed overlay, centered card, Escape key dismiss, backdrop click dismiss, no `<dialog>` element
- `src/components/game/Podcast/WordCountConfirmDialog.tsx` — Wraps ConfirmDialog; shows estimated audio minutes + generation seconds; "Generate Podcast" title
- `src/components/game/Podcast/RegenerateConfirmDialog.tsx` — Wraps ConfirmDialog; shows current audio will be replaced + seconds estimate; "Re-generate Podcast" title
- `src/components/game/Podcast/GenerationPanel.tsx` — Three PersonaStatusRows (waiting/rendering/done states) + discrete progress bar + Cancel button + error banner with Dismiss
- `src/components/game/Podcast/PodcastPlayer.tsx` — NowPlayingLabel + `<audio controls>` (no autoplay) + SkipButtonRow (Kent/Finch/Chen) + timeupdate listener + TranscriptPanel
- `src/components/game/Podcast/PodcastPlayer.test.tsx` — 10 tests: audio src, controls attr, no autoplay, NowPlayingLabel, skip buttons, currentTime seek, setActivePersona call, active styling, timeupdate→activePersona, unmount cleanup
- `src/components/game/Podcast/TranscriptPanel.tsx` — Collapsed-by-default toggle + `generateDebriefMarkdown` rendered in `<pre className="whitespace-pre-wrap">`, no new markdown dependency
- `src/components/game/Podcast/PodcastSection.tsx` — Status-gated orchestrator: idle→null, generating|error→GenerationPanel, done+blobUrl→PodcastPlayer; wrapped in `<section data-testid="podcast-section">`
- `src/components/game/Podcast/PodcastSection.test.tsx` — 5 gating tests: idle null, generating→panel, error→panel, done+url→player, done+no-url null
- `src/components/game/FacilitatorInput/ActionToolbar.tsx` — Extended with three-state podcast button row (idle→Generate, done→Download MP3+Re-generate) + WordCountConfirmDialog + RegenerateConfirmDialog mounts
- `src/components/game/FacilitatorInput/ActionToolbar.test.tsx` — Extended with ~8 tests: button visibility gating, short/long debrief paths, dialog open/close, Download MP3 anchor, Re-generate confirm
- `src/components/game/FacilitatorInput/FacilitatorInput.tsx` — Added `<PodcastSection />` between ActionToolbar and MessageInput

## Decisions Made

**D1: extractPersonaTexts anchored on last debrief_divider**
`gameStore.buildPersonaMessage` never sets `m.isDebrief = true` on individual persona messages — only the `debrief_divider` message carries that semantic boundary. The original implementation filtered on `m.isDebrief`, returning all-empty texts, which caused the backend POST to fail with 400 (pydantic min_length=1). Fix: find the index of the last `debrief_divider` in `messages`, then collect all persona messages after it. Tests updated to cover single-divider, multi-divider, and no-divider cases.

**D2: No autoplay on `<audio>` element (PODPLAY-01)**
Audio element is loaded via `useEffect(() => { audioRef.current.src = blobUrl; audioRef.current.load() })` and explicitly not autoplay. Browser policy would suppress autoplay anyway, but the explicit absence is a regression-tested invariant.

**D3: Blob URL not revoked on Download MP3 click**
Revoking the blob URL on download click breaks subsequent replay of the audio element (the src becomes invalid). The store owns the blob URL lifecycle and revokes on the next `startGeneration` call or `reset()` — this is the correct ownership boundary. Documented in a code comment.

**D4: MP3 duration metadata display quirk (cosmetic, not blocking)**
Raw-bytes MP3 stitching without pydub/ffmpeg causes Windows Media Player to calculate duration from the first frame header only (e.g., 11s for a 16s file). Chrome and VLC scan all MPEG frames and report the correct duration. Full audio plays correctly end-to-end in all tested players. Documented as an expected outcome of the "no pydub/ffmpeg" decision made in Phase 13. Not a regression; does not affect playback.

**D5: No `<dialog>` element for confirm dialogs**
jsdom (Vitest's browser environment) has incomplete `<dialog>` implementation; `showModal()` is not supported. Using a plain `<div role="dialog" aria-modal="true">` overlay avoids the jsdom gap and keeps the component testable without `vi.mock`-ing the dialog API.

## Deviations from Plan

### Orchestrator-Corrected Issues

**1. [Discovery — Root Cause Bug] extractPersonaTexts returned empty texts → backend 400**
- **Found during:** Post-task-2 orchestrator run before checkpoint
- **Issue:** `wordCountEstimate.ts` `extractPersonaTexts` filtered `messages` on `m.isDebrief`. However, `gameStore.buildPersonaMessage()` never sets `isDebrief` on persona message objects — that flag only appears on the `debrief_divider` synthetic message. Result: all three persona texts were empty strings; backend pydantic schema rejected the POST with 400 (min_length=1 constraint on each text field).
- **Root cause:** Design mismatch between the `extractPersonaTexts` implementation assumption and how `gameStore.buildPersonaMessage` actually tags messages.
- **Fix:** Reanchored extraction on the last `debrief_divider` message — `findLastIndex(m => m.type === 'debrief_divider')`, then collect all `type === 'persona'` messages after it. Multi-divider edge case (scenario restarts) handled by taking the last divider.
- **Files modified:** `src/lib/wordCountEstimate.ts`, `src/lib/wordCountEstimate.test.ts`
- **Verification:** 608 frontend tests passing; SC1 confirmed (Generate Podcast button triggers generation without 400 error)
- **Committed in:** `2c79de0` (orchestrator correction commit, separate from task commits)

---

**Total deviations:** 1 orchestrator-corrected (root cause bug in extractPersonaTexts extraction logic)
**Impact on plan:** Fix was necessary to unblock E2E verification. No scope creep; all planned artifacts shipped unchanged.

## Issues Encountered

- **extractPersonaTexts empty-text 400 error** — See orchestrator correction above. Blocked the SC1 checkpoint until corrected by the orchestrator in commit `2c79de0`. Resolved before human verification ran.
- **Windows Media Player MP3 duration display** — See Decision D4. Cosmetic only; not blocking. VLC and Chrome display correct duration.

## User Setup Required

None — plan 14-03 is 100% mockable against FakeTTSProvider. No external credentials required.

## Next Phase Readiness

- **Phase 15 (graceful degradation):** GenerationPanel error banner is in place; `status === 'error'` path renders `error.code` + `error.message`. Phase 15 will empirically verify this path by flipping `ELEVENLABS_API_KEY` to garbage.
- **Phase 16 (live ElevenLabs):** No UI changes expected. Live provider swaps in via `get_tts_provider(settings)` in the backend; the React surface is provider-agnostic.
- **All 608 frontend tests passing; 125 backend tests passing.** No blockers.
- **Known cosmetic note:** MP3 duration display artifact in Windows Media Player is documented (D4 above) — not a Phase 15/16 concern.

---
*Phase: 14-podcast-endpoint-player*
*Completed: 2026-04-18*
