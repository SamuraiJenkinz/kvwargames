# Requirements: War Game Engine v1.2 Debrief Podcast

**Defined:** 2026-04-17
**Core Value:** Three AI personas respond in-character to facilitator input with accurate, live game state tracking — v1.2 extends the end-of-session debrief into a three-voice MP3 podcast without compromising the markdown export or any v1.0/v1.1 invariant.

## v1.2 Requirements

Requirements for the Debrief Podcast milestone. Each maps to roadmap phases (populated after roadmap creation).

### Podcast Generation (PODGEN)

- [x] **PODGEN-01**: Facilitator can trigger podcast generation from a "Generate Podcast" button in the debrief area, adjacent to the existing "Download Debrief (.md)" button
- [x] **PODGEN-02**: Generated MP3 contains three voice segments in fixed order — Kent Valentina → Dr. Alistair Finch → Dr. Michael Chen — matching the on-screen `PersonaDots` order
- [x] **PODGEN-03**: Each persona's source text is that persona's existing `isDebrief: true` message, consumed verbatim — no new LLM call is introduced
- [x] **PODGEN-04**: Persona segments are separated by ~700 ms of silence, with no pad before Kent's opening or after Chen's closing
- [x] **PODGEN-05**: Wargame-specific vocabulary (EDIP, PC, PO, CRM, IC, LEFS, SIEP, SoS) is pronounced correctly by the TTS — letter-spelled for acronyms that are read letter-by-letter, phonetic expansion for acronyms pronounced as words; numbers are normalised to words
- [x] **PODGEN-06**: When the combined debrief word count exceeds the soft ceiling (~2000 words), the Generate button surfaces a confirmation showing word count and estimated audio length before calling ElevenLabs
- [x] **PODGEN-07**: When facilitator clicks Generate a second time within the same session and the debrief text is unchanged, the previously generated MP3 is served from in-memory cache — no second ElevenLabs call
- [x] **PODGEN-08**: Facilitator can re-generate after a successful generation via a "Re-generate" button that invalidates the cache and prompts for confirmation before re-hitting ElevenLabs quota

### Podcast Playback (PODPLAY)

- [x] **PODPLAY-01**: Once generation completes, an inline HTML5 `<audio controls>` element appears in the debrief area, pre-loaded with the stitched MP3 as a blob URL; audio loads in paused state (no auto-play)
- [x] **PODPLAY-02**: A "Download MP3" button saves the MP3 with filename `debrief-{kebab-game-name}-{YYYY-MM-DD-HHmm}.mp3`, matching the existing markdown download convention (Blob + anchor + deferred `URL.revokeObjectURL`)
- [x] **PODPLAY-03**: Below the player, an expandable panel renders the markdown debrief transcript inline, collapsed by default, using the existing markdown rendering path
- [x] **PODPLAY-04**: Three "Skip to Kent / Skip to Finch / Skip to Chen" buttons seek the audio element to the start of each persona's segment using offsets returned by the backend alongside the MP3
- [x] **PODPLAY-05**: While audio is playing, a label below the player reads "Now playing: {Persona name}" and updates at segment boundaries as `audio.currentTime` crosses the backend-provided offsets

### Generation UX (PODUX)

- [x] **PODUX-01**: During generation, a non-blocking progress indicator displays per-persona status in the form "Kent ✓ · Finch rendering… · Chen waiting" — driven client-side by optimistic state transitions, since the backend returns one blocking streamed MP3 rather than progress events
- [x] **PODUX-02**: A progress bar with overall percentage is visible alongside the per-persona status during generation
- [x] **PODUX-03**: Facilitator can cancel an in-flight generation via a "Cancel" button; cancelling aborts the fetch, frees the UI, and returns to the pre-generation state with no partial MP3 offered

### Resilience (PODRES)

- [x] **PODRES-01**: When ElevenLabs is unreachable, times out, returns an error, or drops mid-generation, the podcast area displays a clear error status (with reason) AND the existing "Download Debrief (.md)" button remains fully functional — the podcast and markdown paths never share a failure boundary
- [x] **PODRES-02**: Setup screen shows a TTS health indicator adjacent to the existing LLM health badge, with the same auto-check-on-mount + Re-check button shape; TTS health is informational and does NOT gate the Launch button (unlike LLM health)
- [x] **PODRES-03**: Backend exposes `GET /api/health/tts` following the v1.1 health contract — always HTTP 200, `body.ok` carries the signal, structured error-code taxonomy, 15-second SLA

### Deployment Readiness (PODDEP)

- [x] **PODDEP-01**: ElevenLabs endpoint (`api.elevenlabs.io`) is confirmed reachable from the target Windows Server deployment host before any production TTS code is merged (corporate-firewall spike)
- [x] **PODDEP-02**: A `FakeTTSProvider` is available in non-production environments (selected via `TTS_PROVIDER` env var) so development and CI never consume ElevenLabs quota

## Future Requirements (v1.3+)

### Persona Voice Casting

- **VOICE-01**: Custom ElevenLabs voices auditioned against each persona's character profile replace the stock defaults

### Player Enhancements

- **PLAYER-01**: Download-by-persona MP3 buttons (Kent's segment alone, Finch's alone, Chen's alone)
- **PLAYER-02**: Media Session API chapter metadata for OS-level media-control integration
- **PLAYER-03**: Custom playback-speed selector (if native browser right-click menu proves undiscoverable)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Streaming audio word-by-word during generation | ElevenLabs does not expose word-level streaming; faking it desynchronises with reality. Per-persona progress is the correct liveness signal. |
| Browser-side ElevenLabs API keys | v1.0 hard constraint — zero browser-side credentials. Audited explicitly in Phase 8. |
| Multi-user collaborative podcast editing | v1.0 hard constraint — single-facilitator tool, session-only state, no DB. |
| Voice cloning / likeness of real individuals | Corporate legal/policy concern. Stock voices only. |
| UI-blocking / modal generation overlay | 3-minute render must not lock the facilitator out of the app; generation must be async + backgrounded + cancellable. |
| Auto-play on generation complete | Facilitator may be mid-conversation with participants; sudden audio is startling. Browsers block auto-play without gesture anyway. |
| Cloud storage / share-by-link for MP3s | v1.0 hard constraint — session-ephemeral, no persistence. Share downloaded MP3 via existing organisational channels. |
| Auto-generation on end-of-game | Not every session ends with audio wanted; wasted ElevenLabs cost on every session-end. |
| Scripted LLM-narrated summary podcast (4th voice) | Requires new LLM call + new pipeline shape; separate product idea. |
| LLM-generated show notes | Markdown debrief IS the show notes; PODPLAY-03 transcript exposes it inline. |
| Multi-language debrief audio | ElevenLabs supports it, but no non-English EDIP exercise is planned. Move only when scheduled. |
| 202-then-poll or SSE delivery pattern | Server-side job state contradicts multi-tenancy deferral; blocking streaming `audio/mpeg` is the v1.2 contract. |
| `pydub` / `ffmpeg-python` / vendored `ffmpeg.exe` | Raw-bytes MP3 concat works because all ElevenLabs segments share `mp3_44100_128` CBR and frames are self-contained. System `ffmpeg` is not a dependency. |
| Extending `/api/health/llm` to also check TTS | LLM-down is a hard fail (blocks Launch); TTS-down is a warning (does not block Launch). One `body.ok` cannot carry both signals. Parallel endpoint prescribed. |

## Traceability

Every v1.2 requirement maps to exactly one phase. Phase 16 is a verification phase and carries no new requirement IDs — it re-exercises PODGEN-* and PODPLAY-* against a real ElevenLabs key following the v1.1 Tier-B pattern.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PODGEN-01 | Phase 14 | Complete |
| PODGEN-02 | Phase 14 | Complete |
| PODGEN-03 | Phase 14 | Complete |
| PODGEN-04 | Phase 14 | Complete |
| PODGEN-05 | Phase 13 | Complete |
| PODGEN-06 | Phase 14 | Complete |
| PODGEN-07 | Phase 14 | Complete |
| PODGEN-08 | Phase 14 | Complete |
| PODPLAY-01 | Phase 14 | Complete |
| PODPLAY-02 | Phase 14 | Complete |
| PODPLAY-03 | Phase 14 | Complete |
| PODPLAY-04 | Phase 14 | Complete |
| PODPLAY-05 | Phase 14 | Complete |
| PODUX-01 | Phase 14 | Complete |
| PODUX-02 | Phase 14 | Complete |
| PODUX-03 | Phase 14 | Complete |
| PODRES-01 | Phase 15 | Complete |
| PODRES-02 | Phase 15 | Complete |
| PODRES-03 | Phase 15 | Complete |
| PODDEP-01 | Phase 13 | Complete |
| PODDEP-02 | Phase 13 | Complete |

**Coverage:**
- v1.2 requirements: 21 total
- Mapped to phases: 21 ✓
- Unmapped: 0

**By phase:**
- Phase 13 (Firewall Spike + Mockable Backend Foundation): 3 requirements — PODDEP-01, PODDEP-02, PODGEN-05
- Phase 14 (Podcast Endpoint + Player): 15 requirements — PODGEN-01/02/03/04/06/07/08, PODPLAY-01/02/03/04/05, PODUX-01/02/03
- Phase 15 (TTS Health + Graceful Degradation): 3 requirements — PODRES-01, PODRES-02, PODRES-03
- Phase 16 (Live Verification + Audit): 0 new requirements (verification phase)

---
*Requirements defined: 2026-04-17*
*Last updated: 2026-04-18 — Phase 13 complete (PODDEP-01, PODDEP-02, PODGEN-05 marked Complete); 3/21 requirements delivered*
*Last updated: 2026-04-19 — v1.2 milestone audited tech_debt (non-blocking); all 21 requirements empirically validated against real ElevenLabs endpoint (evidence: `.planning/phases/16-live-elevenlabs-verification/16-LIVE-VERIFICATION.md`)*
