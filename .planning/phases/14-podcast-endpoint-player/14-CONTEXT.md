# Phase 14: Podcast Endpoint + Player (End-to-End on Fake) - Context

**Gathered:** 2026-04-18
**Status:** Ready for planning
**Decision Mode:** User delegated all four areas to Claude; decisions below are grounded in expert UX research (NN/g, Material Design 3, Apple HIG) reconciled with locked success criteria from ROADMAP.md.

<domain>
## Phase Boundary

A facilitator finishes a war-game session, clicks **Generate Podcast** in the debrief area, and — with `TTS_PROVIDER=fake` — sees a three-voice stitched MP3 (Kent → Finch → Chen) appear in an inline HTML5 player. They can play, skip between persona segments, download with a correctly-named filename, cancel mid-generation, and re-generate (bypassing cache with confirmation). The expandable markdown transcript sits below the player. Zero live ElevenLabs traffic — every UX surface is debugged against the fake provider before Phase 16 spends a real API byte.

**Out of scope (by roadmap):** Real ElevenLabs provider calls (Phase 16), TTS health endpoint (Phase 15), graceful-degradation empirical verification (Phase 15).

</domain>

<decisions>
## Implementation Decisions

### Generation Progress UX

- **Progress bar is discrete, not time-based.** Derived from backend per-segment completion events: 0% → 33% (Kent done) → 66% (Finch done) → 100% (Chen done). No client-side fake percentage that could stall mid-segment. (NN/g: fake determinate bars erode trust when they stall.)
- **Per-persona status line** (already locked in SC4): `Kent ✓ · Finch rendering… · Chen waiting`. This is the primary signal — the progress bar is a secondary visual aid.
- **Within-segment animation**: subtle pulse/shimmer on the currently-rendering persona row. Optimistic, purely decorative, no numeric progress inside a segment.
- **Cancel button**: secondary-styled, placed adjacent to the progress block, **no confirmation dialog**. One click aborts the fetch, discards partial audio silently, and returns the UI to pre-generation state (Generate button visible again, no partial MP3 surfaced).
- **Rationale**: NN/g "Progress Indicators" endorses indeterminate + descriptive status for unknowable-percentage work; adding a confirmation to Cancel creates friction for an action the user has already decided on.

### Player Surface Layout

Visual hierarchy, top to bottom:

1. **"Now playing: {Kent|Finch|Chen}" text label** (SC3 requirement — literal text, lightweight typography, updates at each segment boundary).
2. **Standard HTML5-style audio player** — play/pause, scrubber, time display.
3. **Three skip buttons in a row** below the scrubber: labeled **`Kent`**, **`Finch`**, **`Chen`** (not "Skip to Kent" — terser labels read better at n=3, per Fitts's-Law reasoning in Apple HIG / Smashing audio-player guidance).
4. **Active persona's button is visually distinguished** (filled vs outlined, or background-colored) — mirrors the "Now playing" label so visual and textual cues reinforce each other rather than compete.
5. **Download MP3 button** sits in the `ActionToolbar` next to "Download Debrief (.md)" (SC1 requirement), not inside the player.

### Word-Count Ceiling Dialog

- **Modal confirmation dialog** (SC4 explicitly says "dialog" — honoring that wording).
- **Trigger**: combined debrief text word count > 2000 (soft ceiling).
- **Dialog shows exactly 2 numbers**: estimated audio length (minutes) + estimated generation time (seconds). Word count is implementation detail — not in the dialog body.
- **Copy** (reference template; exact wording is Claude discretion): *"This session is long. Podcast will be about {N} minute(s) and take about {M} seconds to generate."*
- **Buttons**: `Generate` (primary) / `Cancel` (secondary).
- **Rationale**: NN/g and Material both warn against over-using modals for informational content, but the roadmap locks a dialog here — we comply while keeping the dialog lean (two numbers max) to avoid decision fatigue.

### Cache & Re-generate UX

- **Cache hit → instant playback, no visible "from cache" indicator.** Speed is the feedback (NN/g "Response Times: The 3 Important Limits" — sub-100ms reads as "just worked"). No "cached vs fresh" badge, no toast.
- **Re-generate button → single click opens confirmation dialog** (SC5 requirement).
- **Re-generate dialog copy** (reference; exact wording is Claude discretion): *"Re-generate podcast? The current audio will be replaced. Takes about {M} seconds."*
- **Re-generate dialog buttons**: `Re-generate` (primary) / `Cancel` (secondary).
- **No "force fresh" toggle, no "cached vs fresh" indicator anywhere.** Don't push an infra decision onto the user.
- **Rationale for diverging from the ChatGPT/Claude one-click-regenerate convention**: Phase 16 will swap the fake provider for real ElevenLabs calls with non-zero cost. SC5's confirmation gate is the guardrail for that future — keeping it now means the UX doesn't change when credentials go live.

### Transcript Panel

- Collapsed by default, rendered below the player (SC6 requirement).
- Trigger: `Show transcript` / `Hide transcript` button with chevron icon.
- Uses the existing markdown rendering path — no new markdown dependency (SC6 requirement).
- **No playback-position sync to transcript.** Deferred — over-engineered for this phase.

### Download Filename Edge Cases

- Template (SC2 locked): `debrief-{kebab-game-name}-{YYYY-MM-DD-HHmm}.mp3`.
- **Kebab-casing**: lowercase; spaces → hyphens; strip characters that are not `[a-z0-9-]`; collapse runs of hyphens.
- **Empty or all-stripped game name fallback**: `debrief-session-{YYYY-MM-DD-HHmm}.mp3`.
- Timestamp is the client's local time at the moment Generate was clicked (not generation-complete time — facilitator-intuitive).

### Error & Disconnect States

- **Provider error during generation** (even on fake — tested via deliberate error injection): inline error banner in the player area with structured reason code; "Download Debrief (.md)" remains fully functional. Empirical graceful-degradation verification is Phase 15's job; Phase 14 just needs to not *break* the markdown path on failure.
- **Client disconnect mid-generation** (tab close, navigation away): backend checkpoint tears down the in-flight serial provider calls (covered in plan 14-01). No client-side persistence — UI starts fresh on next load.

### Claude's Discretion

- Within-segment shimmer/pulse animation details (timing, easing, opacity curve).
- Skip-button visual treatment (chip vs pill vs button) provided active-state is clear.
- Segment-boundary tick marks on the scrubber — nice-to-have, skip if it complicates the scrubber markup.
- Exact typography scale for the "Now playing:" label.
- Relative-timestamp element near the player ("Generated just now" / "Generated 2 min ago") — add if it composes cleanly, skip otherwise.
- Chevron icon choice for the transcript toggle.
- Exact dialog copy (templates above are reference wording, not locked strings).

</decisions>

<specifics>
## Specific Ideas

**Closest UX analogs informing the above decisions:**
- **NotebookLM audio overview** — generation flow (indeterminate animation + evolving status copy during long renders).
- **Pocket Casts / Overcast** — inline chapter buttons when chapter count is small (≤5); dropdown reserved for long chapter lists.
- **ChatGPT / Claude regenerate** — one-click regenerate convention. We intentionally diverge by gating on a confirmation dialog (per SC5) because Phase 16 will bring real cost.

**Research foundation** (sources the above cite):
- NN/g, "Progress Indicators Make a Slow System Less Insufferable" — indeterminate progress + descriptive status for unknowable-percentage operations.
- NN/g, "Response Times: The 3 Important Limits" — sub-100ms = "instant" = no label needed.
- NN/g, "Confirmation Dialogs Can Prevent User Errors — If Not Overused" — reserve modals for decisions, not information.
- Material Design 3 progress indicators + dialogs guidelines — use indeterminate when completion time is unknown; avoid dialogs for transient information.
- Apple HIG, "Playing audio" — buttons for small segment counts, scrubber ticks for segment structure.

**Cross-cutting principle the decisions follow:** Honesty over theater (no fake percentages), reserve modals for decisions, and let speed itself be feedback when nothing else needs to be said.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. Two items were considered and intentionally scoped as Claude discretion (add-or-skip) rather than required:
- Segment-boundary tick marks on the scrubber — may ship in 14-03 if it composes cleanly.
- Relative-timestamp element ("Generated 2 min ago") — may ship in 14-03 as a subtle provenance signal.

Transcript ↔ playback-position sync was considered and deferred to a potential future phase — not added to backlog because no requirement exists for it.

</deferred>

---

*Phase: 14-podcast-endpoint-player*
*Context gathered: 2026-04-18*
