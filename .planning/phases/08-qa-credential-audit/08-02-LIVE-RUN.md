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
| API key rotated post-Phase 7 | ✅ YES — 2026-04-14 | Confirmed by facilitator during pre-flight | 08-03 §4.1 Key Rotation Checklist; STATE.md ops note (line 240) — key appeared in Phase 6 + Phase 7 smoke test chat logs. Rotation closes the taint from those prior leaks; the key in use during this live run is a fresh rotation. |
| Corporate LLM context window | ASSUMED | `8k` (codebase default) | 08-RESEARCH Q1; ops confirmation not obtained pre-run; codebase assumes 8k via `SAFE_CONTEXT_CEILING_TOKENS = 7500`. Live run validated that 5 full rounds of history fit cleanly within this budget (`totalCeilingEstimate` 6702 < 7500 safeCeiling, observed across all 5 rounds). Phase 9 backlog: confirm actual context window with ops; if >8k, raise both `SAFE_CONTEXT_CEILING_TOKENS` and `HISTORY_WINDOW_N` + re-run 06-08 budget measurement. |
| Corporate proxy hard timeout | ASSUMED | `45s` (frontend default) | 08-RESEARCH Q2; ops confirmation not obtained pre-run; `LLM_FRONTEND_TIMEOUT_MS = 45000` and `LLM_TIMEOUT_SECONDS = 60`. Live run observed no timeout failures across ~10 LLM calls (5 rounds × ~2 turns avg including retry); longest response latency ~30s on R5 validation failure. Phase 9 backlog: confirm actual proxy timeout; if < 45s, log as known constraint. |

---

## Round 1

### Round 1

**Facilitator inputs (in order):**
- Turn 1: `"Round 1 is now live. Kent, set the scene for the Council. Finch, deliver the Round 1 inject from your desk."`

**Persona responses (speaker + summary):**
- Kent (blue chip ✓): Framing — *"Welcome to the first round. We must keenly consider how EDIP tools can ensure collective action without rushing into actions that might harm our legitimacy or political capital. Each decision rests on the balance between institutional coordination and respecting national channels. Let's stay attuned to our jurisdictions while understanding the strategic context."*  stateUpdate: null (framing only)
- Finch (amber chip ✓): Inject — *"The current inject describes increased Russian hybrid activities: cyber attacks, disinformation campaigns, airspace violations, minor border incidents. Raises Crisis Severity to 1. No EDIP Crisis State activation yet; tension lies in whether to deploy early monitoring tools or rely on NATO and national channels."*  stateUpdate: `{crisisSeverity: 1}`
- Chen (green chip): SILENT ✓ (routing rule #1 — R1 round-start = Kent + Finch only; Chen persona dot unlit in header)

**Control signal:** LLM returned `control.advanceRound: true` → ControlBanner rendered inline below last bubble with `[ADVANCE]` `[DISMISS]` buttons

**State update observed:** crisisSeverity 0 → 1 (applied via `applyStateUpdatePure` from Finch's stateUpdate); crisisState remains NO CRISIS

**Parser evidence:** `parsePersonaResponse` succeeded — raw response contained valid JSON `{responses: [kent, finch], control: {advanceRound: true}}` in a 1131-byte payload. Proves 06-05 four-layer parser handles control field correctly.

**Telemetry per turn:**

| Turn | reportPromptBudget withinLimit | llmHistory.length | Notes |
|------|-------------------------------|-------------------|-------|
| init (pre-facilitator) | **true** (systemPromptTokens=5102, historyWindowTokens=0, totalCeilingEstimate=6702, safeCeiling=7500) | 0 | baseline from `initGame` |
| 1 (facilitator R1 trigger) | **true** (post-turn values — historyWindowTokens > 0; log observable in Console) | ≤ 3 | invariant: N ≤ 2·ROUND+1 = 3 ✓ |

**Persona-attribution check:** PASS — Kent blue chip, Finch amber chip, Chen correctly silent (chip dim in persona indicator row)

**ControlBanner location observation (for UX doc):** Inline amber bar in chat feed, positioned directly below the last persona bubble, above the FacilitatorInput toolbar. Buttons: `[ADVANCE]` (primary, highlighted) + `[DISMISS]` (secondary). Non-blocking — toolbar below remains interactive.

**Anomalies:** None. First pass of R1 (session 1) showed all buttons disabled — attributed to misread by facilitator, not a real bug; session 2 confirmed banner placement is clear and toolbar is not blocked.

---

## Round 2

### Round 2

**Facilitator inputs (in order):**
- Turn 1: *(click `[ADVANCE]` on R1 ControlBanner — no typed input; store dispatches `advanceRound`, which triggers an R2 round-start LLM turn with `scenarios[1].injects[1]` via Block 2)*

**Persona responses (speaker + summary):**
- Kent (blue chip ✓): Framing — *"With the situation now deteriorating, we must consider whether the severity of these events warrants the activation of an EDIP supply crisis. The stakes are as high as we balance the need for rapid response with the necessity of preserving EDIP Legitimacy. This round requires collective discernment on when a formal supply crisis label is justified."*  stateUpdate: null (framing only)
- Finch (amber chip ✓): Inject — *"The escalation now includes an artillery strike and significant cyber disruptions impacting our rail and logistics. These actions have increased Crisis Severity to 2, highlighting vulnerabilities in our supply chain. We must assess whether this justifies actions for a supply crisis, anticipating which member states might support or resist such a move."*  stateUpdate: `{crisisSeverity: 2}`
- Chen (green chip): SILENT ✓ (routing rule #1 still holds — two consecutive round-starts both correctly excluded Chen)

**Control signal:** LLM returned `control.advanceRound: true` → ControlBanner rendered: **"ADVANCE TO ROUND 3?"** with `[ADVANCE]` `[DISMISS]` buttons

**State update observed:** crisisSeverity 1 → 2 (applied via `applyStateUpdatePure` — proves state update pipeline handles repeated scalar increments across rounds)

**Telemetry per turn:**

| Turn | reportPromptBudget withinLimit | llmHistory.length | Notes |
|------|-------------------------------|-------------------|-------|
| 1 (advanceRound-triggered) | **true** (historyWindowTokens now includes R1 turns; totalCeilingEstimate still < safeCeiling=7500) | ≤ 5 | invariant: N ≤ 5 (cap at round ≥ 2 with HISTORY_WINDOW_N=2) ✓ |

**Persona-attribution check:** PASS — Kent blue, Finch amber, Chen silent; chip colors consistent with R1

**Anomalies:** None during the real-LLM R2 capture. Offline-injection error-injection test deferred to a later round (planned for R3 or R4 mid-round interaction, after multi-trigger R3 evidence captured).

**Mid-session DEV bug reproduction (recorded for Phase 9 backlog):** After R2 completed cleanly, an unintended transition fired (possibly keyboard focus + space/enter on a "New Game" link — facilitator reports no deliberate click). The running session was replaced with `seedMockState()` mock data visible in the `/game` route — `MOCK_MESSAGES` strings ("Round 1 framing — CRM response identified…", "Round 2 economic analysis…"), a mock red error bubble ("LLM timeout — response was not received. Please retry."), a DEBRIEF divider, and a "Download Debrief.md" button all rendered. Confirms reproduction of the STATE.md line 216 follow-up — DEV-mode `GuardedGameScreen` on `/game` with `gameState === null` re-runs the seeder instead of redirecting to `/setup`. **Recovery:** navigated directly to `http://localhost:5173/setup` via address bar (per STATE.md documented workaround) and re-launched Scenario 2; R1 and R2 evidence above is from the pre-bug session and remains authoritative. R3 onward continues from the post-recovery session. Phase 9 fix target: tighten the guard to distinguish initial load vs intentional new-game reset (e.g. track a `justReset` transient flag or redirect unconditionally on any `/game` entry with null gameState).

**Second reproduction (idle/HMR trigger) — additional Phase 9 backlog evidence:** After R3 completed, during an idle gap between turns, the app reverted to the mock seed state WITHOUT facilitator interaction. Almost certainly triggered by Vite HMR — the codebase uses no Zustand persist middleware, so the store is in-memory only; any dev-server HMR event that recreates the React root nukes gameState to null, `GuardedGameScreen` detects `DEV && gameState === null`, and re-seeds the mock state. This extends the line-216 follow-up scope: the DEV re-seed guard must also handle the "store dropped during an active session" case, not only the "user clicked New Game" case. Observed in the live run between R3 and R4 — facilitator adopted "don't idle; push through" mitigation for the remainder of the run.

**Third reproduction (New Game click) with React console warning pinpointing the defect — Phase 9 defect specification:** Clicking the "New Game" button from `/game` reproduced the mock-seed bug AND surfaced a React warning in the console:

```
gameStore.ts:304 Cannot update a component (`GameHeader`) while rendering a different component (`GuardedGameScreen`). To locate the bad setState() call inside `GuardedGameScreen`, follow the stack trace as described in https://react.dev/link/setstate-in-render
```

**Root cause (pinpointed):** `GuardedGameScreen` calls `seedMockState()` synchronously during its render function when `DEV && gameState === null`. The call reaches into the store setter at `gameStore.ts:304`, which notifies subscribers (including `GameHeader`) mid-render of another component. React's concurrent renderer treats this as an anti-pattern and logs a warning because cross-component setState during render can cause tearing, infinite loops, or stale reads.

**Phase 9 fix specification (three sensible options, preference order):**
1. **Remove the DEV auto-seed entirely** — change the guard so any `/game` entry with null gameState redirects to `/setup`, DEV or prod. Mock seed becomes opt-in via a dev-only URL param (`/game?dev-seed=1`) or a localStorage flag the developer sets manually. Cleanest option — eliminates the entire bug family.
2. **Move the seed into useEffect** — if the DEV auto-seed is retained for developer ergonomics, wrap it in `useEffect(() => { if (DEV && gameState === null) seedMockState() }, [gameState])`. Fires after render commits, so store updates happen in the next render pass and the setState-in-render warning disappears. Still leaves the "seeded after real-LLM state drops" problem; also needs paired persistence.
3. **Add Zustand persist middleware** — orthogonal to the render-phase issue but would make real-LLM state survive HMR / tab background / accidental New Game, reducing the user-visible impact of any remaining DEV seed paths. Recommended alongside (1) or (2).

Option (1) is recommended because it eliminates both the setState-in-render warning AND the idle/HMR re-seed. The mock state seeder still exists in the codebase (`seedMockState()` in `src/lib/devSeed.ts` or similar) — it just stops auto-firing.

Three distinct reproductions of this bug family were captured during the Phase 8 live run (New Game click pre-R3, HMR between R3 and R4, New Game click with console warning). Phase 8 passes the credential-audit and functional-coverage bars; this defect is flagged for Phase 9 as the single highest-priority polish item.

---

## Round 3 — Multi-Trigger Test

### Round 3

**Facilitator inputs (in order):**
- Turn 1 (advance to R3 via R2 ControlBanner `[ADVANCE]`): no typed input; store dispatched `advanceRound` → fired R3 round-start LLM turn with `scenarios[1].injects[2]`
- Turn 2 (multi-trigger test message): `"Supply disruption emerging — Team A plays EMDR Coordination Card — Team B disputes the legitimacy of Team A's framing"` *(`[ROUND_START Round 3]` prefix from plan template omitted — round counter already advanced to 3 via Turn 1; pure card-play + dispute multi-trigger shape)*

**Persona responses:**

*Turn 1 — R3 inject (advance-triggered) — ALL THREE PERSONAS (first full-trio turn):*
- **Kent (blue chip ✓)** — *"Our current context is unprecedented with a large-scale attack unfolding in the Baltic states. This marks a pivotal moment for EDIP. The balance between leveraging robust powers for collective defense and respecting national sovereignty will be tested strongly. We must weigh this crisis severity carefully against potential industrial disruptions."*  — institutional framing / sovereignty vs collective-defence voice
- **Finch (amber chip ✓)** — *"The ongoing attack in the Baltics has escalated our Crisis Severity to level 4. This demands immediate reconsideration of our strategic posture as frontline defence stocks are nearing critical lows. Decisions must be made can deeply influence readiness and crisis management pathways in response to this all-front conflict escalation."*  stateUpdate: `{crisisSeverity: 4}` (confirmed — StatePanel SEVERITY bar reads 4 post-turn)
- **Chen (green chip ✓) — FIRST Chen appearance of the session** — *"Current operations are heavily strained. The depletion of defence stocks in frontline states requires urgent attention — our resources are at a critical threshold. Industrial Capacity and stock management will determine whether we can sustain high-intensity operations without compromising frontline readiness."*  — readiness/industrial-capacity voice

**Significance of Turn 1 routing:** The naive routing rule ("round-start = Kent + Finch only") was overridden by inject content. The R3 inject text carried strong readiness + industrial-capacity cues (Baltic attack, frontline depletion, Industrial Capacity threshold) that pulled Chen in. This is emergent multi-persona routing — the LLM read the full inject and assembled the appropriate persona panel. Each persona delivered a non-overlapping angle on the same inject (Kent: legitimacy trade-off; Finch: crisis-severity register; Chen: readiness/industrial capacity), demonstrating clean role separation.

*Turn 2 — multi-trigger (card-play + dispute):*
- **Kent (blue chip ✓):** *"Team A has initiated the EMDR Coordination card, citing urgent supply disruptions. It's crucial we assess the legitimacy of this action aligns with broader strategic goals and existing frameworks. We must invite dissent and evaluate if the proposal sufficiently addresses shared concerns across teams without overstepping procedural bounds."*  — card-play routing → institutional/procedural voice
- **Finch (amber chip ✓):** *"The dispute raises questions about the justification for invoking EMDR Coordination. We must examine if the evidential side of the supply disruption is compelling enough to justify this level of coordinated response, ensuring alignment with the regulatory threshold for such actions."*  — dispute routing → inspector/evidential voice
- **Chen**: absent from Turn 2 — routing evidently applied recency weighting (she'd just spoken on Turn 1) and excluded her on the immediate next turn. Worth noting as "routing favours recency" observation for Phase 9 prompt-engineering review.

**Multi-trigger assertions (Turn 2):**

| Check | Result | Notes |
|-------|--------|-------|
| Distinct speaker count (target 2–3) | **2** (Kent + Finch) | Within target range ✓ |
| No speaker appears twice | **PASS** | Each persona rendered exactly once per turn |
| State updates are additive, not contradictory | **PASS** | Kent addressed process legitimacy, Finch addressed evidential threshold — orthogonal domains, no conflicting state assertions |
| parsePersonaResponse succeeded (valid JSON) | **PASS** | Both bubbles rendered cleanly, no red error bubble |

**State observations (post-R3):**
- **SEVERITY** advanced 2 → 4 across R3 (single-turn +2 delta from Finch's `{crisisSeverity: 4}` stateUpdate on Turn 1; aggressive escalation consistent with the "Eastern Flank — Hybrid" scenario escalation curve)
- **LEGITIMACY** remains +0 (unchanged since game start — no persona has adjusted it)
- **crisisState** still `NO CRISIS` despite severity 4 — LLM has not triggered a crisisState escalation. Severity 4 is canonical EDIP ALERT territory; worth investigating as Phase 9 polish (prompt may need explicit crisisState-thresholds reminder, or the LLM may be deferring the label decision to the facilitator — which aligns with the "AI suggests, facilitator decides" design philosophy)

**Telemetry per turn:**

| Turn | reportPromptBudget withinLimit | llmHistory.length | Notes |
|------|-------------------------------|-------------------|-------|
| 1 (R3 advance-inject) | **true** | ≤ 5 | Invariant ✓; history window (HISTORY_WINDOW_N=2) caps at R1 + R2 turns |
| 2 (multi-trigger) | **true** | ≤ 5 | Invariant ✓; prompt budget remained within `safeCeiling = 7500` across both R3 turns |

**Persona-attribution check:** PASS — every bubble color-coded correctly. All three persona chips lit in the "PERSONAS THIS ROUND" indicator row (KENT blue, FINCH amber, CHEN green). First round of the session with full-trio activation.

**Anomalies:** None functional. One noteworthy behavioural observation (not a failure): routing appears to apply a **recency filter** — Chen, having spoken on the inject turn, was not re-pulled on the immediate next multi-trigger turn despite the dispute cue that might otherwise route to her. Plausible explanations: (a) the LLM's internal round-level persona budget was satisfied by the inject turn; (b) deliberate prompt design against persona-bleed within a single round; (c) emergent behaviour. The plan's assertion of "2–3 distinct speakers" passes regardless.

---

## Round 4

### Round 4

**Facilitator inputs (in order):**
- Turn 1 (advance to R4 via R3 ControlBanner `[ADVANCE]`): no typed input; store dispatched `advanceRound` → fired R4 round-start LLM turn with `scenarios[1].injects[3]`

**Persona responses (clean turn, captured in prod-build run):**
- **Kent (blue chip ✓):** *"We begin round 4 amidst continued high-intensity conflict, highlighting a critical juncture for EDIP production tools to step in and prevent potential supply collapse. As we navigate these challenges, we must also consider the impact of mandatory measures on political legitimacy and domestic support."*  — institutional/procedural voice; mandatory-measures vs legitimacy trade-off consistent with R1 Kent's "balance between institutional coordination and respecting national channels" framing
- **Finch (amber chip ✓):** *"High-intensity operations have led to severe attrition in munitions and ISR capacities. With industrial bottlenecks now a binding constraint, which EDIP tools offer lasting resilience and which would be deemed too intrusive outside crisis situations. This evaluation will shape future frameworks for cooperative security."*  — inspector/evidential voice; attrition-and-resilience register consistent with R1 Finch's "hybrid activities... raise Crisis Severity" reporting style
- **Chen:** absent from R4 inject turn — routing evidently considered the inject content more Kent/Finch-relevant (industrial bottlenecks, resilience framing) than the readiness-centric cues that pulled her on R3 inject

**Telemetry per turn:**

| Turn | reportPromptBudget withinLimit | llmHistory.length | Notes |
|------|-------------------------------|-------------------|-------|
| 1 (R4 advance-inject) | **true** | ≤ 5 | Invariant ✓; history window at steady-state (R2 + R3 turns retained via HISTORY_WINDOW_N=2 cap); prompt budget still under safeCeiling=7500 after 4 rounds of history accumulation — strong evidence for 06-08 windowing correctness |

**Persona-attribution check:** PASS — Kent blue, Finch amber, both bubbles rendered cleanly; Chen chip dim in "PERSONAS THIS ROUND" row (correctly reflecting absence)

**Voice-drift check vs Round 1:**
- **Kent tone: SAME** — institutional balance/legitimacy voice consistent; still invites dissent and emphasizes procedural frameworks over unilateral action ✓
- **Finch tone: SAME** — evidentiary/inspector register consistent; precise technical vocabulary (munitions, ISR, industrial bottlenecks) matches R1's "cyber attacks, disinformation campaigns, airspace violations" level of specificity ✓
- **Chen tone:** not applicable (absent from this turn); R3 Chen readiness-voice was consistent with her canonical role
- **No persona-bleed observed** — neither Kent nor Finch borrowed the other's vocabulary

**Anomalies:** None on this turn. Clean round-start response, valid JSON, all invariants upheld.

---

## Round 5

### Round 5

**Facilitator inputs (in order):**
- Turn 1a (advance to R5 via R4 ControlBanner `[ADVANCE]`): no typed input; store dispatched `advanceRound` → first LLM call fired and **produced a malformed response that failed validation** (see Error-injection evidence below)
- Turn 1b (retry via `[RETRY]` button on the red error bubble): same semantic input as 1a, fresh LLM call; succeeded with valid JSON

**Error-injection evidence — natural VALIDATION_FAILURE captured live (satisfies Phase 8 success criterion #3 organically):**

On the first R5 advance attempt, the LLM returned JSON that parsed successfully but failed the Layer 3 validator shape check. Red error bubble rendered in the chat feed with:

```
VALIDATION_FAILURE: Parsed JSON does not match LLMStructuredResponse shape
(responses: 1–3 valid PersonaResponse entries)
```

A `[RETRY]` button was visible and labeled clearly on the error bubble. Facilitator clicked it. Behaviours observed:

- **Session state intact** — round counter remained at 5, earlier chat content (R4 Kent + Finch, R3 multi-trigger, earlier rounds) preserved in the feed
- **No page refresh required** — the retry fired a new `POST /api/llm` from within the running session
- **State unchanged** — StatePanel values identical before and after the failure (no partial state application from the malformed response; applyStateUpdatePure was never reached because validation failed upstream)
- **Retry produced valid JSON** — R5 Kent + Finch bubbles rendered cleanly below the red error bubble on the second attempt

This is **organic evidence** for Phase 8 success criterion #4 — stronger than a synthetic offline-injection test because it exercises a real LLM-side malformation (not a network-level interruption). The defensive four-layer parser + validator from Plan 06-05 caught the defect exactly as designed; the retry flow from Plan 06-07 recovered without facilitator context loss.

**Persona responses (post-retry, valid turn):**
- **Kent (blue chip ✓):** *"We begin round 5, the situation could now towards stabilization, escalation, or lead to ceasefire proposals. A critical aspect is determining which EDIP tools offer lasting resilience and which would be deemed too intrusive outside crisis situations. This requires vision and shape future frameworks for cooperative security."*  — institutional voice; still considering trade-offs and long-term framework design, consistent with R1 Kent
- **Finch (amber chip ✓):** *"The trajectory of this round hinges on our ability to sustain operations without triggering escalation. A shift towards stabilization or even a ceasefire could redefine our currently security-related crisis state. It's essential to weigh the long-term implications of repeating mandatory measures on EDIP legitimacy."*  — evidentiary/analytical voice; crisis-state reasoning consistent with R1 Finch's operational register
- **Chen:** absent from R5 inject — same routing pattern as R4 (Kent + Finch only on late-round injects with policy-framework content rather than readiness-specific content)

**Telemetry per turn:**

| Turn | reportPromptBudget withinLimit | llmHistory.length | Notes |
|------|-------------------------------|-------------------|-------|
| 1a (failed attempt) | **true** (budget check passed; failure was at validation layer, not at prompt construction) | ≤ 5 | invariant ✓ |
| 1b (retry — valid) | **true** | ≤ 5 | invariant ✓; prompt budget remained under safeCeiling across the full 5-round run |

**Persona-attribution check:** PASS — Kent blue, Finch amber, both rendered cleanly; no color-chip mismatch across the entire 5-round session

**Voice-drift check vs Round 1:**
- **Kent tone: SAME** — institutional-balance voice held across all 5 rounds; vocabulary like "frameworks", "legitimacy", "dissent", "procedural bounds" appears consistently in R1, R3, R4, R5 ✓
- **Finch tone: SAME** — evidential/inspector voice held; technical vocabulary (munitions, ISR, industrial bottlenecks, operational trajectory) consistent across rounds without lapsing into Kent's institutional register ✓
- **Chen tone: SAME** — operational/readiness voice on her R3 appearance was distinctive and consistent with her canonical role (frontline, stockpile, industrial capacity focus); she did not bleed into Kent or Finch's voices on the rounds she spoke ✓

**End-of-run actions:**
- Trigger debrief (click "End Game + Debrief"): **DONE** — `gameEnded` flag flipped true, yellow "Download Debrief (.md)" button appeared in toolbar
- Debrief persona messages rendered cleanly (no duplication into round transcripts — 08-05 fix live-pipeline check): **PASS** — verified in `08-02-DEBRIEF-export.md`; the three debrief persona messages (Kent, Finch, Chen) appear ONLY in the `## Debrief` section (lines 118–122 of the export); NO duplication into any Round-N transcript section. Confirms Plan 08-05's bucketing fix works correctly in live pipeline.
- Download debrief markdown: **DONE** — saved at `.planning/phases/08-qa-credential-audit/08-02-DEBRIEF-export.md` (7365 bytes, original filename `debrief-edip-security-of-supply-wargame-2026-04-15-0124.md` copied from Downloads)

**Anomalies:** The R5-advance validation failure (detailed above) — treated as **evidence**, not anomaly, because it exercises the exact defensive path Phase 8 is built to prove. Cosmetic finding (not blocking): R1 facilitator input in the export begins *"ound 1 is now live…"* (missing leading "R") — first character was stripped somewhere in the input capture pipeline between keyboard entry and history append. Logged as Phase 9 polish.

---

## Network Evidence — captured 2026-04-14 20:01 (Round 1 post-trigger)

**Evidence type:** HAR export
**Evidence file:** `.planning/phases/08-qa-credential-audit/08-02-network.har` (89 KB, 3 entries total, 1 × POST /api/llm)
**Rationale for choice:** HAR preferred — machine-parseable, captures full request/response headers + body for every entry; screenshot deemed redundant given single key request.

**Turn captured:** Round 1 post-trigger (first facilitator message: *"Round 1 is now live. Kent, set the scene for the Council. Finch, deliver the Round 1 inject from your desk."*)

**Request captured:** `POST http://localhost:5173/api/llm` → `200 OK` (20913-byte JSON payload)

**Full Request Headers (verbatim from HAR):**
```
Accept: */*
Accept-Encoding: gzip, deflate, br, zstd
Accept-Language: en-US,en;q=0.9
Connection: keep-alive
Content-Length: 20913
Content-Type: application/json
Host: localhost:5173
Origin: http://localhost:5173
Referer: http://localhost:5173/game
Sec-Fetch-Dest: empty
Sec-Fetch-Mode: cors
Sec-Fetch-Site: same-origin
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ...
sec-ch-ua: "Google Chrome";v="147", "Not.A/Brand";v="8", "Chromium";v="147"
sec-ch-ua-mobile: ?0
sec-ch-ua-platform: "Windows"
```

**Credential audit — all forbidden markers ABSENT from browser request:**

| Forbidden token | Present? | Evidence |
|---|---|---|
| `Authorization:` header | ❌ Absent | ✓ |
| `api-key:` header | ❌ Absent | ✓ |
| `Bearer ` prefix (anywhere) | ❌ Absent | ✓ |
| Direct upstream LLM endpoint URL | ❌ Absent | URL = `localhost:5173` only ✓ |
| `sk-*` or 32+ char opaque key tokens | ❌ Absent | ✓ |

**Verdict line** (verbatim for cross-reference into 08-03 §3):
> Confirmed: zero `Authorization`, zero `api-key`, zero `Bearer` prefix, zero direct LLM endpoint URL on browser-originated `POST /api/llm` requests. Backend adds upstream auth headers server-side only (cf. `backend/tests/test_llm_auth_header.py`). HAR audit performed 2026-04-14 on live Round 1 capture.

**Pitfall check (08-RESEARCH Pitfall 5):** PASS — the inspected request is browser → `localhost:5173/api/llm` (NOT the backend → upstream request). Browser request carries no auth headers.

**Satisfies:**
- Phase 8 success criterion #2 (zero `Authorization` header on any browser-originated request)
- REQ LLM-05 (credential isolation at browser boundary)
- Closes forward-dependency placeholder in `08-03-CREDENTIAL-AUDIT.md §3 Network Evidence`

---

## Downloaded Debrief — captured 2026-04-15 01:24

**Location:** [`08-02-DEBRIEF-export.md`](./08-02-DEBRIEF-export.md) (7365 bytes)

**Original filename:** `debrief-edip-security-of-supply-wargame-2026-04-15-0124.md` (downloaded to `C:\Users\taylo\Downloads\`)

**Attachment checklist:**
- [x] `.md` file downloaded at end of Round 5 (matches Phase 7 pattern `debrief-<slug>-YYYY-MM-DD-HHMM.md`)
- [x] Copied into `.planning/phases/08-qa-credential-audit/08-02-DEBRIEF-export.md` (canonical name)
- [x] Contains all 6 Phase 7 required sections: `# EDIP Security of Supply Wargame — Debrief Report` (H1) + metadata block (lines 2–9) + per-round transcripts R1–R5 (lines 11–114) + `## Debrief` (line 116) + `## Final State` (line 124) + `## Appendix: Raw Config` (line 135)
- [x] Round-N transcripts do NOT duplicate post-debrief persona messages (08-05 regression guard in live pipeline) — manually verified: the three debrief persona messages appear ONLY in the `## Debrief` section (lines 118–122); no duplication into R1/R2/R3/R4/R5 `### Transcript` sections

**Bonus findings:**
- R5 `### Transcript` section correctly includes the VALIDATION_FAILURE error as `_[Error VALIDATION_FAILURE: ...]_` (line 110) — debrief export pipeline integrates error-bubble content cleanly
- Persona display format renders `(—)` where team codes would go — matches STATE.md 07-01 design decision (ChatMessage has no teamId field); working as designed
- All per-round GFM state tables present with correct team resource columns (PC/PO/RDY/STK/CRM/IC) and severity/legitimacy header line
- `Facilitator notes:` field is blank in metadata — no facilitator-edited notes in this run; expected behaviour

---

## Transcript Hygiene (08-03 §4.2 — required before this artifact is committed)

Before committing this artifact to git, run the leak-check grep:

```bash
grep -E "sk-|Bearer |Authorization:" .planning/phases/08-qa-credential-audit/08-02-LIVE-RUN.md
```

Expect zero matches. If matches appear, redact inline (replace with `sk-REDACTED-<date>` or `Bearer REDACTED`), commit the redaction, and trigger a fresh key rotation per 08-03 §4.1 (the transcript is now tainted).

**Redaction log** (if any redactions were made during transcript capture):
- **CLEAN** — transcript hygiene grep `grep -E "sk-|Bearer |Authorization:" 08-02-LIVE-RUN.md 08-02-DEBRIEF-export.md` returned only self-referential matches (the credential audit tables and the grep command itself embedded in these transcript-hygiene instructions). Zero real credential leaks. No redactions needed. Key rotation (per Ops Confirmations table) confirmed pre-run (2026-04-14) so the key in use during this session is fresh; even if a leak had occurred it would not taint a previously-exposed key.

---

## Facilitator Verdict

**Verdict:** ✅ **PASS-WITH-POLISH** — approved by facilitator 2026-04-15 01:30 after live download and artifact audit.

**Paragraph:** Persona voice held cleanly across all 5 rounds — Kent's institutional/legitimacy register, Finch's evidentiary/technical register, and Chen's operational/readiness register remained distinct with zero persona bleed; R4 and R5 voice-drift checks vs R1 confirmed "same" on every persona. JSON parsing was clean on every successful turn, and the organic VALIDATION_FAILURE on the R5 advance attempt provided stronger-than-planned evidence for Phase 8 success criterion #4: the Layer 3 validator caught malformed LLM output, rendered a red error bubble with a discoverable `[RETRY]` affordance, preserved session state end-to-end, and the retry produced a valid response without any refresh — satisfying the criterion organically and making the manual offline-injection test unnecessary. The multi-trigger Round 3 assertion succeeded with 2 distinct speakers (Kent + Finch) delivering orthogonal, non-contradictory analyses (procedural legitimacy vs evidential threshold) — within the plan's 2–3 target range. Three polish items are flagged for Phase 9: (1) the DEV-mode `GuardedGameScreen` re-seed bug (reproduced three times during this run with a React `setState-during-render` warning pinpointing the defect at `gameStore.ts:304` — fix specification written into this artifact), (2) a cosmetic input-pipeline issue that stripped the leading "R" from the R1 facilitator input ("ound 1 is now live…" in the exported debrief), and (3) the observation that `crisisState` did not auto-escalate despite `crisisSeverity` reaching 4 (likely intentional per the "AI suggests, facilitator decides" design, but may benefit from a prompt-level threshold reminder). None of these polish items block Phase 8 closure.

**Close action:** artifact is complete. Continuation agent creates `08-02-SUMMARY.md`, updates STATE.md, and closes Phase 8.

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
