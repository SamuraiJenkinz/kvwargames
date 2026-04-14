# Phase 8: QA & Credential Audit - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Validate that the tool — as delivered through Phase 7 — survives production-grade conditions. No new user-facing features. The deliverables are **evidence**: test suites that pass against boundary values, a captured live-run artifact from a full Scenario 2 playthrough, a credential-audit report, and resolution of the two polish follow-ups logged during Phases 6–7.

This is the last phase of the current milestone. If the live run surfaces a defect that is in-scope for the five plans already named (08-01..08-05) it is fixed here; genuinely new capabilities are deferred to the next milestone backlog.

</domain>

<decisions>
## Implementation Decisions

### Known follow-ups triage

In-scope for Phase 8 (include):
- **Debrief / transcript duplication in markdown export** — cosmetic polish, logged 2026-04-14. Fix in `debriefExporter.ts renderRound()`: filter messages whose index is greater than `lastDebriefIdx` out of their round bucket. Folded into 08-05 (debrief export end-to-end artifact review).
- **Corporate context window confirmation** — ops question logged with Phase 6 (06-08). Confirm actual deployed context window; if >8k, raise `SAFE_CONTEXT_CEILING_TOKENS` and `HISTORY_WINDOW_N` and re-run the 06-08 budget measurement. Included in 08-02 live-run prep.
- **Corporate proxy timeout vs LLM generation time** — logged with Phase 6. Confirm actual proxy timeout; if LLM generation exceeds it, raise `LLM_FRONTEND_TIMEOUT_MS` or negotiate proxy. Included in 08-02 live-run observations.
- **OpenAI key rotation hygiene** — logged 2026-04-14 (key appeared in chat logs during two smoke tests). Audit doc gets a "key rotation checklist" section so future rotations don't leak into transcripts. Part of 08-03.

Deferred (not in Phase 8):
- **DEV-mode GuardedGameScreen re-seeds mock EDIP on New Game** — DEV-only ergonomic bug; production path is unaffected and a documented workaround exists (`navigate to /` or use preview build). Cost of fixing the DEV guard to distinguish initial load from intentional reset does not clear the bar for QA phase. Log to next-milestone backlog.

### Live run scope & sign-off

- **Scenario**: Scenario 2 at full 5 rounds (roadmap-mandated — max history depth is the point).
- **LLM**: real corporate LLM, not mock. The five-round run is a production-conditions test; mocking it defeats the test.
- **Telemetry captured during run**:
  - `reportPromptBudget` dev-console output every turn (confirms `withinLimit`)
  - `llmHistory.length <= 2*N+1` invariant holds each turn (dev-console assertion)
  - Persona attribution of every bubble (Kent blue / Finch amber / Chen green) matches round-routing expectation
  - Round 4 and Round 5 specifically: persona voice has not drifted; JSON structure still valid
- **Pass artifact**: `.planning/phases/08-qa-credential-audit/08-02-LIVE-RUN.md` with:
  - Per-round notes (what was typed, what came back, any anomalies)
  - Downloaded debrief markdown attached / linked
  - DevTools HAR or screenshot of `/api/llm` request headers (feeds 08-03)
  - Facilitator one-paragraph verdict: pass / fail / pass-with-polish
- **Sign-off rule**: A failed live run does NOT ship. Fix the defect (within phase 8 scope if it's a plan 08-0x issue; new phase if it's a new capability), re-run from the start. Partial or selective-round verdicts are not accepted.

### Error injection mechanism

- **Primary: automated tests** (no manual backend monkey-patching of the running dev server).
  - **Malformed JSON**: vitest + `httpx.MockTransport` (already the backend harness pattern locked in 06-01). Force backend to return truncated / unparseable LLM text. Assert frontend renders red error bubble, session state intact, next facilitator message sends successfully.
  - **Timeout / abort**: fetch mock that honours `AbortSignal`, rejects with `DOMException('aborted', 'AbortError')`. Assert `LLMClientErrorCode === 'ABORTED'` path and that `LLM_FRONTEND_TIMEOUT_MS` controller fires as expected.
  - **Missing env var startup**: pytest test that instantiates the FastAPI app without `LLM_API_KEY`. Assert either startup fails loudly OR `/api/llm` returns a config-check error with a status code (not a 500 unhandled trace). Decision on which failure mode is correct is made in 08-04 after reading current Phase 2 behaviour.
- **Secondary: one manual observation during the live run**. Mid-response, briefly kill network (toggle WiFi or `Chrome → Offline`); confirm the real-world error path surfaces the red error bubble and the session recovers. One data point, captured in the 08-02 live-run artifact. This is supplementary evidence, not the primary test.

### Credential audit depth

- **Network evidence**: DevTools Network capture during the live run. HAR export or annotated screenshot of a `/api/llm` request showing request headers contain NO `Authorization`, NO `api-key`, and NO LLM endpoint URL client-side. Stored in 08-03 artifact.
- **Source-code evidence (automated greps, results recorded in audit doc)**:
  - `grep -r "Authorization" src/` — must find zero matches in client code
  - `grep -r "api.openai.com\|LLM_ENDPOINT" src/` — client should call `/api/llm` only, zero matches expected
  - `grep -r "API_KEY\|apiKey\|api_key" src/` — zero matches expected
  - `grep -r "sk-\|Bearer " src/` — zero matches expected
- **Config hygiene**:
  - `.env` in `.gitignore` (confirm)
  - `.env.example` contains no real values (confirm)
  - No API keys in test fixtures, mock data, or committed transcripts
- **Key-rotation checklist section** in `08-03-CREDENTIAL-AUDIT.md`: addresses the ops note about keys appearing in chat logs across two smoke tests. Lists everywhere an operator must update after rotating the key (env files, restart command, confirmation steps) so rotated keys don't get pasted into transcripts.
- **Not in scope**: full SAST scan, dependency CVE sweep, penetration testing. Out of proportion for a three-persona tabletop tool. Logged to backlog if the tool is ever considered for wider distribution.

### Claude's Discretion

The user delegated all four areas. The decisions above reflect that delegation and can be refined by downstream research or the planner if they uncover reasons to adjust. Specifically flexible:
- Exact format of the 08-02 live-run artifact (structure, section headings)
- Exact assertions inside each 08-01 boundary test — the fields are locked but the test-name style can follow project convention
- Whether the missing-env-var test expects startup failure vs runtime 500 (resolved during 08-04 research by reading current Phase 2 backend behaviour)

</decisions>

<specifics>
## Specific Ideas

- Live run writes go into a single growing markdown artifact (`08-02-LIVE-RUN.md`) rather than scattered screenshots. A facilitator reading it six months from now should understand what happened and why it passed without needing access to DevTools state.
- Credential audit report leans on grep output pasted verbatim — reviewer should be able to re-run the exact commands and confirm the same zero-match results. Evidence, not assurance.
- The roadmap already names the five plans (08-01..08-05); this phase honours that breakdown rather than re-carving it.

</specifics>

<deferred>
## Deferred Ideas

- DEV-mode GuardedGameScreen re-seed bug — production-unaffected, workaround documented, log to next-milestone backlog.
- Full SAST / dependency CVE sweep / penetration test — out of proportion for current scope; revisit if tool is distributed beyond original facilitator group.
- Refactoring 06-07's two debrief buttons ("Request Debrief Now" vs "End Game + Debrief") into distinct semantics (interim vs end-of-game `cardsThisRound` clear) — only split if 08-02 smoke test surfaces a need (per the 06-07 decision log).

</deferred>

---

*Phase: 08-qa-credential-audit*
*Context gathered: 2026-04-14*
