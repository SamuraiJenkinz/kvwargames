---
phase: 08-qa-credential-audit
plan: 02
subsystem: testing
tags: [live-run, corporate-llm, scenario-2, credential-audit, har-capture, debrief-export, multi-trigger-routing, validation-failure, persona-voice-consistency]

# Dependency graph
requires:
  - phase: 06-llm-integration
    provides: buildSystemPrompt, windowHistory (HISTORY_WINDOW_N=2), reportPromptBudget, responseParser Layer-3 validator, llmClient, runLLMTurn, SAFE_CONTEXT_CEILING_TOKENS=7500, LLM_FRONTEND_TIMEOUT_MS=45000
  - phase: 07-debrief-export-config-generation
    provides: triggerDebrief action, gameEnded flag, generateDebriefMarkdown, Download Debrief toolbar button
  - phase: 08-qa-credential-audit
    provides: 08-01 stateUpdater null/undefined coverage; 08-03 static credential audit + key-rotation checklist; 08-04 error-injection + missing-env-var pytest coverage; 08-05 debrief bucketing fix + block-8 multi-trigger static coverage
provides:
  - Live corporate-LLM behavioural validation of 5-round Scenario 2
  - HAR network evidence closing 08-03 §3 forward dependency (zero credential leakage on browser→backend POST /api/llm)
  - End-to-end live-pipeline verification of 08-05 bucketing fix (persona debrief messages appear only in ## Debrief section of downloaded markdown)
  - Organic VALIDATION_FAILURE evidence satisfying Phase 8 success criterion #4 more strongly than the planned synthetic offline-injection test
  - Phase 9 backlog: GuardedGameScreen DEV-seed setState-during-render defect spec, R1-input first-character strip, crisisState auto-advance prompt nudge
affects: [phase-8-verifier, phase-8-closure, phase-9-polish-backlog, roadmap-final-phase-signoff]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Live-run single-artifact pattern: every telemetry item from 08-CONTEXT has a 1:1 section in 08-02-LIVE-RUN.md (ops confirmations, per-round telemetry, network evidence, downloaded debrief, hygiene grep, facilitator verdict)"
    - "Prod-build fallback for late-round capture: pnpm build + FastAPI static mount at :8000 used for R4/R5 to avoid HMR-triggered DEV-seed bug"
    - "Organic validation-failure as stronger evidence than synthetic offline-injection — when the real LLM produces a shape-mismatch, the Layer-3 validator + retry flow are exercised against genuinely malformed input rather than a network-level interruption"

key-files:
  created:
    - .planning/phases/08-qa-credential-audit/08-02-LIVE-RUN.md
    - .planning/phases/08-qa-credential-audit/08-02-network.har
    - .planning/phases/08-qa-credential-audit/08-02-DEBRIEF-export.md
  modified: []

key-decisions:
  - "Facilitator verdict: PASS-WITH-POLISH (approved 2026-04-15 01:30). Three polish items deferred to Phase 9; none block Phase 8 closure."
  - "Manual offline-injection test skipped — superseded organically by the R5 VALIDATION_FAILURE (genuine LLM shape-mismatch exercises the same Layer-3 validator + RETRY flow more strongly than a WiFi-off network interruption would)"
  - "Prod-build session used for R4/R5 capture window after dev-mode HMR caused DEV-seed bug reproductions between rounds; R1-R3 evidence came from initial dev-mode session (authoritative); prod session's R1-R3 fast-forward content deliberately not captured"
  - "Context window and proxy timeout Ops Confirmations recorded as ASSUMED (ops confirmation not obtained pre-run); 5-round live run validated 8k context assumption with 776+ tokens of headroom across every turn; no proxy timeout observed across ~10 LLM calls"
  - "API key rotation status confirmed YES pre-run (2026-04-14) per 08-03 §4.1 checklist — closes the Phase 6/7 chat-log leak taint"

patterns-established:
  - "Transcript hygiene grep as pre-commit gate: `grep -E \"sk-|Bearer |Authorization:\" <artifact files>` — self-referential matches (redaction instructions, credential-audit tables) acceptable; any other match HALTS commit and triggers redaction + fresh rotation per 08-03 §4.1"
  - "HAR-over-screenshot for network evidence when the session has a single audit-target request — machine-parseable, captures full req/res headers, one file covers all credential-absence claims"
  - "Live-run evidence bundle atomic-commit: LIVE-RUN.md + HAR + DEBRIEF-export.md staged individually (never `git add .`) and committed together under `test(08-02): ...` — a single atomic artefact supports revert without cascading damage"

# Metrics
duration: ~4h (facilitator-driven live run across two sessions; agent portion ~15min for commits + SUMMARY + STATE update)
completed: 2026-04-15
---

# Phase 8 Plan 02: Scenario 2 Live Run Summary

**Five full rounds of Scenario 2 executed against the real corporate LLM endpoint with PASS-WITH-POLISH verdict: persona voice held across all 5 rounds, zero credential leakage on browser→backend requests, 08-05 debrief bucketing fix verified end-to-end in the live pipeline, and an organic Layer-3 VALIDATION_FAILURE on R5 satisfied success criterion #4 more strongly than the planned synthetic offline-injection test.**

## Performance

- **Duration:** ~4 hours (facilitator-driven live run across two sessions — initial dev-mode session for R1–R3, prod-build session for R4/R5 + debrief after DEV-seed bug forced re-launch)
- **Started:** 2026-04-14 (pre-flight + Task 1 scaffold)
- **Completed:** 2026-04-15 01:30 (facilitator verdict approved)
- **Tasks:** 3 (scaffold; 5-round live run; network+debrief+verdict)
- **Files created:** 3 (`08-02-LIVE-RUN.md`, `08-02-network.har`, `08-02-DEBRIEF-export.md`)

## Accomplishments

- Full 5-round Scenario 2 session completed against the real corporate LLM (no mocking — defeats the production-conditions test per 08-CONTEXT)
- Persona voice consistency verified across all 5 rounds — Kent's institutional/legitimacy register, Finch's evidentiary/technical register, and Chen's operational/readiness register all held with **zero persona bleed**; R4 and R5 voice-drift checks vs R1 returned SAME on every persona
- Prompt budget stayed `withinLimit: true` on every turn across all 5 rounds (`totalCeilingEstimate ≤ 6724 < 7500 safeCeiling`) — strong live-pipeline evidence for Plan 06-08 windowing correctness under maximum-depth history pressure with HISTORY_WINDOW_N=2
- `llmHistory.length ≤ 2·ROUND+1` invariant held every turn (cap of 5 after round ≥ 2 never breached)
- Round 3 multi-trigger assertion captured: card-play + dispute cues produced 2 distinct speakers (Kent + Finch) delivering orthogonal non-contradictory analyses (procedural legitimacy vs evidential threshold) — within the plan's 2–3 target range
- Round 3 inject turn produced the first **full-trio activation** of the session (Kent + Finch + Chen), with each persona delivering a non-overlapping angle on the same inject — emergent multi-persona routing demonstrated
- R5 organic VALIDATION_FAILURE captured: LLM returned JSON that parsed but failed Layer-3 shape validation → red error bubble rendered, `[RETRY]` button exposed, session state preserved end-to-end, retry produced clean response → satisfies success criterion #4 more strongly than the planned synthetic offline-injection test
- HAR network evidence captured (`08-02-network.har`, 89 KB, 3 entries): zero `Authorization`, zero `api-key`, zero `Bearer` prefix, zero direct upstream LLM endpoint URL on browser→backend `POST /api/llm`. Closes forward-dependency placeholder in `08-03-CREDENTIAL-AUDIT.md §3`
- Debrief download verified: `08-02-DEBRIEF-export.md` (7365 bytes) contains all 6 Phase 7 sections (H1, metadata, per-round R1–R5, `## Debrief`, `## Final State`, `## Appendix`). Persona debrief messages appear ONLY in `## Debrief` — **zero duplication** into any Round-N transcript section, proving Plan 08-05's bucketing fix works end-to-end in the live pipeline
- Transcript hygiene grep clean (self-referential matches only — credential-audit tables and the grep command string itself; zero real credential leaks)
- Three Ops Confirmations resolved: API key rotated YES (2026-04-14); context window ASSUMED 8k (validated by 776+ tokens headroom across all 5 rounds); proxy timeout ASSUMED 45s (validated by zero timeouts across ~10 LLM calls)

## Per-Round Summary

| Round | Turns | withinLimit | llmHistory.length | Notable |
|-------|-------|------------:|------------------:|---------|
| R1    | 1     | true        | ≤ 3               | Kent + Finch only (routing rule #1); control.advanceRound=true → banner rendered |
| R2    | 1     | true        | ≤ 5               | Kent + Finch only; crisisSeverity 1 → 2; advance banner |
| R3    | 2     | true (×2)   | ≤ 5               | **Turn 1**: first full-trio activation (Kent + Finch + Chen) — emergent multi-persona routing on inject content. **Turn 2**: multi-trigger (card-play + dispute) → 2 speakers (Kent + Finch), orthogonal state updates, zero duplicates |
| R4    | 1     | true        | ≤ 5               | Kent + Finch on inject; voice-drift check vs R1 = SAME on both personas; steady-state history window |
| R5    | 1a + 1b | true (×2) | ≤ 5               | **Organic VALIDATION_FAILURE on 1a** → red error bubble + RETRY exposed + session preserved; 1b retry succeeded with valid JSON; voice-drift check vs R1 = SAME on all personas |

## Task Commits

Plan 08-02 produced commits across both waves of execution:

1. **Task 1: Scaffold 08-02-LIVE-RUN.md template** — `0bb7507` (docs) — prior agent, 2026-04-14
2. **Task 2 + Task 3 combined: Live 5-round Scenario 2 run with credential audit + debrief export** — `7af353f` (test) — this agent, 2026-04-15 — commits the populated LIVE-RUN.md (R1–R5 per-turn telemetry, Network Evidence, Downloaded Debrief, Facilitator Verdict, Transcript Hygiene log) plus the two new artifact files (`08-02-network.har`, `08-02-DEBRIEF-export.md`)

**Plan metadata:** *(this commit — docs(08-02): complete live-run plan)*

_Note: Tasks 2 and 3 were executed together in a single continuous live-run session by the facilitator rather than as separate agent-driven checkpoints; the single atomic commit reflects that reality and preserves the evidence bundle's integrity._

## Files Created/Modified

**Created:**
- `.planning/phases/08-qa-credential-audit/08-02-LIVE-RUN.md` (354 lines) — Single authoritative live-run artifact. Contains Ops Confirmations table, per-round telemetry (facilitator inputs verbatim, persona responses with speaker summaries, per-turn telemetry tables, persona-attribution checks, voice-drift checks for R4/R5), Network Evidence section (HAR excerpt + credential audit table + cross-reference to 08-03), Downloaded Debrief section (link + 6-section verification), Transcript Hygiene section (grep command + redaction log = CLEAN), Facilitator Verdict (PASS-WITH-POLISH with paragraph), Appendix (dev-server startup reference)
- `.planning/phases/08-qa-credential-audit/08-02-network.har` (89 KB) — DevTools HAR export from Round 1 post-trigger capture (3 entries, 1 × POST /api/llm). Machine-parseable evidence of zero credential leakage on browser-originated request. Request URL `localhost:5173/api/llm`, no Authorization / Bearer / api-key / direct upstream URL in headers
- `.planning/phases/08-qa-credential-audit/08-02-DEBRIEF-export.md` (7365 bytes, 136 lines) — Downloaded debrief markdown copied from `C:\Users\taylo\Downloads\debrief-edip-security-of-supply-wargame-2026-04-15-0124.md`. All 6 Phase 7 sections present. Zero post-debrief persona message duplication into Round-N transcripts (08-05 fix verified end-to-end)

**Modified:** None (plan is autonomous:false by design — pure evidence capture; zero production code changes)

## Decisions Made

- **Organic VALIDATION_FAILURE supersedes planned synthetic offline-injection**: The R5 advance attempt produced a real LLM-side shape-mismatch that exercised the same Layer-3 validator + RETRY flow the manual offline-injection was meant to test, but more authentically (genuine malformed-response path vs network-level interruption). Facilitator judgement: the organic evidence satisfies success criterion #4 better than the synthetic test would. Plan's "pick ONE round" for offline injection deliberately skipped.
- **Prod-build for R4/R5 capture window**: After the DEV-seed bug reproduced twice during the initial dev-mode session (New Game click pre-R3, idle/HMR between R3 and R4), the facilitator re-launched in prod-build mode (`pnpm build` + FastAPI static mount at :8000 per STATE.md 02-04) for the R4–R5 + debrief capture window. R1–R3 evidence from the initial dev-mode session remains authoritative; prod session's R1–R3 fast-forward content is deliberately NOT captured in the artifact to avoid duplicate-authoring confusion.
- **Ops Confirmations — API key rotation CONFIRMED, context window + proxy timeout ASSUMED**: Key rotation per 08-03 §4.1 checklist confirmed with operator on 2026-04-14 (before run start). Context window and proxy timeout not obtained from ops pre-run but validated indirectly by the run itself: 8k context fit 5 rounds of history with 776+ tokens of headroom on every turn; zero timeouts across ~10 LLM calls with 45s frontend limit (longest observed latency ~30s on R5 validation failure). Phase 9 backlog item: obtain ops confirmation and raise `SAFE_CONTEXT_CEILING_TOKENS` / `HISTORY_WINDOW_N` if actual context window is >8k.
- **Transcript hygiene grep CLEAN**: All `sk-|Bearer |Authorization:` matches in the artifact files are self-referential (credential-audit table entries in LIVE-RUN.md at lines 276/278/280 and the grep command string embedded in the Transcript Hygiene section at line 319). Zero real credential leaks. No redactions needed. Key rotation confirmed pre-run means even a hypothetical leak would not taint a previously-exposed key.
- **HAR over screenshot for network evidence**: Choice documented in artifact — HAR is machine-parseable, captures full request/response headers + body for every entry, a single 89 KB file covers all credential-absence claims. Screenshot would be redundant given the single audit-target request.
- **Facilitator verdict = PASS-WITH-POLISH** (one of three valid per 08-CONTEXT): All functional success criteria met; three polish items logged for Phase 9 (not blocking). Verbatim verdict paragraph preserved in `08-02-LIVE-RUN.md` at lines 331–333.

## Deviations from Plan

### Planned mechanism replaced by organic evidence

**1. [Rule 4 - Deviation] Manual offline-injection test skipped — superseded by organic VALIDATION_FAILURE**
- **Found during:** Task 2 (5-round live run, Round 5 advance attempt)
- **Plan text:** "pick ONE round (recommend Round 2 or 3, not 5) and mid-response, toggle WiFi off briefly"
- **What happened instead:** On the first R5 advance attempt, the real LLM produced JSON that parsed successfully but failed the Layer-3 validator shape check. Red error bubble rendered; RETRY button exposed; session state preserved; retry produced valid JSON. This exercises the exact defensive path the offline-injection was meant to test (error bubble + session recovery) but at the validation layer rather than the network layer — a more authentic failure mode given the codebase's four-layer parser defence.
- **Facilitator judgement:** Organic evidence is stronger than the synthetic test. Proceeded without manual WiFi-off. This is a Rule 4 deviation (plan behaviour changed by run-time evidence) rather than a bug fix.
- **Documented in:** LIVE-RUN.md Round 5 section (lines 196–212) — "Error-injection evidence — natural VALIDATION_FAILURE captured live"
- **Verification:** Red error bubble visible; `[RETRY]` button clickable; round counter remained at 5; earlier chat preserved; StatePanel values unchanged before/after failure; retry produced valid R5 Kent + Finch bubbles

### Process deviations (captured but not bugs)

**2. [Rule 3 - Blocking environment workaround] DEV-seed bug forced re-launch to prod-build for R4/R5**
- **Found during:** Task 2 (between R3 and R4, and on two New Game clicks)
- **Issue:** `GuardedGameScreen` DEV auto-seed fires synchronously during render when `gameState === null`. React's setState-during-render warning (`Cannot update a component ('GameHeader') while rendering a different component ('GuardedGameScreen')`) surfaced on the New Game click — root-cause pinpointed to `gameStore.ts:304` in `set()` being called from within the render pass of another component. Reproduced three times.
- **Workaround:** Facilitator re-launched using the prod-build path (`pnpm build` + FastAPI static mount at :8000 per STATE.md 02-04) for the R4/R5 + debrief capture window. HMR disabled in prod mode eliminates the idle re-seed vector. DEV auto-seed in prod build is also gated by `import.meta.env.DEV` so it doesn't fire at all in the prod bundle.
- **Phase 9 fix specification written into LIVE-RUN.md** (lines 90–105): three options, (1) remove DEV auto-seed entirely and redirect `/game` with null state to `/setup` unconditionally is recommended.
- **Not a Phase 8 bug fix** (this is a Phase 8 ops/polish observation, not a Phase 8 scope item) — belongs to Phase 9.

---

**Total deviations:** 1 Rule 4 plan-deviation (offline-injection superseded by organic evidence), 1 Rule 3 environmental workaround (prod-build for late-round capture). No production code changes. No scope creep.
**Impact on plan:** Plan completes with stronger-than-planned evidence for success criterion #4 and with the DEV-seed defect precisely specified for Phase 9 remediation.

## Issues Encountered

**1. DEV-seed bug re-seeded mock state three times during the run** (described above; root-cause pinpointed to setState-during-render at `gameStore.ts:304`, fix specification written into LIVE-RUN.md lines 90–105, Phase 9 backlog item).

**2. R1 facilitator input first-character strip (cosmetic)**: The exported debrief renders R1 input as *"ound 1 is now live..."* (missing leading "R"). First character stripped somewhere between keyboard entry and `llmHistory` append (or between `llmHistory` and debrief export render). Not blocking — did not affect LLM routing or persona response quality — logged as Phase 9 polish.

**3. `crisisState` never auto-advanced despite `crisisSeverity` reaching 4**: LLM `stateUpdate` raised `crisisSeverity` through the canonical EDIP ALERT territory (4) and approached CRISIS (5) without ever setting `crisisState` to ALERT / CRISIS. Two plausible interpretations: (a) intentional deferral ("AI suggests, facilitator decides" design philosophy); (b) missing prompt-level threshold reminder. Not blocking — game-state integrity held, no invalid transitions — logged as Phase 9 prompt-engineering review item.

## Cross-References

- **08-02-LIVE-RUN.md** (354 lines) — the primary artifact. Every Phase 8 telemetry item has a 1:1 section.
- **08-02-network.har** (89 KB) — HAR evidence for success criterion #2.
- **08-02-DEBRIEF-export.md** (7365 bytes) — end-to-end Phase 7 + 08-05 fix proof.
- **08-03-CREDENTIAL-AUDIT.md §3 Network Evidence** — forward-dependency placeholder closed by the HAR excerpt quoted into LIVE-RUN.md lines 253–283.
- **08-05-SUMMARY.md** — this plan's live-pipeline proof of the bucketing fix supplements the 08-05 unit-test regression guard.
- **STATE.md line 217** — "debrief export renders persona messages in BOTH round-N and `## Debrief`" — already marked RESOLVED by 08-05; this run provides live-pipeline corroboration (persona debrief messages confirmed appearing only in `## Debrief`, lines 118–122 of the export).
- **STATE.md line 216** (now line 238 per current STATE.md) — "DEV-mode GuardedGameScreen re-seeds mock EDIP state on New Game" — this run reproduced the bug three times and pinpointed the defect (setState-during-render warning + `gameStore.ts:304` call site); fix specification written into LIVE-RUN.md lines 90–105.

## Next Phase Readiness

- Phase 8 success criteria all met: #1 (persona voice R1↔R4↔R5 consistency ✓), #2 (zero browser-side auth headers via HAR ✓), #3 (session continues after failure — organic VALIDATION_FAILURE + RETRY ✓), #4 (error bubble + state preservation ✓), #5 (multi-trigger behavioural half captured on R3 paired with 08-05's static text-presence half ✓)
- All 5 Phase 8 plans now complete (08-01, 08-02, 08-03, 08-04, 08-05). Phase 8 ready for verifier sweep and ROADMAP closure update.
- Three Phase 9 backlog items logged (see Blockers/Concerns update in STATE.md): DEV-seed bug with pinpointed defect spec; R1 input first-character strip; crisisState auto-advance prompt review.
- Two Ops confirmations remain ASSUMED (context window, proxy timeout) — Phase 9 ops follow-up item if tightening is desired; current run demonstrates assumptions are SAFE at 5-round depth.

---
*Phase: 08-qa-credential-audit*
*Completed: 2026-04-15*
