---
phase: 14-podcast-endpoint-player
status: passed
verified_at: 2026-04-18
score: 6/6
---

# Phase 14 Verification: Podcast Endpoint + Player (End-to-End on Fake)

**Goal:** A facilitator sitting at the app can click Generate Podcast after a full game and — with `TTS_PROVIDER=fake` — hear a three-voice stitched MP3 play inline, download it with the correct filename, skip between persona segments, see a progress indicator update, cancel mid-generation, and re-generate from cache or force a fresh run, all without any live ElevenLabs traffic.

**Verdict:** PASSED. All six must-haves verified against actual codebase + empirical human verification on dev server.

## Must-Haves

### SC1 — Generate Podcast button + paused audio element
- `src/components/game/FacilitatorInput/ActionToolbar.tsx:170-179` — button renders conditionally on `hasDebrief && podcastStatus === 'idle'`, adjacent to Download Debrief button at line 153.
- `src/components/game/Podcast/PodcastPlayer.tsx:77-81` — `<audio controls>` element with no `autoplay` attribute; `src` is set imperatively via `useEffect` with `audio.load()` only — paused by default.
- `src/components/game/FacilitatorInput/FacilitatorInput.tsx:33` — `<PodcastSection />` mounted between `<ActionToolbar>` and `<MessageInput>`.
- Human-verified on dev server 2026-04-18.

### SC2 — MP3 filename format + stitch order + 700ms silence + no leading/trailing pad
- `src/lib/mp3Filename.ts:34-39` — `buildMp3Filename()` uses `getFullYear/getMonth/getDate/getHours/getMinutes` (local time, NOT `toISOString`); `toKebabFilenameStrict()` fallback is `'session'`.
- `backend/app/services/audio_generator.py:44-45` — `stitch()` = `kent + SILENCE_BYTES + finch + SILENCE_BYTES + chen`, no leading or trailing pad.
- `backend/app/services/tts/fixtures/silence_700ms.mp3` — committed 11,702-byte binary (`MPEG ADTS layer III v1 128kbps 44.1kHz Monaural`).
- Human-verified: Downloaded file `debrief-edip-security-of-supply-wargame-2026-04-1...` plays in VLC with three distinct tones (220/440/660 Hz) separated by silence.

### SC3 — Skip buttons + "Now playing" label
- `src/components/game/Podcast/PodcastPlayer.tsx:57-61` — `handleSkip()` sets `audioRef.current.currentTime = offsets[index]` and calls `setActivePersona(key)`.
- `src/components/game/Podcast/PodcastPlayer.tsx:40-51` — `timeupdate` listener walks offsets in reverse (`>= offsets[2]` → chen, `>= offsets[1]` → finch, else kent) and calls `setActivePersona`.
- `src/components/game/Podcast/PodcastPlayer.tsx:67-73` — "Now playing: {activeMeta.displayName}" label rendered from `PERSONA_META[activePersona]`.
- Human-verified: Label transitions Kent → Finch → Chen on natural playback and on skip-button clicks; active button highlights amber.

### SC4 — Per-persona status, progress bar, Cancel, word-count dialog
- `src/components/game/Podcast/GenerationPanel.tsx:12-50` — `PersonaStatusRow` renders done/rendering/waiting states per persona.
- `src/components/game/Podcast/GenerationPanel.tsx:63-95` — discrete progress bar (`pct = doneCount/3 * 100`); Cancel button calls `store.cancel()`.
- `src/lib/podcastStore.ts:116-127` — AbortError path resets FSM to `idle` with `blobUrl: null`, `offsets: null`, `error: null` — no partial MP3 offered.
- `src/lib/wordCountEstimate.ts:4` — `WORD_COUNT_SOFT_CEILING = 2000`.
- `src/components/game/FacilitatorInput/ActionToolbar.tsx:58-62` — word count checked BEFORE any `startPodcast` call; triggers `WordCountConfirmDialog`.

### SC5 — Cache hit + Re-generate with confirmation
- `backend/app/services/audio_generator.py:158-176` — cache-hit fast path emits all three `persona_done` events then `done` with `cached: true`, zero provider calls.
- `src/components/game/FacilitatorInput/ActionToolbar.tsx:188-197` — "Re-generate" button opens `RegenerateConfirmDialog`; only calls `handleGenerate(true)` after confirmation.
- `backend/app/services/audio_generator.py:179-180` — `force_fresh=True` calls `cache.invalidate(key)` before synthesis.

### SC6 — Collapsible transcript panel, no new markdown dependency
- `src/components/game/Podcast/TranscriptPanel.tsx:15` — `useState(false)`, collapsed by default.
- `src/components/game/Podcast/TranscriptPanel.tsx:43` — renders `generateMarkdown()` inside a `<pre>` block via existing `generateDebriefMarkdown()` — no new library.
- `package.json` unchanged through Phase 14 (last modified `feat(05-07)`). No new dependencies added.

## Test Results

- Backend: **125/125 passed** (`cd backend && pytest tests/ -x`)
- Frontend: **608/608 passed** (`npx vitest run`)

## Orchestrator Correction During Execution

**Commit `2c79de0` — `fix(14-03): use debrief_divider as extractPersonaTexts boundary`**

Root cause: `extractPersonaTexts` filtered persona messages on `m.isDebrief`, but `gameStore.buildPersonaMessage` never sets that flag — only the `debrief_divider` message does. Under real runtime, all three persona texts resolved to `''`, backend rejected POST with 400 Bad Request (`pydantic min_length=1`).

Fix: Anchor on the LAST `debrief_divider` and collect persona messages after it. Matches actual runtime shape of the message log. Tests updated; multi-divider case added.

Discovered during the 14-03 human-verify checkpoint; fixed and verified before approval.

## Known Cosmetic Quirk (Not a Gap)

**WMP reports 11s duration; Chrome and VLC report correct 16s.**

Cause: raw-bytes stitch preserves the Xing/VBRI header of the first segment, which encodes only that segment's frame count. WMP reads the header only; Chrome and VLC scan all frames.

Impact: Full audio plays end-to-end in all players. Display-only artifact. Consistent with the Phase 14 architectural decision to use raw-bytes concat (no `pydub`/`ffmpeg` dependency). Documented in `14-03-SUMMARY.md` as expected outcome.
