# Phase 6: LLM Integration - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the complete LLM loop: facilitator input → in-character persona responses (Kent/Finch/Chen) → live GameState updates. Hardened against malformed JSON, context overflow, state out-of-range, and credential leakage. Scope covers prompt construction, persona routing, LLM client with timeout/parse defense, state update/clamping, context windowing, and the FacilitatorInput → llmClient → stateUpdater → store wiring. Debrief markdown export and config generation are Phase 7. Voice input, multi-user, and undo are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Persona routing rules (Control Cell pattern)
- **Round-start trigger** → Kent (framing / convener) + Finch (inject / disruption), in that order. Classic orientation+perturbation opening of a tabletop serial.
- **Card play trigger** → persona by card category:
  - Institutional / political / legitimacy cards → Kent
  - Adversary / disruption / escalation cards → Finch
  - Technical / operational / readiness cards → Chen
  - Ambiguous / multi-category → Kent as default (senior convener)
- **Dispute / challenge trigger** → the persona being challenged responds; optionally one other persona adds corroborating or dissenting colour (max 2 total).
- **Debrief trigger** → all three personas speak, fixed order Kent → Finch → Chen (BLUF: Kent frames, Finch dissents, Chen grounds in data).
- **Fixed response order whenever multiple personas speak in a turn:** Kent → Finch → Chen. Consistent ordering reduces facilitator cognitive load and matches Red/Blue/White panel convention.
- **Min 1, max 3 persona responses per facilitator input.** Never zero (silence is confusing); no duplicate persona in one turn.
- Prompt instructs LLM to select `personas: ["kent" | "finch" | "chen", ...]` in the JSON response. `stateUpdater` enforces the min/max/no-duplicate rules defensively.

### Response flow & timing UX
- **Single LLM call returns full multi-persona response**, then UI reveals each persona bubble sequentially with a **~500ms stagger** between bubbles — simulates panel turn-taking. Feels like a briefing, not a chat bot.
- **Loading state:** reuse the Phase 5 `loading` message type with animated dots. Global single indicator, persona attribution rotates through the planned speakers ("Kent is preparing response…" → "Finch is preparing response…") if we can predict order from the prompt, otherwise generic "Briefing in progress…".
- **No character-by-character typing animation.** Full bubble renders instantly on reveal. Ghost-typing feels gimmicky in a professional facilitation context.
- **Input + action buttons disabled during LLM call** — already locked in Plan 05-07.
- **Auto-scroll to bottom on each new bubble** — sticky-bottom hook from Plan 05-04 handles this; confirm behaviour holds across staggered inserts.
- **AbortController timeout** wired into the llmClient; corporate-proxy timeout estimated 30s (see STATE.md Phase 6 research flag). Timeout → error path below.

### Error recovery UX
- **Malformed JSON / parse failure** → red error bubble in chat feed containing:
  1. Plain-English reason ("Response was not valid JSON" / "Response missing required field: personas").
  2. Collapsible "Show raw response" panel revealing the raw LLM text. Keeps audit trail visible to the facilitator without cluttering default view.
  3. Inline **Retry** button — re-sends the same facilitator input with the same context window. Single click, no editing UI.
- **Timeout** → distinct red error bubble ("LLM timed out after Ns") with the same Retry affordance.
- **Network / 5xx from backend** → distinct red error bubble with backend error code + Retry.
- **Atomicity guarantee:** state is **never** mutated on a failed/malformed response. Either full parse success → full state update, or zero state change. This prevents partial-update confusion mid-scenario.
- **Session is not blocked by an error bubble** — facilitator can ignore the error and type the next message. The error bubble persists in chat history as an audit record.
- **No edit-and-resubmit-raw-response UI.** Out of scope — retry or move on is enough.
- **Clamping is silent but logged** — if LLM returns `crisisSeverity: 7`, it's clamped to 5 with no user-facing banner; dev console logs the clamp. Prevents facilitator confusion about apparent "wrong" values.

### State update visibility
- **Animated track bar transitions** on severity and legitimacy bars — 400ms ease-out from old → new value. Number readout ticks through intermediate integers.
- **Delta ghost-text** ("+1" / "−2") fades in next to each changed resource field, holds ~2.5s, fades out. Colour semantic:
  - Green for favourable movement (PC up, readiness up, legitimacy toward +2, severity down)
  - Red for unfavourable movement (PC down, readiness down, legitimacy toward −2, severity up)
  - Direction-of-"favourable" is persona-agnostic at the UI layer — the colour map lives in stateUpdater metadata, not the LLM response
- **Pulse/flash the changed cell** — subtle background tint (~800ms) on any TeamCard field that moved. Makes peripheral-vision changes legible during fast-paced turns.
- **PC warning badges** (STRAINED amber / CRISIS red from Plan 05-06) re-evaluate on each state update; badge flashes on threshold crossing.
- **Persona indicator dots** (top-of-panel from Plan 05-02/06) update to reflect `personasThisRound` — if Chen didn't speak this round, Chen's dot is dim.
- **No undo UI** — facilitator cannot reverse an applied state change. Captured in deferred ideas.

### Round advancement & debrief control (LLM-signaled with confirmation)
- LLM can include optional `control: { advanceRound?: boolean, triggerDebrief?: boolean }` in the JSON schema.
- When `control.advanceRound: true` is received → UI shows a non-blocking banner above FacilitatorInput: "Advance to Round N+1?" with [Advance] [Dismiss] buttons. On Advance → round_divider message inserted, `round++`, store updates.
- When `control.triggerDebrief: true` is received → same confirmation pattern: "Enter debrief?" with [Enter Debrief] [Dismiss]. On accept → debrief_divider inserted, debrief state entered; next facilitator message or auto-trigger prompts all three personas for final BLUF-style reflections.
- **Manual overrides always available** — facilitator can advance the round or trigger debrief from a header button regardless of LLM signal. Facilitator never loses control.
- Dismissing an LLM-signaled control banner does not re-trigger; facilitator must manually advance if they change their mind.

### Context windowing strategy
- **Sliding window of N=6 message pairs** (12 entries: 6 facilitator + 6 persona-response) per CTX-02 baseline. Configurable via constant for Phase 8 tuning.
- **System prompt** (full 10-block construction) is always included — never windowed out. That's the persona-voice anchor.
- **Round divider messages** are included in the window when they fall inside it; they give the LLM temporal grounding.
- **No summary-of-dropped-turns** in Phase 6 — adds prompt-engineering complexity without proven benefit at N=6. Revisit in Phase 8 if Round 4+ shows voice drift.
- **`llmHistory.length` invariant**: never exceeds `2×N+1 = 13` entries. Enforced in the prompt builder, tested in Plan 06-06.
- **Token budget measurement** happens in Plan 06-06 with real EDIP config, establishing an empirical prompt-size baseline before locking N.

### Claude's Discretion (explicit flexibility for planner/executor)
- Exact markdown-fence-stripping regex and JSON-parse defensive layers (pre-parse cleanup, schema validation order, which fields are "required" vs "optional no-op").
- Animation easing curves, exact durations within the ranges given, pulse colours (constrained to existing Tailwind @theme tokens).
- Exact copy for error bubbles and confirmation banners.
- Whether to extract shared error-bubble component or inline per error type.
- Exact structure of the `control` JSON block and whether it lives at response root or nested.
- Retry implementation detail: does Retry use a new `AbortController`, reuse cached last-input, or re-build from store?
- Whether the 500ms stagger is hard-coded or uses `requestAnimationFrame`/`setTimeout` chain.

</decisions>

<specifics>
## Specific Ideas

- **Feel target:** professional Red/Blue/White panel briefing, not a consumer chatbot. No bubbly animations, no emoji-heavy output, no gimmicky typing indicators.
- **Audit trail is non-negotiable:** raw LLM responses must always be inspectable by the facilitator (via the collapsible "Show raw response" on error bubbles, and dev-console logs of parsed responses). Facilitator is running a real exercise and needs to defend outcomes post-session.
- **Facilitator stays in control:** LLM suggestions (round advance, debrief) are always confirmable, never auto-applied. Clamping is silent because it's a defensive guard, not a decision — but control-flow changes are always explicit.
- **State changes must be legible in peripheral vision** — facilitator is watching chat and teams simultaneously. Animations + delta indicators + pulses are all aimed at making "something moved" visible without requiring eye-track.
- **Credential isolation (already locked in Phase 2):** all LLM traffic is server-to-LLM. Frontend never touches the corporate API key. Phase 8 audit will verify zero `Authorization` headers in browser Network tab.

</specifics>

<deferred>
## Deferred Ideas

- **Undo for state changes** — not in Phase 6. If facilitator wants to reverse a state update, they currently can't. Candidate for a future "facilitator correction" phase or roadmap backlog.
- **Edit-and-resubmit raw LLM response** — facilitator editing a malformed response by hand to salvage state updates. Out of scope; retry is sufficient.
- **Streaming / character-by-character typing** — rejected on feel-target grounds. Deferred as a configurable UI option if facilitator preference data later supports it.
- **Summary-of-dropped-turns context compression** — not needed at N=6; revisit in Phase 8 if Round 4+ shows persona voice drift or JSON format degradation.
- **Multi-user facilitator sessions / observer mode** — not in scope for v1. Roadmap backlog.
- **Voice input / speech-to-text for facilitator** — roadmap backlog.
- **Persona "catch-up" summary when a persona has been dim for multiple rounds** — roadmap backlog.

</deferred>

---

*Phase: 06-llm-integration*
*Context gathered: 2026-04-14*
