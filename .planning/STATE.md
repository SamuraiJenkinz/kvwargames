# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-15)

**Core value:** Three AI personas respond in-character to facilitator input with accurate, live game state tracking
**Current focus:** **v1.1 Pre-live-run hardening** — LLM health indicator + Phase 9 polish items from v1.0 live run

## Current Position

Phase: 12 of 12 (Crisis-State Prompt Engineering) — **in progress**
Plan: 01 of 02 complete (12-01 encoded the Finch crisisState transition rule in Block 7 + Block 9 and locked it in with snapshot + round-trip + budget guardrails; 12-02 writes the standalone notes file and performs Tier B live-LLM replay)
Status: 12-01 shipped. 534 tests pass. totalCeilingEstimate=6858 (642-token headroom under 7500 ceiling). Ready for Plan 12-02.
Last activity: 2026-04-15 — Completed 12-01-PLAN.md (2 tasks, 2 commits, +6 tests)

Progress: [█████████░░░] 39/48 v1.0 plans complete + 6 v1.1 plans (Phases 9, 10, 11 done; Phase 12 Plan 01 done)

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
| 12 (v1.1) | 1/2 | In progress (12-01 done; 12-02 open) |

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

### Open Blockers

None.

### Technical Debt (accepted, non-blocking from v1.0)

See `.planning/milestones/v1.0-MILESTONE-AUDIT.md` for full list:
- Backend swallows upstream error detail (cosmetic)
- `uvicorn --reload` does not watch `.env`
- Vite dev proxy 502+HTML when backend down (dev-only)
- Stale localStorage from prior tenants (cosmetic)

## Session Continuity

Last session: 2026-04-15T19:24:14Z
Stopped at: Completed 12-01-PLAN.md (2 tasks, 2 commits, 534 tests passing, 6 new tests added)
Resume file: None — continue with Plan 12-02 (standalone notes file + Tier B live-LLM replay)
