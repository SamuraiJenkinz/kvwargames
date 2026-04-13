# Domain Pitfalls: AI-Powered Wargame Facilitation Engine

**Domain:** AI-powered facilitation tool with LLM integration, live game state, and multi-persona systems
**Project:** KVWarGame — EDIP Wargame Engine (Next.js + Zustand + OpenAI-compatible LLM)
**Researched:** 2026-04-13
**Confidence basis:** Spec analysis (HIGH), LLM integration patterns (HIGH from training), live event tooling patterns (HIGH from training). WebSearch unavailable — flagged where single-source.

---

## Critical Pitfalls

Mistakes that cause rewrites, live session failures, or data loss mid-game.

---

### Pitfall C-1: Trusting Raw LLM JSON Without Defensive Parsing

**What goes wrong:** `llmClient.ts` strips markdown fences and calls `JSON.parse()` directly. If the model returns anything other than a perfectly-formed JSON object — an apology sentence, a partial response due to max_token truncation, a response wrapped in extra text, or a field with an unexpected type — the `JSON.parse` call throws, the facilitator gets a hard error mid-session, and the UI freezes with a loading spinner or crash.

**Why it happens:** Developers test once with a well-behaved model, JSON comes back clean, and the happy path is the only path tested. The spec's current `llmClient.ts` implementation does exactly one transform (strip fences) before parsing — no schema validation, no fallback, no partial recovery.

**Consequences:**
- Live session stops completely when a single LLM response is malformed
- The facilitator must refresh, losing the LLM conversation history (Zustand is ephemeral)
- All LLM history held in `llmHistory` is gone — personas lose all game context
- If max_tokens is hit mid-JSON, the response is structurally invalid and unrecoverable without validation

**Warning signs:**
- Occasional blank responses during early testing
- Model sometimes adds "Here is the JSON:" before the object
- Long game states approaching LLM context window limits
- Any `stateUpdate` with complex nested `teamUpdates` arrays

**Prevention strategy:**
1. Wrap `JSON.parse` in a `try/catch` that returns a graceful error persona message, not a thrown exception
2. Validate the parsed object against the `LLMStructuredResponse` schema (check `responses` is an array, each item has `speaker`, `message`, `stateUpdate` or null)
3. If `stateUpdate` fields have unexpected types (e.g. `crisisSeverity` is a string), coerce or discard rather than apply
4. If parse fails entirely, show an error message in chat (`type: "error"`) that lets the facilitator retry — do not leave UI in loading state
5. Set `max_tokens` high enough that a full response (3 personas × ~100 tokens each + JSON wrapper) never truncates — 1000 tokens is borderline for a verbose round-start response; consider 1500 for safety

**Phase:** Phase 4 (LLM Integration) — must be hardened before any live testing

---

### Pitfall C-2: State Updates Applied Without Clamping Validation

**What goes wrong:** The LLM returns a `stateUpdate` that sets `crisisSeverity: 7` or `pc: -3` for a team, which is outside the valid range. `applyStateUpdate` applies the delta to the store. The UI renders an impossible game state (negative PC, severity > 5), which breaks crisis state logic, vote rules, and the StatePanel bar displays.

**Why it happens:** The spec correctly specifies clamping in `stateUpdater.ts`, but under time pressure this is the kind of logic that gets "done but not tested for all edge cases." The LLM treats numeric ranges as suggestions — it reasons about them abstractly and occasionally returns values that are off by 1 or completely wrong (especially for `edipLegitimacy` which has an unusual -2 to +2 range).

**Consequences:**
- Track bars overflow or underflow (rendering glitch visible to all players)
- A team at PC -1 gets treated as "full resources" because the clamp was skipped
- Crisis state transitions driven by corrupted severity values cause wrong persona behaviour
- Debrief export captures wrong terminal state

**Warning signs:**
- `edipLegitimacy` is almost always the first field to drift (the -2/+2 range is unintuitive for the LLM)
- Team `po` (Public Opinion) also uses -2/+2 and will drift the same way
- LLM sometimes returns `null` for a numeric field when it means "no change" — not the same as 0

**Prevention strategy:**
1. Clamp ALL numeric fields in `applyStateUpdate`, not just the ones you expect to be wrong
2. Treat `null` on a numeric stateUpdate field as "no change" — do NOT apply 0
3. Treat `undefined` the same as `null` — the LLM sometimes omits fields rather than returning null
4. Unit test `stateUpdater.ts` with explicit boundary values: -99, 0, exact max, exact max+1
5. Validate `crisisState` against the `CrisisState` union type — if the model returns `"Crisis"` instead of `"Supply Crisis"`, silently discard or map to nearest valid value
6. Log all received stateUpdates to browser console in development mode for debugging

**Phase:** Phase 4, with unit tests required in Phase 6 before delivery

---

### Pitfall C-3: LLM Context Window Accumulation Breaking Late-Game Responses

**What goes wrong:** The `llmHistory` array in Zustand accumulates all user and assistant messages across the session. By Round 3–4 of a complex scenario, the conversation history — combined with the 3,000–4,000 token system prompt — approaches or exceeds the model's context window. The model begins truncating or degrading: it "forgets" game state from early rounds, personas lose character, and structured JSON responses become unpredictable.

**Why it happens:** The spec passes the full `llmHistory` to every LLM call. A 5-round scenario with 6–8 facilitator inputs per round, each generating 3-persona responses of ~300 tokens each, produces 15,000+ tokens of conversation history before the final round. Combined with the system prompt, this saturates a 16K context window and stresses even a 32K window.

**Consequences:**
- Late-round responses are degraded: personas respond to wrong context, miss state changes
- Structured JSON format breaks because the model "loses" the schema instructions
- The debrief (which is the most important output) is the most likely to be degraded
- In the worst case, the model returns narrative prose instead of JSON, crashing the session

**Warning signs:**
- Finch persona stops citing numbers accurately in rounds 3+
- Chen stops correctly referencing card preconditions
- Response times increase (more tokens to process)
- Parse errors appearing only in later rounds

**Prevention strategy:**
1. Implement a windowed history strategy: keep the last N assistant/user message pairs (N=6 is a reasonable starting point), not the full history
2. Because the system prompt always injects the full live state (round, resources, crisis state), the "memory" of what happened is encoded in state — not in chat history
3. Alternatively, summarise early history into a single "session context" message after Round 2 and replace the earlier entries
4. Add a `llmHistoryTokenEstimate` counter in the store that warns when approaching 8,000 tokens of history
5. Test explicitly with a full 5-round Scenario 2 run — this is the spec's longest scenario and is guaranteed to expose this issue

**Phase:** Phase 4 design decision — must choose windowing strategy before wiring up conversation history; validate in Phase 6

---

### Pitfall C-4: Persona Drift — Personas Bleeding Into Each Other's Roles

**What goes wrong:** The routing rules in the system prompt tell the model which persona speaks in which context, but the LLM does not always follow them strictly. After several rounds, Kent begins quoting numbers (Finch's domain), Chen begins facilitating discussion (Kent's domain), or two personas give contradictory state updates in the same response (both Finch and Chen report different severity values for the same event).

**Why it happens:** The routing table is instructional, not enforceable. As conversation context grows, the model drifts toward producing "helpful" responses from whichever persona has the most relevant training associations for a given input. The spec's routing rules are comprehensive but the enforcement mechanism is prompt instruction only.

**Consequences:**
- Three-persona value proposition collapses — all voices sound similar
- Duplicate state updates from multiple personas create ambiguous game state
- Facilitators lose trust in the tool if Kent starts citing article numbers
- If both Finch and Chen produce `stateUpdate` objects for the same event, `applyStateUpdate` is called twice — it is not idempotent for sequential field changes

**Warning signs:**
- Kent's messages start containing numbers and percentages
- Chen's messages contain facilitation phrases ("before we proceed…")
- Multiple `stateUpdate` objects appear in a single `responses` array for the same field
- The word "I" appears in a persona's message (they should speak in third-person or role voice)

**Prevention strategy:**
1. Add explicit negative constraints to each persona definition: "Kent NEVER quotes numbers, percentages, or resource values. Kent NEVER validates card preconditions." and so on
2. Encode the routing table as BOTH a positive rule (Kent speaks on round start) AND a negative exclusion (Kent does NOT speak when the trigger is card precondition validation)
3. When multiple `stateUpdate` objects are present in a response, only apply the one from the most appropriate persona for that context (Finch owns crisisSeverity and edipLegitimacy; Chen owns card mechanic corrections); document this precedence rule in `stateUpdater.ts`
4. Add a test case in Phase 6: send an input that simultaneously triggers a round-start, a card announcement, and a dispute — verify the correct personas activate

**Phase:** Phase 4 (prompt engineering) and Phase 6 (multi-trigger testing)

---

### Pitfall C-5: Silent Loss of LLM Credentials to Browser / Logs

**What goes wrong:** The API key reaches the browser, corporate security scans it, and the tool is blocked from deployment. This happens through several vectors: accidentally using a client-side `fetch` directly to the LLM endpoint instead of through `/api/llm`; the Next.js API route logging request/response bodies including the Authorization header; or `NEXT_PUBLIC_` prefixed environment variables accidentally used for the API key.

**Why it happens:** The spec correctly uses the Next.js API route pattern. But the risk is in execution: if a developer adds a fallback `fetch` for testing, or if error handling logs the outgoing request headers, credentials leak. The `NEXT_PUBLIC_` prefix is particularly dangerous — Next.js will embed any variable with that prefix into the client bundle.

**Consequences:**
- Corporate security block pre-deployment
- API key revocation
- Potential data exposure in browser network tabs or console logs

**Warning signs:**
- Any `NEXT_PUBLIC_LLM_API_KEY` in code or env files
- Any direct `fetch` to the LLM endpoint URL from client-side code
- Error handlers that log `request.headers` or the full outgoing request body

**Prevention strategy:**
1. The API key and base URL must use `LLM_API_KEY` and `LLM_API_BASE_URL` (no `NEXT_PUBLIC_` prefix) — never accessible to client bundle
2. Add a CI check or pre-commit hook that scans for `NEXT_PUBLIC_LLM` in all files
3. The spec's manual smoke test "Confirm zero LLM credentials in browser DevTools > Network" is the right verification — make it the first QA step, not the last
4. In the API route error handler, log `response.status` only — never log request headers or the full error response body (corporate LLM errors may include endpoint metadata)

**Phase:** Phase 4 (by design — non-negotiable) + Phase 6 verification

---

## Moderate Pitfalls

Mistakes that cause delays, degraded reliability, or technical debt requiring rework.

---

### Pitfall M-1: Optimistic State Updates Causing State Desync

**What goes wrong:** The facilitator sends an input, the LLM responds with a `stateUpdate`, and `applyStateUpdate` is called. But the state the LLM reasoned about was the state at request time, not at response time. If the facilitator fires two inputs rapidly (e.g., advances the round AND sends a text input within seconds), the second LLM response may apply a state update based on stale state, double-applying or conflicting with the first update.

**Why it happens:** Both inputs are sent while `loading` is technically false (the first request just cleared), and each generates its own `stateUpdate`. The store applies both sequentially without knowing they were computed from the same base state.

**Prevention strategy:**
1. The `loading` flag in the store should block all new LLM requests — the spec already sets `loading: true` during requests, but verify the "Advance Round" and text send buttons both respect this flag
2. Treat state updates as diffs applied to the current state at response time, not at request time — `applyStateUpdate` already does this correctly if clamping is implemented
3. Add a short visual "settling" period (200ms) after a state update before re-enabling the input, to prevent rapid double-firing

**Phase:** Phase 4 (input handling), Phase 5 (polish)

---

### Pitfall M-2: Corporate Network Timeouts Causing Silent Failures

**What goes wrong:** The corporate LLM proxy has a 30-second timeout. A complex round-start prompt with a full game state block takes 25–35 seconds to generate three persona responses. The request times out, the Next.js API route throws an uncaught fetch error, and the UI is stuck in `loading: true` with no user-visible feedback.

**Why it happens:** The spec's API route wraps in `try/catch` and returns a 500 error, but the client's `callLLM` function throws on `!res.ok` — it does not have a timeout or a stuck-loading recovery path. The facilitator has no way to recover except refreshing the page, which destroys session state.

**Consequences:**
- Session state lost during a critical round transition
- Facilitator embarrassment during a live exercise
- No mechanism to retry without full session reload

**Prevention strategy:**
1. Add an `AbortController` with a 45-second timeout to the client-side `fetch` in `llmClient.ts`
2. On timeout/network error, set `loading: false` and insert a `type: "error"` message in chat with a retry button that re-sends the last facilitator input
3. Store the last sent facilitator message in the Zustand store so "retry" can resend it without requiring the user to retype
4. Set Next.js API route `maxDuration` (or equivalent) explicitly for corporate deployment environments that enforce route timeouts

**Phase:** Phase 4 (error handling), Phase 5 (retry UX)

---

### Pitfall M-3: System Prompt Injecting Stale Game State

**What goes wrong:** `buildSystemPrompt(config, gameState)` is called once and the resulting string is passed to every LLM call in a session. If the caller caches the prompt or builds it once at session start, all subsequent calls reflect Round 1 state regardless of actual current state.

**Why it happens:** This is easy to do accidentally: build the prompt when the game starts, store it in state, and pass it on every call. The prompt looks correct because it showed the right state initially. The bug only appears when Finch references a resource value that changed two rounds ago.

**Prevention strategy:**
1. `buildSystemPrompt` must be called fresh on every LLM invocation, not once at session start
2. The Zustand store should not store the system prompt — it should be derived from the current `gameState` at call time
3. Add a test in Phase 6: call `buildSystemPrompt` before and after a `stateUpdate` — verify the state block differs

**Phase:** Phase 4 (architectural decision) — easy to get right, easy to get wrong

---

### Pitfall M-4: Config Generation Producing Invalid GameConfig Structure

**What goes wrong:** The generate-from-brief feature asks the LLM to produce a `GameConfig` JSON from a text brief. The generated config is missing required fields, has invalid `crisisState` enum values, has fewer than 4 teams, or has `teamUpdates` with ids that don't match any team. The facilitator sees a `JSON.parse` success but the game fails silently when `initGame` is called.

**Why it happens:** The generation prompt includes the TypeScript interface as a comment — the model follows it approximately but not exactly. Missing optional fields that are actually required by `initGame`, wrong enum values, and numeric ranges outside the spec are all common.

**Prevention strategy:**
1. After `JSON.parse` on a generated config, run a schema validation function that checks required fields, valid enum values, correct team count, and plausible numeric ranges
2. Show the facilitator specific validation errors ("Missing field: teams[1].ic") not just "Invalid config"
3. Allow the facilitator to edit the raw JSON in the review step before launching — the spec already includes this; it is the correct mitigation for imperfect generation
4. Test generation with 3 different brief types: cyber exercise, logistics exercise, political crisis — verify each produces a launchable config

**Phase:** Phase 5 (config generation), Phase 6 (testing)

---

### Pitfall M-5: Zustand Store Not Initialised Before Game Screen Renders

**What goes wrong:** The facilitator navigates directly to `/game` (via URL bar, browser back, or a reload) without going through `/setup`. `gameState` is `null` in the store. Components call `gameState.teams` and crash with a null reference error, rendering a blank or broken game screen.

**Why it happens:** Zustand state is ephemeral (as specified — no localStorage). A page reload or direct navigation clears the store. The game screen components assume non-null `gameState`.

**Prevention strategy:**
1. Add a guard in the `/game` page that redirects to `/setup` if `gameState === null`
2. All components that consume `gameState` should use TypeScript non-null assertions only after the guard, not speculatively
3. Consider a "restore session" prompt if the game screen detects stale state — though the spec explicitly does not require persistence, a brief browser refresh should not destroy a live session entirely

**Phase:** Phase 3 (layout), Phase 4 (guard logic)

---

### Pitfall M-6: Voting Logic and Card Preconditions Silently Wrong

**What goes wrong:** The LLM validates card preconditions conversationally but the facilitator may override Chen's objection and "play" a card anyway. The system has no enforcement — it is advisory. But if `stateUpdate` from a card play is applied without validating preconditions server-side, the game state becomes inconsistent with the rules (e.g., CS-02 applied when `crisisSeverity < 3`).

**Why it happens:** The spec is correct that the system is advisory. But developers may add "apply card effect" shortcuts that bypass the LLM and apply predefined card effects directly — a natural temptation for making the UI snappier. Any such shortcut must still validate preconditions.

**Prevention strategy:**
1. The spec's model — all state changes come through LLM stateUpdates only — is the correct architecture; do not add direct "apply card" buttons that bypass the LLM
2. If a "quick apply" feature is added later, it must validate card `req` fields against current game state before applying
3. Document this constraint in a code comment in `stateUpdater.ts`: "State updates come from LLM only. Direct manipulation should validate card preconditions."

**Phase:** Phase 4 design constraint

---

## Minor Pitfalls

Mistakes that cause friction, confusion, or poor facilitator experience but are recoverable.

---

### Pitfall Mi-1: Auto-Scroll Breaking at Wrong Moment

**What goes wrong:** `ChatFeed` auto-scrolls to bottom on new messages, but this fires while the facilitator is scrolling up to review an earlier message. The scroll snaps back to the bottom mid-read.

**Prevention strategy:** Detect whether the user has manually scrolled up (scroll position is not at bottom). Only auto-scroll if the feed is already at the bottom or if a new message was just sent by the facilitator.

**Phase:** Phase 3 (layout), Phase 5 (polish)

---

### Pitfall Mi-2: Loading Spinner Giving No Indication of Progress

**What goes wrong:** The `LoadingDots` component shows while the LLM generates. A 20–30 second generation with no progress feedback feels like a crash to a facilitator who is not used to the tool's cadence.

**Prevention strategy:** Show a message under the spinner: "Generating responses…" with elapsed time in seconds after 5 seconds. This sets expectations and distinguishes "thinking" from "frozen."

**Phase:** Phase 5 (polish)

---

### Pitfall Mi-3: ReferencePanel Not Showing Relevant Card on Mention

**What goes wrong:** When Chen mentions "CS-02" in a response, the facilitator has to manually find the card in the CARDS tab. The reference panel does not auto-navigate to the mentioned card.

**Prevention strategy:** When a persona message is rendered, scan it for card IDs (regex match against all card ids in game config). If found, offer a clickable highlight that opens the card detail. This is a polish item, not a launch blocker.

**Phase:** Phase 5 (polish)

---

### Pitfall Mi-4: Debrief Export Missing Critical Round History

**What goes wrong:** The debrief exporter collects only `isDebrief: true` messages. If a facilitator requests an early debrief (mid-game), then continues playing and requests the final debrief, the export only contains one of the two debrief segments — whichever matches the filter.

**Prevention strategy:** The debrief export should include all messages flagged `isDebrief: true` across the entire session, ordered by timestamp. If a "full transcript" option is added, include all messages. Document the filter logic clearly.

**Phase:** Phase 5 (debrief export)

---

### Pitfall Mi-5: Environment Variable Missing Silently Failing

**What goes wrong:** `LLM_API_BASE_URL` is missing from `.env.local`. The API route constructs a URL like `undefined/chat/completions`, sends the request, and returns a confusing 404 or CORS error. The facilitator and developer see a generic error with no indication that the env var is the problem.

**Prevention strategy:** Add startup validation in the API route: if `process.env.LLM_API_BASE_URL` or `process.env.LLM_API_KEY` is missing, return a 500 with a clear error message: "LLM_API_BASE_URL is not configured. Check .env.local." This dramatically shortens setup debugging time.

**Phase:** Phase 4 (LLM integration)

---

## "Looks Done But Isn't" Checklist

Items that pass a quick visual check but have hidden problems. Verify each explicitly before declaring a phase complete.

| Item | How to Verify |
|------|---------------|
| LLM JSON parsing is defensive | Manually send a response that contains text before/after JSON; confirm no crash |
| State clamping covers all fields | Unit test with out-of-range values for every field including `po` and `edipLegitimacy` |
| System prompt reflects current state | Log the prompt for Round 1 and Round 3; confirm resource values differ |
| Credentials absent from browser | Open DevTools > Network > select LLM call > check Request Headers; no Authorization header should appear |
| `loading` flag blocks double-submission | Click Send, then immediately click Advance Round; confirm second action is ignored |
| Null `stateUpdate` is no-op | Receive a response with `stateUpdate: null`; confirm game state unchanged |
| Game screen handles null gameState | Navigate directly to `/game` URL; should redirect to `/setup`, not crash |
| Error messages show in chat, not console | Simulate LLM timeout; confirm error message appears in chat feed |
| History is windowed, not unbounded | Run a full 5-round session; check `llmHistory.length` never exceeds 2×N+1 entries |
| Persona routing fires correctly | Send "Team A invokes Escalate Security Narrative"; confirm Chen validates, Finch models effects |

---

## Phase-Specific Warnings

| Phase | Topic | Likely Pitfall | Mitigation |
|-------|--------|---------------|------------|
| Phase 1 | TypeScript types | `StateUpdate` with partial `TeamState` allows `undefined` fields that `applyStateUpdate` mishandles as 0 | Make clamping treat `undefined` as "no change" explicitly in types |
| Phase 2 | Config validation | JSON textarea accepts any string; malformed config crashes `initGame` | Parse and validate before enabling Launch button |
| Phase 3 | StatePanel bar for legitimacy | Legitimacy is -2 to +2 (5 states) but rendering as a 0–4 bar requires mapping; off-by-one errors common | Unit test bar calculation for -2, -1, 0, +1, +2 |
| Phase 4 | Prompt building | System prompt > 4,000 tokens + long history saturates 8K context models | Measure prompt token count; test with a low-context model config |
| Phase 4 | stateUpdater | `teamUpdates` is an array of partials; a bug where the loop matches by array index instead of `id` applies updates to wrong teams | Unit test with a teamUpdate for Team C only; verify Teams A, B, D unchanged |
| Phase 4 | LLM proxy | Corporate endpoint may return non-standard JSON response structure (`result.output` instead of `choices[0].message.content`) | Make the response extraction path configurable or add a parsing fallback |
| Phase 5 | Config generation | Generated `GameConfig` has structurally valid JSON but semantically wrong game design (voting rule contradicts cards) | Human review step is the mitigation; make the review JSON editor prominent |
| Phase 6 | QA | Testing only happy-path persona responses; never testing malformed responses | Explicitly inject bad LLM responses during QA testing |

---

## Sources and Confidence Notes

All findings are based on:
- Full analysis of `WARGAME_ENGINE_DEV_SPEC.md` (HIGH confidence — primary source document)
- LLM integration patterns from production GPT-4o deployments in training data (HIGH confidence for structural patterns, MEDIUM for specific token limits which may have changed)
- Next.js 14 App Router security patterns (HIGH confidence)
- Zustand ephemeral state patterns (HIGH confidence)
- Live event facilitation tool reliability requirements (HIGH confidence — domain reasoning)

WebSearch was unavailable for this research session. Pitfalls related to specific LLM rate limit numbers, exact context window sizes for current model versions, and corporate proxy timeout defaults should be verified against current provider documentation before implementation.

The most critical pitfalls for this specific project — in order of session-breaking severity — are: C-1 (JSON parsing), C-3 (context accumulation), C-2 (state clamping), C-4 (persona drift), and M-2 (network timeout recovery).
