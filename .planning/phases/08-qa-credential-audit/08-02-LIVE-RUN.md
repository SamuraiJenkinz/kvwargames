# Phase 08-02 Live Run — Scenario 2 (5 Rounds)

**Run date:** YYYY-MM-DD *(facilitator to fill at run start)*
**Facilitator:** *(name)*
**Backend commit SHA:** `7babbf4` *(pre-flight value — update if dev server rebuilt from a later commit)*
**LLM:** corporate endpoint *(model name / deployment name if known)*
**Phase 8 dependencies green at run start:**
- 08-01 ✓ stateUpdater boundary suite — `.planning/phases/08-qa-credential-audit/08-01-SUMMARY.md`
- 08-03 ✓ credential audit report — `.planning/phases/08-qa-credential-audit/08-03-SUMMARY.md` (artifact: `08-03-CREDENTIAL-AUDIT.md`)
- 08-04 ✓ backend error-injection + missing-env-var tests — `.planning/phases/08-qa-credential-audit/08-04-SUMMARY.md`
- 08-05 ✓ debrief bucketing fix + Block-8 routing text assertions — `.planning/phases/08-qa-credential-audit/08-05-SUMMARY.md`

---

## Ops Confirmations (pre-flight)

> **Must be filled in BEFORE beginning Round 1.** If item 1 (key rotation) is NO, STOP and rotate the key per `08-03-CREDENTIAL-AUDIT.md` §4.1 Key Rotation Checklist before proceeding.

| Item | Status | Value | Source / Notes |
|------|--------|-------|----------------|
| API key rotated post-Phase 7 | PENDING — YES / NO + date | — | 08-03 §4.1 Key Rotation Checklist; STATE.md ops note (line 240) — key appeared in Phase 6 + Phase 7 smoke test chat logs |
| Corporate LLM context window | PENDING — CONFIRMED / ASSUMED | `<Nk>` | 08-RESEARCH Q1; codebase assumes 8k via `SAFE_CONTEXT_CEILING_TOKENS = 7500`. If >8k confirmed, flag for Phase 9 backlog (raise both constants + re-run 06-08 budget measurement) |
| Corporate proxy hard timeout | PENDING — CONFIRMED / ASSUMED | `<N>s` | 08-RESEARCH Q2; compare vs `LLM_FRONTEND_TIMEOUT_MS = 45000` and `LLM_TIMEOUT_SECONDS = 60`. If proxy timeout < frontend timeout, log as known constraint to watch during run |

---

## Round 1

*(populated during the run)*

### Round 1

**Facilitator inputs (in order):**
- Turn 1: `"<verbatim text>"`
- Turn 2: `"<verbatim text>"`

**Persona responses (speaker + summary):**
- Kent (blue chip): `<one-line summary; quote anything unusual>`
- Finch (amber chip): `<one-line summary>`
- Chen (green chip): `<one-line summary>`

**Telemetry per turn:**

| Turn | reportPromptBudget withinLimit | llmHistory.length | Notes |
|------|-------------------------------|-------------------|-------|
| 1 | true / false (cite tokens) | `<N>` | invariant: N ≤ 2·ROUND+1 = 3 |
| 2 | ... | ... | ... |

**Persona-attribution check:** PASS / FAIL — every bubble color-coded correctly?

**Anomalies:** none / `<describe>`

---

## Round 2

*(populated during the run — **candidate round for manual WiFi-off observation** per 08-CONTEXT "Error injection mechanism" secondary. If chosen: mid-response, toggle WiFi off / Chrome → Offline briefly; observe red error bubble; re-enable; confirm next facilitator message produces valid response. Record in Anomalies.)*

### Round 2

**Facilitator inputs (in order):**
- Turn 1: `"<verbatim text>"`

**Persona responses (speaker + summary):**
- Kent (blue chip): `<one-line summary>`
- Finch (amber chip): `<one-line summary>`
- Chen (green chip): `<one-line summary>`

**Telemetry per turn:**

| Turn | reportPromptBudget withinLimit | llmHistory.length | Notes |
|------|-------------------------------|-------------------|-------|
| 1 | true / false | `<N>` | invariant: N ≤ 5 (cap at round ≥ 2 with HISTORY_WINDOW_N=2) |

**Persona-attribution check:** PASS / FAIL

**Anomalies:** none / `<describe>` / `manual offline injection — recovered cleanly` (if chosen here)

---

## Round 3 — Multi-Trigger Test

*(populated during the run — facilitator message combines round-start + card-play + dispute cues per 08-RESEARCH "Multi-trigger persona routing" + 08-05 deferred behavioural assertion)*

### Round 3

**Multi-trigger facilitator message (verbatim — use this exact shape or close variant):**
> `"[ROUND_START Round 3] Supply disruption emerging — Team A plays EMDR Coordination Card — Team B disputes the legitimacy of Team A's framing"`

**Additional facilitator turns (if any):**
- Turn 2: `"<verbatim text>"`

**Persona responses (speaker + summary):**
- `<speaker 1>` (`<chip colour>`): `<summary>`
- `<speaker 2>` (`<chip colour>`): `<summary>`
- `<speaker 3>` (`<chip colour>`): `<summary>` *(if present; target is 2–3 distinct speakers)*

**Multi-trigger assertions:**

| Check | Result | Notes |
|-------|--------|-------|
| Distinct speaker count (target 2–3) | `<N>` | |
| No speaker appears twice | PASS / FAIL | |
| State updates are additive, not contradictory | PASS / FAIL | e.g. one persona adjusts Team A PC, another adjusts crisisSeverity; NOT two personas setting Team A PC to conflicting values |
| parsePersonaResponse succeeded (valid JSON) | PASS / FAIL | |

**Telemetry per turn:**

| Turn | reportPromptBudget withinLimit | llmHistory.length | Notes |
|------|-------------------------------|-------------------|-------|
| 1 (multi-trigger) | true / false | `<N>` | invariant: N ≤ 5 |

**Persona-attribution check:** PASS / FAIL

**Anomalies:** none / `<describe>` / `manual offline injection — recovered cleanly` (if chosen here instead of Round 2)

---

## Round 4

*(populated during the run — **explicit persona-voice drift check vs Round 1**)*

### Round 4

**Facilitator inputs (in order):**
- Turn 1: `"<verbatim text>"`

**Persona responses (speaker + summary):**
- Kent (blue chip): `<one-line summary>`
- Finch (amber chip): `<one-line summary>`
- Chen (green chip): `<one-line summary>`

**Telemetry per turn:**

| Turn | reportPromptBudget withinLimit | llmHistory.length | Notes |
|------|-------------------------------|-------------------|-------|
| 1 | true / false | `<N>` | invariant: N ≤ 5 |

**Persona-attribution check:** PASS / FAIL

**Voice-drift check vs Round 1** (required):
- Kent tone: same / shifted — `<one-liner>`
- Finch tone: same / shifted — `<one-liner>`
- Chen tone: same / shifted — `<one-liner>`
- Any persona borrowing another's vocabulary? `<one-liner>`

**Anomalies:** none / `<describe>`

---

## Round 5

*(populated during the run — **final persona-voice drift check vs Round 1**, then trigger debrief + download)*

### Round 5

**Facilitator inputs (in order):**
- Turn 1: `"<verbatim text>"`

**Persona responses (speaker + summary):**
- Kent (blue chip): `<one-line summary>`
- Finch (amber chip): `<one-line summary>`
- Chen (green chip): `<one-line summary>`

**Telemetry per turn:**

| Turn | reportPromptBudget withinLimit | llmHistory.length | Notes |
|------|-------------------------------|-------------------|-------|
| 1 | true / false | `<N>` | invariant: N ≤ 5 |

**Persona-attribution check:** PASS / FAIL

**Voice-drift check vs Round 1** (required):
- Kent tone: same / shifted — `<one-liner>`
- Finch tone: same / shifted — `<one-liner>`
- Chen tone: same / shifted — `<one-liner>`

**End-of-run actions:**
- Trigger debrief (click "End Game + Debrief" or "Request Debrief Now" as appropriate): DONE / NOT DONE
- Debrief persona messages rendered cleanly (no duplication into round transcripts — 08-05 fix live-pipeline check): PASS / FAIL
- Download debrief markdown: DONE / NOT DONE — see § Downloaded Debrief below

**Anomalies:** none / `<describe>`

---

## Network Evidence

*(HAR export or annotated screenshot of `POST /api/llm` — confirms zero `Authorization` / `api-key` / direct LLM endpoint URL on browser side. Cross-referenced from `08-03-CREDENTIAL-AUDIT.md` §3 Network Evidence.)*

**Evidence type:** HAR export / Annotated screenshot *(choose one)*
**Evidence file:**
- HAR: `.planning/phases/08-qa-credential-audit/08-02-network.har`
- Screenshot: `.planning/phases/08-qa-credential-audit/08-02-network-headers.png`

**Rationale for choice:** *(e.g. "HAR exported because session had >50 requests; key request annotated separately" or "screenshot sufficient — single request inspected inline")*

**Headers excerpt (browser → backend `POST /api/llm`, any round):**
```
Request URL: http://localhost:5173/api/llm
Request Method: POST
Request Headers:
  accept: */*
  content-type: application/json
  (NO Authorization, NO api-key, NO Bearer, NO direct LLM endpoint URL)
```

**Verdict line** (verbatim for cross-reference into 08-03):
> Confirmed: zero `Authorization`, zero `api-key`, zero direct LLM endpoint URL on browser-originated `POST /api/llm` requests. Backend adds upstream auth headers server-side only (cf. `backend/tests/test_llm_auth_header.py`).

**Pitfall check (08-RESEARCH Pitfall 5):** The inspected request is browser → `localhost:5173/api/llm` (NOT the backend → upstream request). The browser request MUST NOT carry auth headers — if it does, verdict is FAIL and the audit §3 cross-reference must be revised.

---

## Downloaded Debrief

*(link to attached markdown — confirms end-to-end Phase 7 export pipeline + 08-05 bucketing fix in live conditions)*

**Location:** See [`08-02-DEBRIEF-export.md`](./08-02-DEBRIEF-export.md)

**Attachment checklist:**
- [ ] `.md` file downloaded at end of Round 5 (default filename `debrief-edip-security-of-supply-wargame-YYYY-MM-DD-HHMM.md`)
- [ ] Copied into `.planning/phases/08-qa-credential-audit/08-02-DEBRIEF-export.md` (canonical name)
- [ ] Contains all 6 Phase 7 required sections: `# <H1>`, metadata block, per-round transcripts, `## Debrief`, `## Final State`, `## Appendix`
- [ ] Round-N transcripts do NOT duplicate post-debrief persona messages (08-05 regression guard in live pipeline)

---

## Transcript Hygiene (08-03 §4.2 — required before this artifact is committed)

Before committing this artifact to git, run the leak-check grep:

```bash
grep -E "sk-|Bearer |Authorization:" .planning/phases/08-qa-credential-audit/08-02-LIVE-RUN.md
```

Expect zero matches. If matches appear, redact inline (replace with `sk-REDACTED-<date>` or `Bearer REDACTED`), commit the redaction, and trigger a fresh key rotation per 08-03 §4.1 (the transcript is now tainted).

**Redaction log** (if any redactions were made during transcript capture):
- `<date> <what was redacted and why>`
- *(blank if clean)*

---

## Facilitator Verdict

**Verdict:** PENDING — one of: **PASS** / **FAIL** / **PASS-WITH-POLISH**

*(one paragraph, 3–5 sentences, covering:*
- *Did persona voice hold across all 5 rounds?*
- *Did JSON parse cleanly every turn?*
- *Did the multi-trigger Round 3 assertion succeed (2–3 distinct speakers, no duplicates, additive state)?*
- *Did the manual offline injection recover cleanly?*
- *Were there any anomalies that, while not failing the run, are worth logging as next-milestone polish items?)*

**If FAIL:** do NOT close the artifact. Name the failure mode above. The run must be repeated from Round 1 after the defect is fixed (within Phase 8 scope if a plan 08-0x issue; new phase if a new capability — per 08-CONTEXT "Sign-off rule").

**If PASS or PASS-WITH-POLISH:** artifact is complete. Continuation agent will create `08-02-SUMMARY.md`, update STATE.md, and close Phase 8.

---

## Appendix — Dev Server Startup Reference

*(non-authoritative; for facilitator convenience)*

```bash
# Backend (from backend/ directory)
cd backend
# Ensure .env has LLM_API_KEY, LLM_ENDPOINT_URL, and (for Azure) LLM_AUTH_HEADER_NAME / LLM_AUTH_VALUE_PREFIX set
uvicorn app.main:app --reload --port 8000

# Frontend (from repo root, separate terminal)
pnpm dev
# Default dev origin: http://localhost:5173
```

Open `http://localhost:5173`, open DevTools (F12), switch to Network tab + Console tab (leave both open throughout the run). Load Scenario 2 (full EDIP config). Begin Round 1.
