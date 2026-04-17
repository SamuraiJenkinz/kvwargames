# Feature Research — v1.2 Debrief Podcast

**Domain:** End-of-session audio debrief for a single-facilitator live-wargame tool
**Researched:** 2026-04-17
**Confidence:** HIGH (anchored to shipped v1.0/v1.1 behaviour, read from `src/lib/debriefExporter.ts`, `src/components/game/ChatFeed/`, `PROJECT.md`, and the MDInsights reference repo shape captured in project context)

---

## Scope Statement

This research covers user-facing product behaviour for converting the already-existing markdown debrief into a three-voice MP3 podcast. It does **not** cover stack selection (parallel researcher), backend architecture (parallel researcher), or voice casting / voice-audition (explicitly deferred by user).

**Existing behaviour this milestone layers on top of:**

- The facilitator ends a session → persona messages tagged `isDebrief: true` are emitted into the `ChatFeed` and visually separated by `DebriefDivider.tsx`.
- `src/lib/debriefExporter.ts#buildDebriefFilename` generates `debrief-{kebab-game-name}-{YYYY-MM-DD-HHmm}.md`.
- `src/lib/debriefExporter.ts#downloadDebrief` uses the standard Blob + anchor pattern with deferred `URL.revokeObjectURL` (Firefox-safe).
- Export bucketing halts at `lastDebriefIdx` so post-debrief messages don't double-count (Phase 8 follow-up, 08-05).
- LLM health gate pattern (v1.1): `/api/health/llm`, 8-code taxonomy, 15s SLA, HTTP 200 always with `body.ok` as signal, badge on Setup screen, Launch gated on `healthStatus === 'ok'`.

**Everything below is framed as user-observable behaviour**, not implementation.

---

## Feature Landscape

### Table Stakes (Must Ship in v1.2)

Features the facilitator will assume work. Missing any of these makes v1.2 feel half-built.

| # | Feature | User-Observable Behaviour | Why Expected | Complexity |
|---|---------|--------------------------|--------------|------------|
| TS-1 | **Generate Podcast action** | In the debrief area of the ChatFeed (after the `DebriefDivider`), a "Generate Podcast" button appears next to the existing "Download Debrief (.md)" button. Clicking starts generation. | The markdown download already exists there; audio is a peer capability and belongs in the same place. Facilitator shouldn't hunt for it. | LOW |
| TS-2 | **Inline `<audio>` player** | Once generation completes, a standard HTML `<audio controls>` element replaces (or sits directly below) the Generate button, pre-loaded with the stitched MP3 as a blob URL. Facilitator hits play to audition; native browser controls (play/pause, scrubber, volume, mute) are sufficient. | Every facilitator has used an HTML audio player. No custom controls needed for v1.2. | LOW |
| TS-3 | **Download MP3 button** | A "Download MP3" button adjacent to the player triggers a file save. Filename follows the existing markdown convention: `debrief-{kebab-game-name}-{YYYY-MM-DD-HHmm}.mp3`. Uses the same Blob + anchor + deferred revoke pattern as `downloadDebrief`. | Parity with existing markdown download; facilitators archive debriefs after sessions and will expect the filenames to match. | LOW |
| TS-4 | **Three-persona voice sequencing** | The MP3 plays segments in this fixed order: **Kent Valentina → Dr. Alistair Finch → Dr. Michael Chen**. This matches the order personas are introduced in the game's persona dots (`StatePanel/PersonaDots.tsx`) and the left-to-right reading of the debrief chat feed. Kent (facilitator-facing scenario voice) opens; Chen (technical/closing voice) closes. | A predictable ordering matching the on-screen debrief feed lets the listener map voice to persona without explanation. Randomising ordering or alphabetising would break the chat-feed↔audio mental model. | LOW |
| TS-5 | **Silence pad between persona segments** | ~700ms of silence is inserted between each persona's segment. Long enough to feel like a deliberate handoff (not a glitch), short enough that facilitators don't reach for fast-forward. No pad before Kent's open or after Chen's close. | Back-to-back voice changes with zero gap sound like audio corruption. 700ms is the typical podcast-stitch pause (shorter than a commercial break, longer than a natural pause). | LOW |
| TS-6 | **Generation-in-flight feedback** | Between clicking Generate and the player appearing, a non-blocking progress indicator shows which persona is currently rendering: *"Generating podcast — Kent ✓ · Finch (rendering…) · Chen (waiting)"*. Updates as each persona segment completes. Whole generation may take 2-4 minutes; facilitator must see the tool is working, not hung. | ElevenLabs TTS is ~30-60s per minute of output × 3 personas. A bare spinner for 3 minutes reads as "app frozen" and facilitators will refresh, triggering re-generation and re-cost. | MEDIUM (requires per-persona progress events from backend) |
| TS-7 | **Cancel in-flight generation** | While generating, a Cancel button is available. Clicking it stops the job, frees the UI, and returns to the pre-generation state (Generate button shown again). No partial MP3 is offered. | Facilitator triggered generation by accident, or realised they want to tweak debrief text first, or session ended and they don't need audio. A 3-minute uninterruptible operation is hostile. | MEDIUM (requires backend task abort; AbortController on the fetch side) |
| TS-8 | **Graceful degradation on TTS failure** | If ElevenLabs is unreachable, returns 5xx, times out, or fails mid-persona: the player area shows a clear status — *"Audio generation unavailable — ElevenLabs returned {reason}. Markdown debrief is unaffected."* — AND the existing "Download Debrief (.md)" button remains fully functional. No cascade failure. | The markdown debrief is the contract from v1.0; audio is additive. A dead vendor must never take the session's written output hostage. | MEDIUM (proper error boundary in PodcastPlayer; markdown export must not share any failure path) |
| TS-9 | **TTS health surfaced on Setup screen** | Setup screen shows a TTS-available indicator alongside the existing LLM health badge. If TTS is down, Setup doesn't block Launch (audio is optional), but the facilitator is warned before a 3-hour session that end-of-session audio won't work. Re-check button same pattern as LLM health. | v1.1 taught us: discovering a dead dependency at the moment you need it is the worst possible UX. Surface it on Setup where facilitators already look. Do not block Launch — LLM is the hard dependency, TTS is the soft one. | MEDIUM (new `/api/health/tts` endpoint reusing v1.1's 8-code taxonomy shape) |
| TS-10 | **In-session cost guard: word-count cap** | Before calling ElevenLabs, the backend counts words across all `isDebrief: true` messages. If count exceeds a ceiling (~2000 words ≈ 15 min of audio at normal pace), the Generate button offers a confirmation: *"This debrief is {N} words (~{M} minutes of audio). Generate anyway?"* Below the cap: no prompt, just generate. | ElevenLabs is metered. A runaway debrief (hypothetically 10K words from a very talkative session) at full generation could cost tens of dollars on one click. MDInsights' 250-600 word validation was the inspiration; the wargame variant is "unbounded but warn at excessive". | LOW |
| TS-11 | **Session-ephemeral audio caching** | If facilitator clicks Generate, then closes the player, then clicks Generate again within the same session (no new debrief content): return the already-generated MP3 from memory. Don't re-hit ElevenLabs. Cache is discarded on page refresh or navigate-to-setup. | MDInsights' idempotent-generation pattern, adapted for session-ephemeral state. Accidental double-generation is expensive and slow; legitimate re-generation (if audio is bad) has a dedicated button (see DF-3). Cache keyed on debrief-text-hash so legitimately-new debrief content does re-generate. | LOW |

**Table stakes summary by persona flow** (required by quality gate):

- **Generate-audio flow:** TS-1, TS-4, TS-5, TS-6, TS-7, TS-10, TS-11
- **Play-in-app flow:** TS-2
- **Download-MP3 flow:** TS-3
- **Graceful-failure flow:** TS-8, TS-9

All four flows covered.

---

### Differentiators (Quality Signals — In/Out Judgment)

Features that raise the floor from "works" to "feels polished". Each has an explicit in/out call for v1.2 with reasoning.

| # | Feature | User-Observable Behaviour | v1.2 Judgment | Reasoning |
|---|---------|--------------------------|---------------|-----------|
| DF-1 | **Transcript display under the player** | An expandable panel below the player shows the same markdown debrief content rendered inline. Listener can read along, or scan if they'd rather skim. Collapsed by default so the primary interaction (listen) stays prominent. | **IN** | The debrief text already exists in the component tree — rendering it below the player is a pure frontend change, zero backend cost, zero ElevenLabs cost. High user value (accessibility, post-session reference). Low complexity given the markdown is already assembled by `debriefExporter.ts`. |
| DF-2 | **Per-persona segment markers** | Below the audio player, three labelled buttons: *"Skip to Kent"*, *"Skip to Finch"*, *"Skip to Chen"*. Clicking sets `audio.currentTime` to the start-offset of that persona's segment. Backend returns per-persona start timestamps alongside the MP3 blob. | **IN** | Segment offsets are a natural byproduct of stitching (backend knows exactly where each segment starts). Surfacing them unlocks skip-to-Finch, which is the #1 post-session re-listen pattern (facilitator wants to quote one persona's analysis). Trivial frontend (buttons) + small backend addition (return offsets in response). Media Session API chapters are a nice-to-have extension but simple segment buttons are sufficient for v1.2. |
| DF-3 | **Re-generate button** | After an MP3 is loaded into the player, a "Re-generate" button is available. Clicking invalidates the session cache and re-runs the whole 3-persona pipeline. Confirms first: *"This will use ElevenLabs quota again. Continue?"* | **IN** | ElevenLabs voices occasionally produce artefacts (wrong pronunciation, strange cadence, clipped audio). Without a re-generate path, facilitator's only recourse is refresh-the-page-and-re-end-the-game, which is absurd. Confirmation dialog prevents accidental re-cost. Low complexity — reuses TS-1's flow. |
| DF-4 | **Progress percentage + per-persona-done indicator** | TS-6 shows "Kent ✓ · Finch (rendering…) · Chen (waiting)". DF-4 upgrades this to include an overall percentage (based on persona count + estimated time per persona) and a filled progress bar. Visual at-a-glance for whether it's 20% done or 80%. | **IN** | TS-6 already passes per-persona events; adding a progress bar + % is pure frontend state derived from the same events. Marginal code cost, large perceived-polish return. The facilitator sitting through a 3-min wait appreciates seeing the bar creep forward. |
| DF-5 | **Visible persona-voice labelling while audio plays** | During playback, a small label below the player reads *"Now playing: Kent Valentina"* and updates at segment boundaries as `audio.currentTime` crosses each offset. Updates in real-time from the same offsets used by DF-2. | **IN** | Free ride on DF-2's offset data. The facilitator hearing an unfamiliar voice needs to know whether that's Finch or Chen (ElevenLabs stock voices may not match persona name recognition). 10 lines of code on top of DF-2 infrastructure. |
| DF-6 | **Download-by-persona** | Under the segment markers (DF-2), three per-persona download buttons: *"Download Kent's segment (.mp3)"*, *"Download Finch's segment (.mp3)"*, *"Download Chen's segment (.mp3)"*. Filenames: `debrief-{kebab}-{YYYY-MM-DD-HHmm}-kent.mp3` etc. | **OUT (v1.3+)** | The backend stitches segments into a single MP3 for TS-3. Supporting per-segment download requires keeping per-segment MP3 blobs alive in backend memory (or re-rendering from source) through the download lifecycle — a structural change to the backend contract. Real user demand for this is speculative; ship the stitched version first, add per-persona if facilitators ask. |
| DF-7 | **Media Session API chapter metadata** | Browser's OS-level media controls (Chrome's media widget, macOS now-playing, etc.) show the current persona as "chapter" with skip-forward/back chapter-jumping. | **OUT (v1.3+)** | Facilitator listens in-app in front of the laptop, not on a mobile device walking around. Browser-OS integration is polish for a use case that doesn't exist in the single-facilitator-at-a-table deployment model. DF-2 segment buttons achieve the same in-app outcome at lower cost. |
| DF-8 | **Playback speed controls** | 1.0x / 1.25x / 1.5x / 1.75x / 2x speed selector next to the player. | **OUT (v1.3+)** | Native HTML `<audio>` with `controls` already exposes playback rate via right-click → "Playback speed" in Chrome. Custom UI on top of that is redundant until a user complains. Revisit if real facilitator feedback says the native menu is unfindable. |

**Differentiators going IN for v1.2:** DF-1, DF-2, DF-3, DF-4, DF-5 (five differentiators; all low marginal cost on top of table stakes)
**Differentiators explicitly OUT:** DF-6, DF-7, DF-8

---

### Anti-Features (Never Build — Documented to Prevent Re-Adding)

Each has a **WHY** so a future milestone can't re-propose without first reading this.

| # | Anti-Feature | Why Someone Might Request It | Why It Must Not Be Built | Alternative |
|---|--------------|-----------------------------|--------------------------|-------------|
| AF-1 | **Streaming audio as-it-generates** (word-by-word progressive playback during render) | "LLMs stream token-by-token, why doesn't audio?" | ElevenLabs does not expose word-level streaming. The API returns per-segment MP3 bytes in one chunk. Pretending to stream (e.g., showing a "live" waveform that isn't actually playing) is deceptive UX and will desynchronise with reality as soon as a segment fails mid-render. | TS-6 (per-persona progress events) conveys liveness without faking streaming. |
| AF-2 | **Browser-side ElevenLabs API keys** | "It's faster / simpler if the client calls ElevenLabs directly" | **v1.0 hard constraint:** zero browser-side credentials. Audited explicitly in Phase 8. An ElevenLabs API key in the client is indistinguishable from an LLM key in the client — same audit, same fail. Server-side proxy `/api/llm` pattern applies identically to TTS. | Backend proxy `POST /api/debrief/podcast` (per PROJECT.md v1.2 target features). |
| AF-3 | **Multi-user collaborative podcast editing** (shared session where multiple facilitators tweak audio) | "What if two facilitators want to co-edit the debrief audio?" | **v1.0 hard constraint:** single-facilitator tool, session-only state, no DB. Multi-user editing requires server-side session persistence, CRDT or OT, conflict resolution, and access control — none of which exist in this architecture. | Single facilitator generates; if two need to collaborate, they share the downloaded MP3 over the same channels they'd share the markdown debrief (email, Slack, etc.). |
| AF-4 | **Voice-cloning / likeness cloning** (custom voices trained on real-person recordings, or attempts to match specific real individuals) | "Can we make Kent sound like {real person X}?" | **Legal / corporate policy.** Cloning a real person's voice in a corporate-deployed tool is a liability vector (consent, likeness rights, misuse for impersonation). ElevenLabs supports custom voice cloning; using it here must be off-limits. Stock voices only. | Voice-audition phase (v1.3+, deferred) selects from ElevenLabs' stock voice library, which has model-release coverage. |
| AF-5 | **Interruptive / UI-blocking generation** (modal or full-screen "Generating…" overlay that prevents interaction with the rest of the app) | "Simpler to just block while we wait 3 minutes" | The facilitator may want to keep showing the state panel / reference panel / chat feed to the room while audio generates in the background. Blocking the UI during a 3-minute render is hostile. Generation must be async, backgrounded, and cancellable. | TS-6 (non-blocking progress) + TS-7 (cancel). The rest of the app remains fully interactive during generation. |
| AF-6 | **Auto-play on generation complete** | "Facilitator just clicked Generate, they obviously want to hear it — auto-play saves a click" | Facilitator is at a table, possibly mid-conversation with participants when audio finishes. Sudden audio playback is startling, may interrupt a live discussion, and may blast un-auditioned voice through laptop speakers in a quiet room. Explicit click is the correct default. Browsers also block auto-play with audio after non-interaction anyway, so it'd be unreliable. | Player loads in paused state; facilitator decides when to press play. |
| AF-7 | **Cloud storage / share-by-link for generated MP3s** | "Paste this URL to share the audio" | **v1.0 hard constraint reaffirmed in v1.2 scope:** session-ephemeral state, no DB, no persistence. Cloud storage introduces data-retention, access-control, GDPR, and session-isolation concerns that this tool has explicitly rejected. | Facilitator downloads the MP3 (TS-3) and shares via whatever channel the organisation already uses (email, corporate Slack, SharePoint). |
| AF-8 | **Auto-generation at end of session** (automatically kick off podcast render the instant end-of-game is clicked) | "Save the facilitator a click" | Not every session ends with the facilitator wanting audio. Running a 3-minute render + ElevenLabs cost on every session-end is wasteful. Also: facilitator may want to review / re-word the markdown debrief before committing audio. | Explicit Generate Podcast button (TS-1) — the facilitator chooses whether audio is wanted. |
| AF-9 | **Scripted non-debrief narration** (a "podcast" that summarises the whole session, not just the debrief — e.g., an LLM-generated narrative of the full arc read by a fourth "narrator" voice) | "What if the podcast told the story of the whole session, not just played back the debrief messages?" | Out of scope for v1.2. Requires: (a) a new LLM call to generate narration script, (b) a fourth voice casting decision, (c) a different pipeline (LLM → script → TTS) from v1.2's (existing text → TTS). Interesting idea but a separate product. | Possible v2+ feature; not in v1.2. Use existing `isDebrief: true` messages verbatim. |
| AF-10 | **Show-notes / chapter-summary generation** | "Alongside the audio, generate a summary of each persona's key points as show notes" | Adds an LLM-summarisation step on top of audio generation, doubling cost and adding a new failure mode (bad summary). The markdown debrief IS the show notes — it's the primary artefact; audio is a delivery format for it. DF-1 (transcript display) achieves the same intent without a new LLM call. | DF-1 (inline transcript) exposes the source text directly. If facilitator wants summarised show notes, that's the markdown debrief rewritten, which is a v2+ LLM post-processing feature. |

---

## Feature Dependencies

```
EXISTING (v1.0 / v1.1) — do not rebuild
  ├─ isDebrief:true messages in ChatFeed
  ├─ debriefExporter.ts (markdown build + download)
  ├─ lastDebriefIdx bucketing halt
  ├─ Blob + anchor + deferred revoke download pattern
  ├─ /api/health/llm pattern (8-code taxonomy, 200-always, body.ok)
  └─ Setup health gate pattern

v1.2 NEW
  TS-1 (Generate button)
    └─ reads ──> existing isDebrief:true messages (source of script; no new LLM call)
    └─ triggers ──> backend POST /api/debrief/podcast

  TS-2 (inline player)
    └─ requires ──> TS-1 (generation must succeed first)

  TS-3 (download MP3)
    └─ requires ──> TS-1
    └─ reuses ──> buildDebriefFilename() pattern (swap .md → .mp3)
    └─ reuses ──> downloadDebrief() Blob + anchor + deferred revoke pattern

  TS-4 (persona sequencing Kent→Finch→Chen)
    └─ implied by ──> backend stitching contract
    └─ echoes ──> PersonaDots component persona order

  TS-5 (silence pads)
    └─ implied by ──> backend stitching contract

  TS-6 (in-flight progress)
    └─ requires ──> per-persona progress events from backend
                    (implies backend contract is NOT a single-shot POST;
                     either 202-then-poll or SSE — decision out of FEATURES scope,
                     flagged to ARCHITECTURE researcher)

  TS-7 (cancel)
    └─ requires ──> TS-6 (you can only cancel something visible)
    └─ requires ──> backend abort capability

  TS-8 (graceful TTS failure)
    └─ MUST NOT affect ──> existing downloadDebrief() markdown path
    └─ requires ──> isolated failure boundary around podcast UI

  TS-9 (TTS health on Setup)
    └─ clones ──> v1.1 LLM-health pattern
    └─ does NOT block ──> Launch (unlike LLM health which DOES block)

  TS-10 (word-count cap)
    └─ precedes ──> TS-1's actual call to backend
    └─ inspired by ──> MDInsights word-count validation (250-600 words)
                       adapted: "warn above ceiling" not "reject below floor"

  TS-11 (session cache)
    └─ inspired by ──> MDInsights idempotent-generation pattern
                       adapted: keyed on debrief-text-hash, in-memory, session-lifetime

  DF-1 (transcript under player)
    └─ reuses ──> existing markdown rendering path
    └─ requires ──> TS-2 (player exists to attach panel below)

  DF-2 (per-persona segment markers)
    └─ requires ──> backend returns per-segment offsets alongside MP3
    └─ requires ──> TS-2

  DF-3 (re-generate)
    └─ requires ──> TS-1
    └─ invalidates ──> TS-11 cache when invoked

  DF-4 (progress bar + %)
    └─ extends ──> TS-6 (same event stream)

  DF-5 (currently-playing label)
    └─ requires ──> DF-2 offsets (reuses data)
    └─ requires ──> TS-2 (hooks audio element's timeupdate)

CONFLICTS
  AF-1 (streaming audio) ⊥ TS-6 (per-persona progress is correct answer)
  AF-5 (UI-blocking)     ⊥ TS-6 + TS-7 (async + cancellable is correct answer)
  AF-8 (auto-generate)   ⊥ TS-1 (explicit button is correct answer)
  AF-6 (auto-play)       ⊥ TS-2 (loaded-paused is correct answer)
```

### Dependency Notes

- **TS-6 drives the backend contract shape.** A single-shot synchronous `POST /api/debrief/podcast` that takes 3 minutes and returns one MP3 cannot satisfy TS-6 (per-persona progress). The backend contract must support progress events (202-then-poll or SSE). Flagged to ARCHITECTURE researcher; not a FEATURES call.
- **TS-8's isolation requirement is load-bearing.** The podcast UI and the markdown download must not share a failure path. If `PodcastPlayer` throws during render, the adjacent "Download Debrief (.md)" button must still work. React error boundary around the podcast component is the natural pattern.
- **TS-11 cache + DF-3 re-generate are complementary, not contradictory.** Cache prevents accidental re-cost; re-generate is an explicit user-initiated cost-accepting action. Both ship together.
- **DF-2 offsets are the keystone for DF-5 and enable cheap DF-6 upgrade later.** Returning offsets in v1.2 (even if DF-6 per-persona download is deferred) means v1.3 can add DF-6 as a pure frontend change.

---

## MVP Definition (v1.2)

### Launch With (v1.2)

Ruthlessly minimum viable podcast:

- [x] TS-1 Generate Podcast button in debrief area
- [x] TS-2 Inline `<audio>` player with native controls
- [x] TS-3 Download MP3 with kebab+timestamp filename
- [x] TS-4 Fixed Kent → Finch → Chen ordering
- [x] TS-5 ~700ms silence pad between segments
- [x] TS-6 Per-persona progress indicator
- [x] TS-7 Cancel in-flight generation
- [x] TS-8 Graceful TTS failure (markdown still works)
- [x] TS-9 TTS health on Setup (non-blocking)
- [x] TS-10 Word-count cap with confirm
- [x] TS-11 Session-ephemeral cache
- [x] DF-1 Transcript under player (low cost, high value)
- [x] DF-2 Per-persona segment markers
- [x] DF-3 Re-generate button
- [x] DF-4 Progress bar + %
- [x] DF-5 Currently-playing label

### Add After Validation (v1.3+)

Features deferred from v1.2, with explicit triggers for promotion:

- [ ] **Voice-audition phase** — add when PROJECT.md deferred item moves active. Trigger: facilitator feedback that stock voices don't match persona personalities enough to sustain engagement.
- [ ] **DF-6 Download-by-persona** — add when 2+ facilitators ask for it. Trigger: real user request, not anticipation.
- [ ] **DF-7 Media Session API chapters** — add if deployment model changes to include mobile/remote listening.
- [ ] **DF-8 Playback speed UI** — add if native browser right-click-speed proves undiscoverable in facilitator testing.

### Future Consideration (v2+)

- [ ] **Multi-language debrief audio** — wait for a non-English EDIP exercise to be planned (PROJECT.md deferred).
- [ ] **Scripted non-debrief narration** (AF-9 upgraded to a real feature) — only if the tool's scope expands beyond single-session debriefs.
- [ ] **Cloud storage / share-by-link** — only if session-ephemeral architecture is revisited (PROJECT.md multi-tenancy deferred item).
- [ ] **LLM-generated show notes** — only if facilitators report the markdown debrief is too long for quick scanning.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| TS-1 Generate button | HIGH | LOW | **P1** |
| TS-2 Inline player | HIGH | LOW | **P1** |
| TS-3 Download MP3 | HIGH | LOW | **P1** |
| TS-4 Kent→Finch→Chen order | HIGH | LOW | **P1** |
| TS-5 Silence pads | MEDIUM | LOW | **P1** |
| TS-6 Per-persona progress | HIGH | MEDIUM | **P1** |
| TS-7 Cancel generation | MEDIUM | MEDIUM | **P1** |
| TS-8 Graceful TTS failure | HIGH | MEDIUM | **P1** |
| TS-9 TTS health on Setup | MEDIUM | MEDIUM | **P1** |
| TS-10 Word-count cap | MEDIUM | LOW | **P1** |
| TS-11 Session cache | HIGH | LOW | **P1** |
| DF-1 Transcript below player | MEDIUM | LOW | **P1** |
| DF-2 Segment markers | HIGH | LOW | **P1** |
| DF-3 Re-generate | MEDIUM | LOW | **P1** |
| DF-4 Progress bar + % | LOW | LOW | **P1** |
| DF-5 Currently-playing label | MEDIUM | LOW | **P1** |
| DF-6 Per-persona download | LOW | MEDIUM | P2 |
| DF-7 Media Session API | LOW | MEDIUM | P3 |
| DF-8 Playback speed UI | LOW | LOW | P3 |

**Priority key:**
- **P1**: Must have for v1.2 launch — all table stakes + 5 low-cost differentiators
- **P2**: Should have, add when specifically requested (v1.3)
- **P3**: Nice to have, future consideration (v1.3+ or v2)

---

## Competitor / Reference Feature Analysis

| Feature | MDInsights (reference) | KVWarGame v1.2 (this milestone) |
|---------|------------------------|--------------------------------|
| TTS provider | ElevenLabs via `ElevenLabsTTSProvider` | ElevenLabs via backend proxy (same pattern) |
| Multi-voice audio briefing | Role-based voices (briefer roles) | Persona-based voices (Kent / Finch / Chen) |
| Output format | Stitched MP3 | Stitched MP3 (same) |
| Idempotent generation | File-exists check before re-render | Session-ephemeral cache keyed on debrief-text-hash (TS-11) — adapted for no-persistence model |
| Word-count validation | Hard floor 250 / ceiling 600 — reject if out of range | Soft ceiling ~2000 — warn-and-confirm, not reject (TS-10). Debrief length is unbounded by design. |
| Atomic file writes | Yes (temp-then-rename) | Not applicable — no file persistence; response is streamed/served directly. Pattern transplants as "atomic blob assembly in memory before Content-Length is set". |
| Structured logging / api_events | Yes | Pattern reused (ARCHITECTURE scope, not FEATURES) |
| Download filename convention | Timestamped | Timestamped, kebab-case game name (TS-3) — matches existing `debrief-{kebab}-{timestamp}.md` convention |
| User-facing failure mode | Falls back on text-only brief | Falls back on existing markdown debrief (TS-8) |

**Key insight:** MDInsights is a daily-scheduled batch producer, KVWarGame is an interactive single-facilitator tool. The reusable bones are the `TTSProvider` abstraction, error taxonomy shape, and stitching approach. The UX patterns (progress feedback, cancel, re-generate, cache-within-session) are new to this deployment model.

---

## Sources

- `C:\KVWarGame\.planning\PROJECT.md` — v1.0/v1.1 shipped state, v1.2 target features, deferred items, hard constraints (HIGH confidence)
- `C:\KVWarGame\src\lib\debriefExporter.ts` — `buildDebriefFilename`, `downloadDebrief`, `lastDebriefIdx` bucketing pattern (HIGH — read directly)
- `C:\KVWarGame\src\components\game\ChatFeed\DebriefDivider.tsx` — where debrief visually lives; confirms Podcast UI belongs in ChatFeed area not a separate panel (HIGH — read directly)
- `C:\KVWarGame\src\components\game\StatePanel\PersonaDots.tsx` — canonical persona ordering that TS-4's Kent→Finch→Chen sequence matches (HIGH — read directly)
- `.planning/phases/11-polish-bug-fixes/11-CONTEXT.md` — v1.1 post-ship context; reinforces "remove dead code, no flag-guarded DEV branches" ethic applied to AF anti-features (HIGH — read directly)
- MDInsights (`SamuraiJenkinz/daily-intelligence-brief`) patterns — described from project-context block (MEDIUM — no direct repo read this session, relying on PROJECT.md's summary)
- Project-context block in milestone brief — anti-feature list, differentiator framing, deferred list (HIGH — explicit input)

---

*Feature research for: War Game Engine v1.2 Debrief Podcast*
*Researched: 2026-04-17*
