# Phase 7: Debrief, Export & Config Generation - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Two user-facing workflows that complete the facilitator experience:

1. **Debrief export (DEB-01..03)** — Generate a downloadable markdown `.md` artifact of the session (metadata, full transcript, per-round state snapshots, debrief section). Triggered from the game screen; saved as a file (not opened in a new tab).
2. **Generate-from-brief (SETUP-04, SETUP-05)** — Facilitator types a free-text brief on the setup screen, backend LLM returns a generated `GameConfig` JSON, config is piped to the existing Load-panel review mode pre-populated, schema errors surface with field-level detail.

In scope: UI, store plumbing, markdown formatting, schema validator, backend prompt refinement to match the frontend `GameConfig` shape.

Out of scope: PDF export, cloud upload, export history, streaming generation, voice commentary, multi-session comparison views.

</domain>

<decisions>
## Implementation Decisions

### Debrief markdown shape

- **File format**: plain markdown (`.md`), UTF-8, no front-matter
- **Filename**: `debrief-{kebab-game-name}-{YYYY-MM-DD-HHmm}.md` (e.g. `debrief-edip-2026-04-14-1530.md`). Timestamp disambiguates repeated exports of the same session.
- **Top-level structure** (in order):
  1. `# {Game name} — Debrief Report` (H1)
  2. **Metadata block** — Game name, domain, scenario name + index, session start/end timestamps, rounds played, round when debrief was triggered, facilitator-supplied notes field (empty placeholder line)
  3. `## Round {n}` sections, one per completed round, chronological
     - `### State at start of round` — compact snapshot: crisis severity (0–5) + crisis state label, EDIP legitimacy (−2..+2), per-team resource grid (PC / PO / RDY / STK / CRM / IC)
     - `### Transcript` — every message for that round in order
       - Facilitator: `**Facilitator:** {text}`
       - Persona: `**{Persona name} ({team code}):** {text}` — uses `PERSONA_META` labels from `src/lib/personaConfig.ts`
       - Errors: `_[Error {code}: {message}]_` italicised inline
       - Loading indicators and round dividers: omitted (section heading conveys the boundary)
  4. `## Debrief` — all persona messages after the first `debrief_divider` in the transcript
  5. `## Final State` — same snapshot schema as per-round but reflecting current state at export time
- **Content principles**: no raw JSON, no `stateUpdate` deltas inline (decisions already show up in the next snapshot), no individual message timestamps (session duration in metadata is enough)
- **Store addition required**: `stateSnapshots: Record<number, GameState>` keyed by round index. Snapshot captured on every `advanceRound` transition (push pre-advance state under the round being completed). Seeded on `initGame` with round 1's starting state.

### Debrief trigger UX

- **Split the two buttons' semantics**:
  - `Request Debrief Now` → interim debrief. Inserts `debrief_divider`, fires LLM turn, does NOT end the game. Facilitator can keep playing rounds.
  - `End Game + Debrief` → final debrief. Inserts `debrief_divider`, fires LLM turn, AND sets `gameEnded: true` on `GameState`.
- **New state field**: `gameEnded: boolean` on `GameState`, default `false`. No automatic transition; set only by the End Game action. When `true`: disable `advanceRound`, `sendFacilitatorMessage`, and round-advance UI affordances (input stays enabled for post-mortem chat is out of scope — disable the send button).
- **Download Debrief button**:
  - Location: ActionToolbar, appears once at least one `debrief_divider` exists in `messages` (interim or final both qualify)
  - Label: `Download Debrief (.md)` — explicit filetype hint
  - Always regenerates fresh `.md` from current store state on each click; no stored export history
  - No confirmation dialog (non-destructive)
- **Download mechanism**: browser-native Blob + `URL.createObjectURL` + synthetic anchor click + `URL.revokeObjectURL`. Zero third-party deps. Matches DEB-03 (file save, not new tab).

### Generate-from-brief flow

- **Route**: HomeScreen → `Generate from Brief` button (currently disabled — enable it) → SetupScreen `'brief'` mode → GenerateBriefPanel → on success, transition to `'load'` mode with generated JSON pre-populated → facilitator reviews / edits → Launch.
- **Review-before-launch is mandatory** — never auto-launch from a generated config. Enforced by routing through the existing LoadConfigPanel (satisfies SETUP-05 verbatim).
- **State plumbing**: lift `configJson: string` to the store as `draftConfigJson`. Both GenerateBriefPanel (writer) and LoadConfigPanel (reader + writer) bind to the same field. Survives mode transitions without prop-drilling.
- **Brief input UI**:
  - Multi-line textarea, placeholder example (e.g. "Three-round energy crisis tabletop: EU Commission, Russia, Ukraine, US State Dept…")
  - Character counter. Min 50 chars enables `Generate` button; max 4000 chars caps input.
  - Store's existing `briefText` field persists input across mode toggles so the facilitator can tweak and regenerate without retyping.
  - Two or three static example-brief chips above the textarea as quick-start templates (click populates textarea; reduces blank-canvas friction).
- **Back-nav**: In LoadConfigPanel, when the loaded config originated from a brief (flag: `draftSource: 'brief' | 'load' | null` on store), show a `← Back to Brief` link that returns to `'brief'` mode with `briefText` intact. Regular Load flow (user-pasted JSON) doesn't show the link.
- **Backend prompt rewrite (CRITICAL)**: `CONFIG_GEN_SYSTEM_PROMPT` in `backend/app/routers/config_gen.py` currently asks for the wrong shape (`scenarioName`, `injectCards`, `winConditions`). Phase 7 rewrites it to produce JSON that matches the frontend `GameConfig` interface exactly: `name`, `domain`, `description`, `scenarios[]` (with `ScenarioStartState`), `teams[]`, `nationalActions[]`, `cards[]`, `objective`, `redLines`, `pcThresholds`, `votingRule`, `eoMechanic`, `resourceLogic`, `facilitation`. Prompt should embed a condensed EDIP excerpt as a structural exemplar.

### Generation UX & errors

- **Loading state**: inline spinner inside GenerateBriefPanel with copy `Generating config… this usually takes 15–30 seconds`. Generate button disabled while loading; brief textarea remains editable (user can prep revisions). Cancel button exposes `AbortController` plumbing — reuse the same pattern as `llmClient.ts` from 06-06.
- **No streaming** — backend returns a single response; this is a blocking fetch with a loading indicator.
- **Upstream error mapping**: backend error codes → user-readable inline messages above the textarea:
  - `LLM_TIMEOUT` → "Generation timed out. Try again or shorten your brief."
  - `LLM_AUTH_ERROR` → "Backend credentials issue. Contact the facilitator admin."
  - `LLM_UPSTREAM_ERROR` → "LLM service returned an error. Try again."
  - `LLM_UNREACHABLE` → "Can't reach the LLM service. Check your connection."
  - `INTERNAL_ERROR` → "Unexpected error. Try again; if it persists, check backend logs."
  - Retry is always a Generate button re-click. No auto-retry.
- **Post-generation parse failure** (backend returned text that isn't JSON): inline error "Generated config wasn't valid JSON — try simplifying your brief or clicking Generate again." Raw response logged to dev console for debugging. Brief and textarea preserved.
- **Schema validation errors (SETUP-05)**:
  - **New validator**: `validateGameConfig(parsed: unknown): { ok: true, value: GameConfig } | { ok: false, errors: Array<{ path: string, message: string }> }` — deep, field-level.
  - Path format: `scenarios[0].injects[2]: missing 'text' field`, `teams[1].startState.pc: expected number 0–6, got "strong"`, etc.
  - Valid top-level parse but failed deep validation → route to LoadConfigPanel with JSON pre-populated AND a "Structure OK but N fields need attention" banner listing every error path. Facilitator edits JSON inline; errors re-evaluate on the existing 300ms debounce.
  - Launch button disabled while any validation errors remain.
- **Validator scope for v1**: required fields only — `name`, `scenarios[].injects`, `teams[].startState` numerics, `cards[]` shape, `nationalActions[]` shape, `pcThresholds`. Optional-field type checking deferred to Phase 8 QA boundary-value suite.

### Claude's Discretion

- Exact Tailwind styling and spacing of GenerateBriefPanel
- Whether per-round state snapshots render as markdown tables or bullet lists (pick whichever stays readable in plain text and VS Code preview)
- Whether to include a `## Appendix: Raw Config` section at the bottom of the debrief `.md` (lean toward yes — one-line summary of config name + scenario index for traceability)
- Precise error copy wording (within the error-code mapping above)
- Whether `AbortController` for generate-brief is a fresh instance or shares the orchestration pattern from 06-07 (likely fresh — config generation is independent of the main LLM turn loop)
- Whether the "back to brief" link is an icon button or a text link
- Example-brief chip count (2 or 3) and content

</decisions>

<specifics>
## Specific Ideas

- Debrief `.md` should be readable both in VS Code preview and GitHub. Avoid exotic markdown extensions (no Mermaid, no footnotes).
- Metadata format should mirror YAML-like readability even though we're not using YAML front-matter: `- Game: EDIP` style bullets.
- The "Request Debrief Now" / "End Game + Debrief" split aligns with plan-06-07's note: "Plan 08 may split semantics (interim vs end-of-game clears cardsThisRound, etc.)". Phase 7 formalises the split.
- Backend prompt rewrite should embed a **condensed EDIP config fragment** in the system prompt as the shape exemplar — strongly reduces invalid-JSON rate and shape drift.
- Example brief chips should cover distinct domains (e.g. energy crisis, cyber incident) so facilitators can see the prompt generalises beyond EDIP.

</specifics>

<deferred>
## Deferred Ideas

- **PDF export of debrief** — requires PDF generation library; separate phase
- **Cloud upload / shareable link for debrief** — requires auth + storage backend; separate phase
- **Streaming config generation with progressive JSON validation** — Phase 8+ polish
- **Regenerate-with-context** (pass prior validation errors back to the LLM for self-correction) — Phase 8 polish
- **Multi-round comparison view** ("show deltas between round 2 and round 4") — new analysis feature, own phase
- **Facilitator commentary / voice notes attached to debrief** — content feature, own phase
- **Export history / download archive** — requires persistence layer; separate phase
- **Markdown-to-HTML server-side rendering** for a web-viewable debrief — out of scope (local file save only per DEB-03)

</deferred>

---

*Phase: 07-debrief-export-config-generation*
*Context gathered: 2026-04-14*
