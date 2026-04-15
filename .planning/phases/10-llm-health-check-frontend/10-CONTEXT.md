# Phase 10: LLM Health Check — Frontend - Context

**Gathered:** 2026-04-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a live LLM connection indicator to the setup screen that auto-checks on mount, displays pass (green + latency) or fail (red + actionable hint) state, offers a manual Re-check, and disables the Launch button while the check is failing or in-flight. Consumes the `GET /api/health/llm` endpoint shipped in Phase 9. The backend endpoint itself and any configuration-editing affordances are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Indicator visual + placement
- Single inline status badge, placed directly above the "Launch Scenario" button on the review/launch step — not a header banner, not a toast
- Three visual states in one component:
  - **Checking:** neutral spinner icon + "Checking LLM connection…"
  - **OK:** green filled dot + "Connected — {latency}" (format: `820ms` under 1s, `1.2s` at/over 1s)
  - **Failed:** red filled dot + "{status} — {hint}" (e.g., `401 — Check LLM_API_KEY in .env`)
- Dot + text sit on one line; badge is left-aligned with the Launch button, same horizontal container
- Re-check button sits immediately to the right of the badge (icon-only with aria-label, or "Re-check" text button — Claude's discretion on which fits the existing design system)
- Reuse Phase 3 design tokens for semantic colours (success/error/neutral) and spacing — do not introduce new palette entries
- No tooltip-only state: the badge itself is the explanation; nothing is hidden behind hover

### Re-check trigger behavior
- **Auto-check on mount of the review/launch step only** — not on the home or load/generate screens (the check is only meaningful once the facilitator is about to launch and ~50 tokens are cheap but not free)
- **No re-check on config edits** — health checks the LLM endpoint/credentials (backend .env), which config edits cannot change; re-running on every config field mutation would be noise
- **Manual Re-check button** always available in every state (checking, ok, failed) — during `checking` it is disabled to prevent double-fire
- **No automatic retry on failure** — facilitator decides when to retry; silent auto-retry can mask a real problem and waste tokens
- **No polling/periodic refresh** — one-shot on mount + manual Re-check only

### Error display + actionability
- Full failure detail rendered inline on the badge — no expandable/collapsible "Details" affordance
- Format: `{status} — {hint}` where `status` is the numeric HTTP code (or the backend's string code like `timeout` / `network_error` when no HTTP status exists) and `hint` is the human-readable string the backend already provides (Phase 9 ships hints like "Check LLM_API_KEY in .env")
- The backend is the single source of truth for hint text — the frontend does **not** map codes to its own hint strings, it just renders what it receives
- No copy-to-clipboard button, no link-to-docs button, no "report this" action — YAGNI for v1.1; facilitator sees the hint and edits their `.env` directly
- If the fetch itself fails (backend unreachable, not just LLM unreachable) render a distinct red-dot message: `Backend unreachable — is the API server running?` — this is a frontend-originated hint since there's no backend response to forward

### Launch gating UX
- "Launch Scenario" button is **disabled** whenever status is `checking` or `failed`; enabled only when status is `ok`
- The disabled button stays visually greyed-out (standard disabled styling from Phase 3 tokens) — do not hide it, do not replace it with an error card
- The status badge immediately above the button **is** the explanation — no separate tooltip on the disabled button, no helper text duplicating the hint
- **No override / "launch anyway" escape hatch** — the whole point of this phase (per v1.1 milestone goal) is preventing broken-pipeline live runs; an override would defeat the gate
- While `checking`, the button label stays "Launch Scenario" (unchanged) — the badge already says "Checking LLM connection…", so the button doesn't need to duplicate that

### Claude's Discretion
- Exact component decomposition (single `HealthBadge` component vs. compound `HealthBadge` + `RecheckButton`)
- Icon library / specific icons for dot and spinner (match whatever Phase 3 established)
- Transition/animation between states (fade, no animation, etc.)
- Re-check button as icon-only vs. text — pick whichever matches existing setup-screen button patterns
- Whether latency gets any colour gradation (e.g., amber over 3s) — default is plain green with numeric latency; add gradation only if it fits naturally
- Zustand store shape vs. local component state for the health query — pick based on whether the Launch button needs to read status from elsewhere
- Exact fetch/retry/timeout wiring on the frontend side (but: must NOT retry automatically on failure — that's a locked decision above)

</decisions>

<specifics>
## Specific Ideas

- "Green means go, red means fix it first" — the milestone phrasing; keep the indicator that binary and obvious. Latency is informational, not a third state.
- Reuse Phase 3's established component library and design tokens — the indicator should feel native to the existing setup screen, not bolted on.
- Backend hint text is authoritative (Phase 9 ships an 8-code taxonomy with human-readable hints) — the frontend's job is to render it clearly, not interpret it.

</specifics>

<deferred>
## Deferred Ideas

- Copy-to-clipboard on error hints — YAGNI for v1.1, reconsider if facilitators report pain
- Link-to-docs / link-to-`.env`-template from the error state — defer until there is docs to link to
- Periodic background re-check (e.g., every 60s while on setup screen) — not in success criteria; revisit if live runs surface "was fine at setup, dead at launch" incidents
- Latency colour gradation (amber for slow, red for very slow) — defer unless a real latency-quality threshold emerges from live-run data
- Launch-anyway override — explicitly rejected for v1.1 (defeats the gate); would need milestone-level decision to revisit
- Health check on home/load screens — deferred; only the review/launch step gates Launch, so only that step needs the check

</deferred>

---

*Phase: 10-llm-health-check-frontend*
*Context gathered: 2026-04-15*
