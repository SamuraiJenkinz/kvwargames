# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-15)

**Core value:** Three AI personas respond in-character to facilitator input with accurate, live game state tracking
**Current focus:** **v1.1 Pre-live-run hardening** — LLM health indicator + Phase 9 polish items from v1.0 live run

## Current Position

Phase: 12 of 12 (Crisis-State Prompt Engineering) — **plans complete ✓** (phase-level verifier pending)
Plan: 02 of 02 **complete** — Tier B live-LLM replay PASS; PROMPT-01/02/03 marked Complete in REQUIREMENTS.md
Status: 12-02 closed. Finch emitted `{crisisSeverity: 4, crisisState: "Security-Related Supply Crisis"}` in the same stateUpdate on R3 of Scenario 2, plus a corroborating flag. Raw response captured verbatim in `.planning/phases/12-crisis-state-prompt-engineering/12-LIVE-VERIFICATION.md` §4; PASS verdict in §5. REQUIREMENTS.md 18/18 Complete — ready for v1.1 milestone audit.
Last activity: 2026-04-15 — Phase 12 plan 02 complete; live-LLM replay PASS; PROMPT-01/02/03 marked Complete in REQUIREMENTS.md

Progress: [████████████] 39/48 v1.0 plans complete + 8 v1.1 plans complete (Phases 9, 10, 11, 12 all plan-complete)

## Performance Metrics

**v1.0 Velocity:**
- Total plans completed: 39
- Timeline: ~2 days concentrated execution (2026-04-13 → 2026-04-15)

**By Phase (v1.0):**

| Phase | Plans | Status |
|-------|-------|--------|
| 1–8 (all v1.0) | 39/39 | Complete |
| 9 (v1.1) | 2/2 | Complete |
| 10 (v1.1) | 2/2 | Complete |
| 11 (v1.1) | 1/1 | Complete |
| 12 (v1.1) | 2/2 | Complete (12-01 rule encoded + locked; 12-02 Tier B live-LLM PASS + docs) |

*Remaining v1.1 plan counts to be confirmed during phase planning*

## Accumulated Context

### Decisions

Full decision log in `.planning/PROJECT.md` Key Decisions table. 15 architectural decisions across v1.0, all marked Good after milestone audit.

Recent decisions affecting v1.1:
- Health endpoint must reuse existing `LLM_EXTRA_HEADERS` / auth-mode env config (no separate credentials)
- Phase 12 (prompt engineering) requires empirical LLM verification — replay Scenario 2 severity=4 against real endpoint
- ROUTE-01/02 and DEBRIEF-01 consolidated into Phase 11 (small independent fixes, no dependencies)

From 09-01 execution (2026-04-15):
- TLS-vs-network discrimination via `exc.__cause__ isinstance ssl.SSLError` RETAINED in health.py despite the undocumented-httpx-API risk; in-code comment authorises future collapse to `network_error` if flaky
- Auth helper INLINED in health.py rather than extracted — only two call sites, 3 lines each; reconsider if a third consumer appears
- Health endpoint always returns HTTP 200 (body.ok carries the signal) — stable contract Phase 10 depends on
- Exception handler order (Timeout→HTTPStatus→Connect→Request→Exception) is load-bearing and commented in-code because subclass-safety is invisible to linters

From 09-02 execution (2026-04-15):
- Held test file to required 5-test floor (208 lines) — additional 403/404/429/500/network/invalid_response scenarios NOT added; judgment call that adding them would reduce readability without materially increasing signal given the generic Exception branch is covered transitively and 09-01 exercised the taxonomy by construction
- One-shot sanity check performed: temporarily breaking health.py's auth construction to `Authorization: Bearer <key>` confirmed BOTH parity tests fail with the expected diagnostics — parity tests have real teeth against Pitfall 1 (future contributor copying config_gen.py's hardcoded Bearer pattern)
- TLS-vs-network branch remains untested (MockTransport can't simulate SSL errors cleanly); revisit if a real-world TLS failure surfaces

From 10-01 execution (2026-04-15):
- lucide-react@^1.8.0 `Loader2` confirmed available at runtime — RESEARCH.md Open Question 2 resolved, no CSS fallback needed
- Test 7 (Re-check in-flight) requires controlled Promise pattern: `mockResolvedValueOnce` resolves synchronously within `userEvent.click`, skipping the transient checking state; exposed `resolve` handle lets test assert disabled button state before fetch completes
- 9 tests written (vs 7 required) — Tests 8/9 split onStatusChange callback coverage into separate ok/failed cases for assertion clarity; still within plan scope

From 10-02 execution (2026-04-15):
- `waitFor` deadlocks under `vi.useFakeTimers()` because it polls via `setInterval` which fake timers intercept; solution is `flushMicrotasks()` helper (`await act(async () => { await Promise.resolve() })`) for Promise-only async under fake timers
- Health-gate tests that use `waitFor` moved to a separate describe block with real timers to avoid the fake-timer/polling conflict — cleaner than per-test timer switching
- Phase 10 fully complete: HEALTH-07 through HEALTH-12 all covered; 528 tests green

From 12-01 execution (2026-04-15):
- crisisState transition rule is now doubly-encoded in the system prompt (Block 7 Finch MUST cross-references Block 9, which contains a dedicated `Crisis State Transition Rules` subsection pinning exact literals `"No Crisis" | "Supply Crisis" | "Security-Related Supply Crisis"` and thresholds 2 and 3)
- Existing `crisisState: one of ...` clamp-range line in Block 9 is RETAINED alongside the new transition subsection — transition docs the TRIGGER, clamp docs the ALLOWED VALUES (RESEARCH.md Risk 3)
- First use of `toMatchInlineSnapshot` in repo — two snapshots lock Block 7 Finch section and Block 9 transition subsection; failure-message comments point to `12-PROMPT-ENGINEERING-NOTES.md` before rubber-stamp updates
- Plan referenced `parseLLMResponse` but actual exported symbol is `parsePersonaResponse` in `responseParser.ts:100` — used real name
- Promoted `expect(report.withinLimit).toBe(true)` from informational boolean to hard CI assertion; current empirical budget: systemPromptTokens=5258, totalCeilingEstimate=6858, ceiling=7500 (642-token headroom)
- PROMPT-01 closed (rule encoded); PROMPT-02 closed (source-side JSDoc + snapshot breadcrumbs); PROMPT-03 still open pending 12-02 Tier B live-LLM replay

From 12-02 execution (2026-04-15):
- Tier B live-LLM replay PASSED on first run with no retries — Finch's stateUpdate contained `{crisisSeverity: 4, crisisState: "Security-Related Supply Crisis"}` plus a corroborating flag, on R3 of Scenario 2 with Block 7 Finch MUST + Block 9 transition rules in place. Raw JSON captured verbatim at `.planning/phases/12-crisis-state-prompt-engineering/12-LIVE-VERIFICATION.md` §4
- Operator path used: full R1→R2→R3 replay (option a), not localStorage seed (option b) — most-faithful replay against the real endpoint
- Finch emitted severity=4 (not 2 as in the seeded baseline expectation) — the R3 inject magnitude pushed her past the 3-threshold directly. Rule held: same-turn transition still fired. Validates the Block 9 phrasing handles the "skip a threshold" case, not just "cross by 1" cases
- PROMPT-01/02/03 all flipped to Complete in REQUIREMENTS.md; v1.1 coverage 18/18; Phase 12 (last v1.1 phase) closed — ready for v1.1 milestone audit
- Established Tier B pattern (reusable): encode rule in code → lock with snapshot + round-trip tests → empirically replay against live endpoint → commit the raw response as the evidence record (the evidence file IS the PASS artifact, not a test output)
- Established four-hop traceability chain: promptBuilder.ts JSDoc → 12-PROMPT-ENGINEERING-NOTES.md §5 → 12-LIVE-VERIFICATION.md → 08-02-LIVE-RUN.md (any link walkable either direction)

### Open Blockers

None.

### Technical Debt (accepted, non-blocking from v1.0)

See `.planning/milestones/v1.0-MILESTONE-AUDIT.md` for full list:
- Backend swallows upstream error detail (cosmetic)
- `uvicorn --reload` does not watch `.env`
- Vite dev proxy 502+HTML when backend down (dev-only)
- Stale localStorage from prior tenants (cosmetic)

## Session Continuity

Last session: 2026-04-15 (12-02 Task 3 finalized — Phase 12 plan-complete)
Stopped at: Phase 12 all plans complete. Tier B live-LLM PASS captured; REQUIREMENTS.md 18/18 Complete; 12-02-SUMMARY.md written. Phase-level verifier (`/gsd:close-phase` or equivalent) has not yet run — that step composes the phase-level rollup, possibly updates ROADMAP.md, and can kick off the v1.1 milestone audit.
Resume file: None — ready for v1.1 milestone audit.
