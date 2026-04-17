# Project Research Summary — v1.2 Debrief Podcast

**Project:** KV War Game Engine — v1.2 milestone (Debrief Podcast)
**Domain:** ElevenLabs three-voice MP3 generation layered onto a shipped FastAPI + React SPA
**Researched:** 2026-04-17
**Confidence:** HIGH

> This SUMMARY supersedes the earlier v1.0 summary (2026-04-13). v1.0 MVP and v1.1 hardening are both live in production; this document covers ONLY the additions needed for the v1.2 Debrief Podcast milestone. Base-stack decisions (Python 3.11 / FastAPI 0.135.x / React 19 / Vite 6 / Zustand 5 / Tailwind 4) are locked and not re-evaluated here.

## Executive Summary

v1.2 converts the already-existing end-of-session debrief into a three-voice (Kent -> Finch -> Chen) MP3 podcast with an inline HTML5 player and download button in the debrief panel. The critical insight that shapes every downstream choice: **the three persona "scripts" already exist as `isDebrief: true` messages in `messages[]` — there is no new LLM call in v1.2.** Every prompt, every token-budget assertion, and every context-window invariant from v1.1 stays bit-identical. v1.2 is purely a post-LLM TTS + stitching pipeline plus a small React player.

The prescribed approach is minimal-surface-area: two new backend dependencies (`elevenlabs==2.43.0`, `num2words>=0.5.13,<0.6`), one new router (`/api/debrief/podcast` returning blocking `audio/mpeg`), one new health endpoint (`/api/health/tts` in parallel to the v1.1 LLM probe), one new Zustand slice owning a store-scoped blob-URL lifecycle, and one new React `PodcastPlayer` component adjacent to the existing `Download Debrief (.md)` button. MP3 stitching is done with **raw Python `bytes` concatenation** (all ElevenLabs segments share `mp3_44100_128` CBR — frames are self-contained at this setting) plus a 500ms pre-generated silence-pad MP3 committed to the repo. This deliberately avoids `pydub`, `ffmpeg`, `ffmpeg-python`, and `mutagen` — no system-level binary dependency, no subprocess fragility on Windows scheduled-task deployment, no decode/re-encode fidelity loss.

Top risks cluster around ElevenLabs operational characteristics rather than the stack itself: free-tier character quota burn during dev (mitigated by a `FakeTTSProvider` ABC that defaults in dev), corporate firewall behaviour on a new external endpoint (mitigated by a pre-build spike from the target Windows Server documented as an entry-gate), client-disconnect-without-cancel charging for orphan TTS work (mitigated by `is_disconnected()` checkpoints and an in-flight button disable), blob-URL memory leaks in the React player (mitigated by store-owned lifecycle — revoke-before-overwrite and revoke-on-`newGame()`), and domain-acronym mispronunciation (EDIP, PC, PO, CRM, LEFS, SIEP — mitigated by a regex pronunciation dict applied in `text_preprocessor.py` before the TTS call). The graceful-degradation contract is load-bearing: TTS failure must never block the shipped markdown debrief path.

## Key Findings

### Recommended Stack

Two additive Python dependencies; **zero** new frontend dependencies. The feature delivers entirely with the existing React 19 / Zustand 5 / Tailwind 4 frontend and the existing FastAPI / httpx backend.

**Core additions (backend):**
- **`elevenlabs==2.43.0`** — ElevenLabs Python SDK; use the **sync** `ElevenLabs` client wrapped in `starlette.concurrency.run_in_threadpool`. Pinned exactly (not a floor) to avoid silent Fern-regen breakage from the SDK's weekly auto-generated releases. Open bug #243 on `AsyncElevenLabs` is the specific reason for sync-first.
- **`num2words>=0.5.13,<0.6`** — Number-to-words normalization for TTS preprocessing. Pure-Python, no C extensions, Windows-safe.
- **No `pydub`, no `ffmpeg-python`, no `mutagen`, no `tenacity`.** Raw-bytes MP3 concat replaces all of them. 500ms silence pad is a static `backend/app/assets/silence_500ms.mp3` committed once, offline-generated, ~8 KB.

**Frontend: no `package.json` changes.** Native HTML5 `<audio controls>` + a synthetic `<a download>` anchor (identical pattern to the shipped `debriefExporter.ts::downloadDebrief`). No `wavesurfer.js`, no `howler.js`, no `react-audio-player`.

**New env vars (all server-side, never in browser):** `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_KENT`, `ELEVENLABS_VOICE_FINCH`, `ELEVENLABS_VOICE_CHEN`, `ELEVENLABS_MODEL_ID=eleven_multilingual_v2` (settled — see Open Questions), `ELEVENLABS_OUTPUT_FORMAT=mp3_44100_128`.

Detail: [`.planning/research/STACK.md`](./STACK.md).

### Expected Features

FEATURES.md enumerates **11 table-stakes** features and 8 differentiators (5 IN / 3 OUT). The v1.2 MVP ships all 11 table stakes plus 5 low-cost differentiators (16 items total in P1).

**Must have (11 table stakes):**
1. TS-1 Generate Podcast button in debrief area (adjacent to existing markdown download)
2. TS-2 Inline `<audio controls>` player
3. TS-3 Download MP3 with `debrief-{kebab}-{YYYY-MM-DD-HHmm}.mp3` filename
4. TS-4 Fixed persona order: **Kent -> Finch -> Chen** (settled)
5. TS-5 ~500-750ms silence pad between persona segments
6. TS-6 Per-persona progress feedback ("Kent done, Finch rendering, Chen waiting")
7. TS-7 Cancel in-flight generation (frontend `AbortController` + backend `is_disconnected()` checkpoints)
8. TS-8 Graceful degradation: markdown debrief stays functional when TTS is down
9. TS-9 TTS health surfaced on Setup screen (does NOT gate Launch — soft warning only)
10. TS-10 Per-session character-count cap with confirm dialog (prevents runaway-cost click)
11. TS-11 Session-ephemeral cache keyed on debrief-text-hash (accidental re-click returns cached MP3)

**Should have (differentiators going IN — all low marginal cost on top of TS):**
- DF-1 Transcript displayed under the player (expandable)
- DF-2 Per-persona "Skip to Kent / Finch / Chen" segment markers using backend-returned offsets
- DF-3 Re-generate button with "uses ElevenLabs quota again" confirm
- DF-4 Progress bar + percentage on top of TS-6's per-persona events
- DF-5 "Now playing: Kent Valentina" label that updates at segment boundaries

**Defer (v1.3+):**
- DF-6 Per-persona MP3 download — structural backend change; wait for explicit facilitator request
- DF-7 Media Session API chapter metadata — OS-level controls; single-facilitator-at-table use case does not need it
- DF-8 Playback speed UI — native `<audio>` right-click already exposes this
- Voice audition / voice casting — explicitly deferred per user scope

**Anti-features (never build, documented in FEATURES.md Anti-Features section):** AF-1 streaming-as-it-generates, AF-2 browser-side API keys, AF-3 multi-user collaborative editing, AF-4 voice-cloning of real people, AF-5 UI-blocking modal, AF-6 auto-play, AF-7 cloud share-by-link, AF-8 auto-generate on end-of-game, AF-9 narrated-session podcast (new LLM call), AF-10 LLM-generated show notes.

Detail: [`.planning/research/FEATURES.md`](./FEATURES.md).

### Architecture Approach

Additive and bolt-on, not a rewrite. The shipped v1.0/v1.1 architecture stays bit-identical except for seven explicitly enumerated modifications (listed in ARCHITECTURE.md section 2.5). A new `backend/app/services/` folder is created (sibling to `routers/`) to hold TTS provider, text preprocessor, and audio generator — keeping `routers/debrief.py` thin (HTTP framing and error-code translation only).

**Major components:**
1. **`backend/app/services/tts/{base,elevenlabs_provider}.py`** — `TTSProvider` ABC + ElevenLabs concrete impl. The ABC is the seam that enables a `FakeTTSProvider` for dev/test to protect quota.
2. **`backend/app/services/text_preprocessor.py`** — pure function: markdown stripping + regex-based acronym pronunciation dict (EDIP -> "E D I P", NATO -> "Nato", PC/PO/CRM/LEFS/SIEP etc.) + `num2words` for numbers and years. Applied AFTER the LLM, BEFORE ElevenLabs. No prompt changes anywhere.
3. **`backend/app/services/audio_generator.py`** — orchestrator: calls provider 3x serially (or bounded-concurrent), stitches with silence pads, returns MP3 bytes + optional per-segment offsets.
4. **`backend/app/routers/debrief.py`** — `POST /api/debrief/podcast`; request is 3-segment JSON `{segments:[{persona,text}x3], gameName}`; response is blocking `audio/mpeg` with `Content-Disposition` set for download.
5. **`backend/app/routers/health.py` (extended, not replaced)** — adds `GET /api/health/tts` using the same 8-code taxonomy as the v1.1 LLM probe, always HTTP 200, body.ok carries signal, 30s in-memory cache to protect quota. Probes ElevenLabs `GET /v1/voices` or `/v1/user` (cheap, no TTS billing).
6. **`src/lib/podcastClient.ts`** — zero-throw discriminated-union fetch wrapper mirroring `llmClient.ts` line-for-line; swap JSON -> blob.
7. **`src/lib/gameStore.ts` — new `PodcastSlice`** — 4-status state machine (`idle` / `generating` / `ready` / `failed`) + `podcastBlobUrl` + `podcastAbortController`. Store owns blob-URL lifecycle; `newGame()` and `resetGame()` call `clearPodcast()` which revokes first, then zeros.
8. **`src/components/game/PodcastPlayer/PodcastPlayer.tsx`** — renders Generate button / spinner / `<audio>` + Download / error hint depending on status. Dropped into `ActionToolbar.tsx` adjacent to the existing markdown Download button — the ONE existing UI file that needs an edit.
9. **`src/components/setup/TtsHealthBadge.tsx`** — structural copy of `HealthBadge.tsx`; does NOT gate Launch.

**Delivery pattern: blocking streaming `audio/mpeg`, NOT 202+poll.** The backend is stateless; introducing a job store to satisfy TS-6's progress UI would contradict the deferred multi-tenancy decision and over-engineer a single-facilitator tool. See Cross-Researcher Resolutions below.

Detail: [`.planning/research/ARCHITECTURE.md`](./ARCHITECTURE.md).

### Critical Pitfalls

21 pitfalls catalogued in PITFALLS.md. The top five that shape the roadmap:

1. **Free-tier quota burn during dev** (Pitfall 1) — 10,000 chars/month at 1-char-per-credit; 4-6 full regenerations exhausts it. Mitigation: `FakeTTSProvider` ABC is the dev default via `TTS_PROVIDER=fake|elevenlabs` env var; every call logs `tts.characters_sent`; hard per-segment cap.
2. **Corporate firewall drops long-running TLS connections** (Pitfall 4) — v1.0/v1.1 only validated the internal LLM proxy; `api.elevenlabs.io` is a NEW external endpoint. Mitigation: **entry-gate spike** — bare-metal `curl` from the target Windows Server confirming a >60s TTS payload arrives intact, documented as a PROJECT.md Key Decision before any backend build.
3. **Client disconnect keeps charging ElevenLabs** (Pitfall 9) — FastAPI completes handlers even after browser drop. Mitigation: `await request.is_disconnected()` checkpoints between persona segments + frontend `AbortController` + in-flight button disable.
4. **Blob URL leak in React** (Pitfall 10) — `URL.createObjectURL` without a matching `revokeObjectURL` pins ~10 MB per regenerate. Mitigation: store-owned lifecycle (not component-owned) — `gameStore` revokes before overwriting and on `newGame()` / `resetGame()` / `clearPodcast()`. Do NOT revoke in `PodcastPlayer`'s unmount effect.
5. **EDIP vocabulary mispronounced and markdown punctuation read aloud** (Pitfalls 5 + 6) — "asterisk asterisk security of supply asterisk asterisk" + "ee-dip". Mitigation: `text_preprocessor.py` strips markdown AND applies an explicit regex pronunciation dict against a golden-file test corpus drawn from v1.0 live runs.

Also notable: v1.1's load-bearing exception-handler ordering (Pitfall 13), the v1.0 08-05 `lastDebriefIdx` bucketing invariant (Pitfall 14), the v1.1 `withinLimit` prompt-token CI assertion with 642-token headroom (Pitfall 15) — all three are preserved by **making zero prompt changes in v1.2** (reinforced: the scripts already exist, no new LLM call).

**Pitfalls rendered contingent, not active, by the stack prescription:**

Pitfalls 7 (MP3 byte-concat artefacts), 8 (ffmpeg missing on Windows scheduled task), and 21 (pydub temp-file accumulation) are **eliminated by construction** in the prescribed stack because `pydub` and `ffmpeg` are not installed. They remain documented in PITFALLS.md as *contingent pitfalls*: if integration testing shows the raw-bytes-concat approach produces audible artefacts (click/pop at segment boundaries, duration-metadata breakage on strict decoders like Safari), re-opening the `pydub` option **reactivates all three**. The entry-gate for reactivation would be empirical artefact reproduction plus a decision to add `ffmpeg` as a vendored binary.

Detail: [`.planning/research/PITFALLS.md`](./PITFALLS.md).

## Cross-Researcher Resolutions

Three places where the four researchers disagreed or left a seam. These are resolved here so the roadmapper and the plan-phase author do not re-debate them.

### 1. Delivery pattern — blocking streaming, NOT 202+poll

FEATURES.md's TS-6 (per-persona progress indicator "Kent done, Finch rendering, Chen waiting") implied the frontend needed real progress events and flagged this to ARCHITECTURE as "either 202-then-poll or SSE — decision out of FEATURES scope." ARCHITECTURE.md section 5 prescribed **blocking streaming `audio/mpeg`** and explicitly rejected 202+poll on the grounds that (a) the facilitator waits-next-to-the-button rather than context-switching, so blocking UX fits; (b) infrastructure already tolerates multi-minute `/api/llm` requests; and (c) a job store would reintroduce the server-side session state that multi-tenancy deferral exists to keep out.

**Resolution:** Architecture's prescription wins. The backend delivers a single blocking `audio/mpeg` response. **TS-6's per-persona progress UI is satisfied client-side only** — an optimistic animation that advances Kent -> Finch -> Chen on a fixed schedule based on elapsed time and the expected per-persona latency (~30-60s), NOT driven by real backend progress events. The animation resets if the blocking response errors before completion. This is a deliberate UX simulation, not deception: the facilitator gets the liveness signal they need; the backend stays stateless.

### 2. MP3 concat approach — raw bytes, pydub pitfalls contingent-not-active

STACK.md Prescribed-Patterns-2 prescribed a zero-dependency `b"".join(...)` concatenation of ElevenLabs `mp3_44100_128` CBR segments with a committed static silence-pad MP3. PITFALLS.md (items 7, 8, 21) raised several concerns about `pydub + ffmpeg` on Windows scheduled tasks: PATH inheritance (issue #668), `AudioSegment.silent()` click artefact (#423), temp-file handle retention on Windows.

**Resolution:** STACK's prescription eliminates those pitfalls *by construction* — no `pydub` installed, no `ffmpeg` invoked, no temp files in the stitching path (final MP3 stays in memory as `bytes`). PITFALLS.md items 7, 8, and 21 are therefore **contingent, not active**, in v1.2. They remain in PITFALLS.md unchanged as documentation for the fallback scenario: if integration testing (Slice 9 in ARCHITECTURE.md section 8) reveals audible artefacts at segment boundaries that the 500ms silence pad does not mask, reopening the `pydub` option reactivates all three pitfalls and requires vendoring `ffmpeg.exe` + `ffprobe.exe`. The entry-gate for that reactivation is empirical reproduction of a clicking/popping artefact on a real browser decoder (Chrome/Edge/Safari), not speculation.

### 3. Health-check integration — parallel `/api/health/tts` (Option B)

STACK.md, ARCHITECTURE.md section 4, and PITFALLS.md all converged on the same answer: a new `GET /api/health/tts` endpoint parallel to the shipped `/api/health/llm`, using the same 8-code taxonomy shape. ARCHITECTURE.md supplied the decisive semantic argument: LLM down is a **hard fail** (Launch button disabled, game can't run); TTS down is a **soft warning** (markdown debrief still works, podcast is additive). Aggregating both behind a single `body.ok` would force a lossy collapse. Two endpoints with independent `ok` flags preserve the distinction.

**Resolution:** Option B (parallel endpoint) is decided. Frontend renders a new `TtsHealthBadge` under the existing `HealthBadge` in `LoadConfigPanel.tsx`; label when failed is "Podcast generation unavailable — markdown debrief will still work." The Launch gate logic stays bit-identical (Launch is gated only on LLM health). Probe target: `GET /v1/voices` or `/v1/user` on ElevenLabs (both cheap, no TTS billing); 30s in-memory cache to protect quota from health-check spam; 15s SLA matching the LLM probe.

## Implications for Roadmap

The ARCHITECTURE.md section 8 dependency chain lays out 11 build-slices in strict dependency order: backend settings + health skeleton, TTS provider + preprocessor, audio generator + stitching, endpoint wiring, frontend client + types, Zustand slice, PodcastPlayer + ActionToolbar wire-up, TTS health badge, live-ElevenLabs verification, graceful-degradation verification, milestone audit. Slices 1-8 are all mockable (no live credentials required in CI); slices 9-10 require a real ElevenLabs key and match the v1.1 Tier-B live-replay precedent.

For phase structuring, the natural seams cluster into roughly three-to-four groupings:

- **A backend-first foundation grouping** — settings, TTS health skeleton, TTS provider with `FakeTTSProvider` default, text preprocessor with its test corpus, audio generator with stitching. This group is 100% mockable and unblocks the frontend. It also absorbs most of the critical pitfalls (quota-burn, 5s httpx timeout, markdown-read-aloud, EDIP mispronunciation) early, before any UI touches exist to complicate debugging.
- **An endpoint + frontend-plumbing grouping** — `/api/debrief/podcast` wired to the generator, `podcastClient.ts` zero-throw wrapper, `PodcastSlice` on `gameStore` with blob-URL lifecycle, `PodcastPlayer` component, and the one-line `ActionToolbar.tsx` edit. This group delivers the end-to-end flow against the mocked backend.
- **A health + graceful-degradation grouping** — `/api/health/tts` endpoint live, `TtsHealthBadge`, `LoadConfigPanel` integration, plus the explicit graceful-degradation verification (flip `ELEVENLABS_API_KEY` to garbage, confirm markdown debrief still works).
- **A live-verification + audit grouping** — the first slice that needs a real ElevenLabs key, mirroring the v1.1 milestone-audit pattern. This includes the corporate-firewall spike (which is actually an *entry-gate prerequisite* before backend build, see below) and a listen-through on the v1.0 Scenario-2 fixture transcripts.

The roadmapper should decide the exact phase count and boundaries; the research does not prescribe it. What the research DOES prescribe is the mock-vs-live boundary: the final phase is the first phase that requires a real ElevenLabs key, and it should be preceded by a gate that confirms the corporate-firewall spike has been completed.

### Entry-gate prerequisites (before Phase 1 of the built roadmap begins)

Three items gate the first line of implementation code:

1. **Corporate-firewall spike from the target Windows Server** — bare-metal `curl` or `python -c "requests.post(...)"` against ElevenLabs TTS endpoint from inside the corporate network, confirming a >60s payload arrives intact. Result documented as a PROJECT.md Key Decision with date. This is the single item most likely to derail the milestone if discovered late (Pitfall 4). **Must happen before Slice 1.**
2. **`FakeTTSProvider` dev default** — the `TTSProvider` ABC and the `FakeTTSProvider` (returns pre-recorded beep MP3s) must exist and be the dev default via `TTS_PROVIDER=fake|elevenlabs` env var before any developer is pointed at a real ElevenLabs key. This protects the shared free-tier quota during UI iteration (Pitfall 1). Lands as part of Slice 2.
3. **NOT required: vendored ffmpeg.exe** — explicitly called out because it is tempting to include preemptively. The prescribed raw-bytes-concat approach does not use ffmpeg; vendoring it is an unused complexity. This flips only if the contingent-not-active reactivation (Cross-Researcher Resolution #2) is triggered.

### Research Flags

Phases likely needing deeper research during plan-phase:
- **The live-verification phase (whichever phase contains Slice 9)** — needs a brief research pass on ElevenLabs voice-library current state (voice IDs for Kent/Finch/Chen stock selection), current ToS language about training on API input (referenced in PITFALLS.md security table), and current pricing-page behaviour for monthly-char-budget reporting. All three can drift between research-date (2026-04-17) and phase-build-date.

Phases with standard patterns (can skip deeper research):
- Backend foundation (settings, TTS provider, preprocessor, stitcher) — STACK.md and ARCHITECTURE.md provide line-for-line transplant patterns from the MDInsights reference repo; no unknowns.
- Endpoint + frontend plumbing — mirrors the shipped `/api/llm` + `llmClient.ts` + `gameStore.ts` patterns line-for-line.
- TTS health badge — structural copy of v1.1's `HealthBadge.tsx`.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | ElevenLabs SDK 2.43.0 verified against PyPI + GitHub releases (released 2026-04-13, four days before this research). Reference repo code read directly. Raw-bytes-concat safety verified against Hydrogenaudio MP3 spec (authoritative). `num2words` 0.5.x stability confirmed. |
| Features | HIGH | Anchored to shipped v1.0/v1.1 behaviour read directly from `src/lib/debriefExporter.ts`, `src/components/game/ChatFeed/`, `PROJECT.md`. User-input scope document explicit about in/out decisions. 11 table-stakes + 5 in-differentiators enumerated with complete dependency graph. |
| Architecture | HIGH | Every new file path and every modified existing file enumerated and verified against the actual repo tree. State-slice shape specified to the field. Blob-URL lifecycle rules enumerated. The only MEDIUM call was the health-check option choice, resolved to Option B with three-way research convergence. |
| Pitfalls | HIGH | 21 items, each with a verified external source (ElevenLabs docs, httpx docs, FastAPI issue trackers, pydub issues, Hydrogenaudio) or an internal code reference (PROJECT.md Key Decisions). Per-phase mapping complete. |

**Overall confidence: HIGH.**

### Gaps to Address

Two items are settled enough to proceed but would benefit from a brief plan-phase decision:

- **Per-session character-budget ceiling (soft cap before confirm dialog, hard cap that refuses further generation).** FEATURES.md TS-10 suggests ~2000 words (~12,000 chars). PITFALLS.md Pitfall 1 suggests `MAX_CHARS_PER_SESSION=6000`. **Recommended default:** soft cap at 6,000 chars (warn-and-confirm), hard cap at 10,000 chars (refuse with `TTS_SESSION_BUDGET_EXCEEDED`). Plan-phase should confirm.
- **Serial vs bounded-concurrent per-persona synthesis.** STACK.md recommends `asyncio.gather` with three `run_in_threadpool` calls for a ~3x wall-clock speedup; PITFALLS.md Pitfall 2 warns of free-tier 2-concurrent-request limit. **Recommended default:** serial by default via a `MAX_CONCURRENT_TTS=1` env var; bump to 2 only when the deployment plan is confirmed >= Creator tier. Plan-phase should confirm based on actual ElevenLabs subscription tier.

Settled (no decision needed):
- **`eleven_multilingual_v2` vs `eleven_turbo_v2`** — SETTLED. STACK.md prescribes `eleven_multilingual_v2` (quality over speed; this is a 3-voice narrated debrief, not a real-time interaction).
- **Canonical persona order Kent -> Finch -> Chen** — SETTLED. FEATURES.md TS-4 anchors this to the on-screen `PersonaDots.tsx` order; ARCHITECTURE.md section 5 makes it request-shape authoritative.

## Sources

### Primary (HIGH confidence)
- `.planning/research/STACK.md` — v1.2 stack additions (elevenlabs 2.43.0, num2words)
- `.planning/research/FEATURES.md` — 11 table stakes, 8 differentiators, 10 anti-features
- `.planning/research/ARCHITECTURE.md` — 11-slice dependency chain, Zustand slice shape, blob-URL lifecycle rules
- `.planning/research/PITFALLS.md` — 21 pitfalls with per-phase mapping
- [elevenlabs on PyPI](https://pypi.org/project/elevenlabs/) and [GitHub releases](https://github.com/elevenlabs/elevenlabs-python/releases) — SDK 2.43.0 verified as current stable
- [Hydrogenaudio Knowledgebase: Bit reservoir + CBR](https://wiki.hydrogenaudio.org/) — MP3 frame-independence verified for `mp3_44100_128` CBR
- `.planning/PROJECT.md` — v1.0 and v1.1 Key Decisions that constrain this milestone
- `backend/app/routers/{llm,health}.py` and `src/lib/{llmClient,gameStore,debriefExporter}.ts` — shipped contracts read directly

### Secondary (MEDIUM confidence)
- [elevenlabs-python issue #243](https://github.com/elevenlabs/elevenlabs-python/issues/243) — `AsyncElevenLabs` TypeError; basis for sync-first prescription
- MDInsights reference repo (`SamuraiJenkinz/daily-intelligence-brief`) — `TTSProvider` ABC pattern, `audio_generator.py` orchestrator shape, `text_preprocessor.py` dict+regex pattern
- [ElevenLabs Rate Limits help page](https://help.elevenlabs.io/hc/en-us/articles/14312733311761) — free-tier 2-concurrent / starter 3-concurrent basis for Pitfall 2
- [FastAPI disconnect-handling discussions](https://github.com/fastapi/fastapi/discussions/14552) — `is_disconnected()` checkpoint pattern for Pitfall 9

### Tertiary (LOW confidence)
- Current ElevenLabs ToS language on training-on-API-input — cited by reference but not re-verified on 2026-04-17; should be re-confirmed during the live-verification phase.
- Current ElevenLabs stock voice library for Kent/Finch/Chen voice casting — intentionally deferred; this milestone uses env-configured voice IDs and does not research specific voices.

---
*Research synthesis for: v1.2 Debrief Podcast milestone*
*Synthesized: 2026-04-17*
*Supersedes: prior v1.0 SUMMARY.md dated 2026-04-13*
*Ready for roadmap: yes*
