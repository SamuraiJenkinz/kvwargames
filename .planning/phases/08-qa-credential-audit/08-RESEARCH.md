# Phase 8: QA & Credential Audit — Research

**Researched:** 2026-04-14
**Domain:** Test coverage, credential hygiene, error-injection mechanics, live-run verification
**Confidence:** HIGH — all findings from direct codebase reads; no external sources required

---

## Summary

Phase 8 is an evidence-gathering and verification phase, not a feature phase. The codebase is complete as of Phase 7. All five sub-tasks (08-01 through 08-05) need to write against existing seams — not introduce new ones.

The primary research questions were: what's already tested, what's missing, where exactly are the seams to test, and what commands to run. All answers are grounded in direct file reads with line numbers.

**Primary recommendation:** Start 08-01 by reading `stateUpdater.test.ts` for naming conventions (already done below), then add exactly the missing boundary cases enumerated here. For 08-04, the correct test seam for "malformed LLM JSON returned to store" is `gameStore.test.ts` with a mocked `parsePersonaResponse` returning `{ ok: false, errorKind: 'PARSE_FAILURE', ... }`.

---

## Standard Stack

No new libraries. All work uses already-installed tools.

### Frontend Tests
| Tool | Already Used In | How to Run |
|------|----------------|------------|
| vitest | all `*.test.ts` in `src/lib/` | `pnpm test` (or `npm test`) from repo root |
| @testing-library/react | `gameStore.test.ts` (waitFor) | same |
| vi.stubGlobal / vi.mock / vi.fn | llmClient, gameStore, debriefExporter tests | same |

### Backend Tests
| Tool | Already Used In | How to Run |
|------|----------------|------------|
| pytest | `backend/tests/` | `cd backend && pytest tests/` |
| httpx.MockTransport | `test_llm_auth_header.py`, `test_config_gen.py` | same |
| FastAPI TestClient | both backend test files | same |

**Verification command (full suite):**
```bash
# Frontend (from repo root)
pnpm test --run
# Backend (from backend/ directory)
pytest tests/ -v
```

---

## Architecture Patterns

### 08-01: stateUpdater boundary test conventions

**Existing file:** `src/lib/stateUpdater.test.ts` (373 lines)

**Naming pattern in use** (describe/it style):
```
describe('applyStateUpdatePure — <category label>', () => {
  it('<field> <boundary value> → <clamped value> and records clampLog', () => { ... })
  it('accepts <field>=<min> and <field>=<max>', () => { ... })
})
```

Examples from existing tests:
- `describe('applyStateUpdatePure — PC boundary (0..6)', ...)` (line 178)
- `it('accepts pc=0 and pc=6', ...)` (line 179)
- `it('clamps pc=-1 → 0 and pc=7 → 6', ...)` (line 194)
- `it('clamps crisisSeverity 7 → 5 and records clampLog', ...)` (line 75)

**Coverage gap analysis — what 08-01 must ADD:**

The success criteria specifies: crisisSeverity 0/5/6, edipLegitimacy -2/+2/+3, PC 0/6/7, PO -2/+2, readiness 0/5, plus null/undefined no-op.

| Field | Tested (accepts at-boundary) | Tested (clamps just-above) | MISSING |
|-------|------------------------------|---------------------------|---------|
| crisisSeverity | No explicit accepts=0 or accepts=5 | clamps 7→5 ✓ | accepts=0, accepts=5, clamps=6→5 |
| edipLegitimacy | No explicit accepts=-2 or accepts=+2 | clamps 5→2 ✓, clamps -5→-2 ✓ | accepts=-2, accepts=+2, clamps=+3→+2 |
| PC | accepts=0 and accepts=6 ✓ (line 179-207) | clamps -1→0 and 7→6 ✓ | none — fully covered |
| PO | accepts=-2 and accepts=+2 ✓ (line 211-239) | clamps -3→-2 and 3→2 ✓ | none — fully covered |
| readiness | accepts=0 and accepts=5 ✓ (line 243-279) | clamps -1→0 and 6→5 ✓ | none — fully covered |
| null/undefined no-op | null ✓ (line 109), undefined ✓ (line 118) | — | none — fully covered |

**Conclusion for 08-01:** Add three `describe` blocks to `stateUpdater.test.ts`:
1. `describe('applyStateUpdatePure — crisisSeverity boundary (0..5)', ...)` with `it('accepts crisisSeverity=0 and crisisSeverity=5', ...)` and `it('clamps crisisSeverity=6 → 5 and records clampLog', ...)`
2. `describe('applyStateUpdatePure — edipLegitimacy boundary (-2..+2)', ...)` with `it('accepts edipLegitimacy=-2 and edipLegitimacy=+2', ...)` and `it('clamps edipLegitimacy=+3 → +2 and records clampLog', ...)`
3. A combined `it` or standalone `describe` for null/undefined on team fields (null `pc` field, undefined `pc` field in a teamUpdate) — the current null/undefined tests only cover top-level fields.

Use `makeState()` and `makeTeam()` fixtures already defined at lines 7-28 of the test file.

### 08-04: Error injection — frontend seam

**The key question:** How does "malformed JSON response from backend" reach the store's error path?

**Answer (from code tracing):**
- `gameStore.runLLMTurn` (line 163) calls `callLLMProxy` (mocked in gameStore tests)
- On `llmResult.ok === true`, it calls `parsePersonaResponse(llmResult.text)` (line 213)
- `parsePersonaResponse` is mocked in `gameStore.test.ts` via `vi.mock('@/lib/responseParser', ...)` (line 37)
- If the mock returns `{ ok: false, errorKind: 'PARSE_FAILURE', raw: '...', detail: '...' }`, the store pushes an error bubble with `code: 'PARSE_FAILURE'` and does NOT update `gameState` or `llmHistory`

**Correct test seam for 08-04 "malformed LLM JSON response produces red error bubble":**
```typescript
// In gameStore.test.ts — follow the pattern at lines 631-654
mockedCallLLMProxy.mockResolvedValueOnce({ ok: true, text: 'not valid json {{{' })
mockedParsePersonaResponse.mockReturnValueOnce({
  ok: false,
  errorKind: 'PARSE_FAILURE',
  raw: 'not valid json {{{',
  detail: 'JSON.parse failed',
})
```
Then assert: one error message pushed, `errorCode === 'PARSE_FAILURE'`, `gameState` unchanged, `llmHistory` unchanged. This test already exists at line 631 — verify it passes and add any missing assertions about the red bubble being visible (error type in messages).

**Important:** Do NOT test `callLLMProxy` directly for "malformed JSON" — `llmClient.ts` handles non-JSON body at its own layer and returns `INTERNAL_ERROR`, not `PARSE_FAILURE`. The "malformed structured JSON from LLM" scenario (LLM returns HTTP 200 with valid JSON body containing a `.text` field, but `.text` itself is not valid persona JSON) is the `parsePersonaResponse` path.

### 08-04: Error injection — backend seam

**Existing pattern** in `test_llm_auth_header.py` (lines 38-53):
```python
def _build_mock_client(captured: list[httpx.Request]) -> httpx.AsyncClient:
    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return httpx.Response(200, json={"choices": [{"message": {"role": "assistant", "content": "ok"}}]})
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))
```

**For 08-04 backend error injection tests**, create new file `backend/tests/test_error_injection.py` using this same `TestClient(app)` + `app.state.http_client` swap pattern. Patterns for error scenarios:

```python
# 504 timeout
return httpx.Response(504, json={"error": {"code": "LLM_TIMEOUT", "message": "..."}})

# 500 upstream error  
return httpx.Response(500, json={"error": {"code": "LLM_UPSTREAM_ERROR", "message": "..."}})

# Truncated/malformed body (200 OK, not valid JSON structure)
return httpx.Response(200, content=b'{"choices": [{"message": {"role": "assistant", "content"')
# This tests the backend's INTERNAL_ERROR catch-all (KeyError on data["choices"][0]["message"]["content"])
```

**Missing env var startup behaviour — confirmed fact:** `get_settings()` is called at startup in the lifespan function (`main.py` line 72: `settings = get_settings()`). `Settings` uses pydantic-settings with `llm_api_key: str` (no default, line 32 in `config.py`). This means: **missing `LLM_API_KEY` raises `ValidationError` at startup, server refuses to start.** It is NOT a request-time error. The `llm.py` router also calls `get_settings()` at request time (line 19 in `llm.py`), but the lifespan fails first.

**08-04 missing-env-var test approach:** Use `monkeypatch.delenv("LLM_API_KEY")` (after `env_base` fixture sets it), then call `get_settings()` directly and assert it raises `ValidationError`. Do NOT start TestClient — the lifespan will crash. This matches the spirit of the 08-04 "startup behaviour on missing `LLM_API_KEY`" requirement.

### 08-05: Multi-trigger persona routing

**Where routing lives:** In the system prompt, not in any TypeScript routing function. `promptBuilder.ts` `buildBlock8()` (lines 170-192) embeds routing rules as literal text in block 8 of the system prompt. The LLM is instructed to route itself; there is no TypeScript dispatch switch.

**What "multi-trigger input" test actually tests:** When the facilitator sends a message containing cues for multiple trigger types (e.g., "[ROUND_START Round 3] Supply disruption — Team A plays EMDR Card — Team B disputes the legitimacy ruling"), the LLM response must:
1. Include Kent + Finch + Chen (max 3 personas, no duplicates)
2. Produce valid parseable JSON
3. Not duplicate state updates

**The correct unit under test for 08-05 multi-trigger routing:** This is NOT a unit test of TypeScript routing code (there is no TypeScript router). It is either:
- A `promptBuilder.test.ts` test asserting block 8 contains the correct routing text (already covered — block 8 heading verified in `promptBuilder.test.ts` line 46)
- OR a live/integration test assertion from the 08-02 live run

**Existing routing tests:** `promptBuilder.test.ts` verifies block headings are present. It does NOT verify routing rule text content in detail. If 08-05 wants to add a "routing rules text completeness" unit test, add it to `promptBuilder.test.ts` asserting `buildSystemPrompt` result `toContain('Round start → kent')` and `toContain('Dispute / challenge')` etc.

**The multi-trigger test as integration/live observation (08-05 main deliverable):** Craft a single facilitator message combining round-start, card-play, and dispute cues. Submit to real LLM. Observe: (a) parsePersonaResponse succeeds, (b) `responses` array has 2-3 distinct speakers, (c) no duplicate speakers, (d) each stateUpdate is additive not contradictory. This is a live-run assertion, not a vitest unit test.

### 08-05: Debrief export bucketing fix

**The bug (confirmed):** In `generateDebriefMarkdown` (`debriefExporter.ts` lines 196-215), the round-bucketing loop iterates ALL messages and assigns non-round-divider messages to `roundBuckets.get(currentRound)`. It does NOT stop at the `debrief_divider`. The `lastDebriefIdx` is computed separately at line 228. Persona messages at index > `lastDebriefIdx` therefore appear in **both** the current-round bucket (transcript) AND the debrief slice.

**The fix location:** Lines 196-215 of `debriefExporter.ts`. The fix is to skip messages at index >= `lastDebriefIdx` from bucket assignment. Since `lastDebriefIdx` is computed at line 228 (after the bucketing loop), it must be moved up before the loop.

**Minimal fix:**
1. Move the `lastDebriefIdx` `reduce` to before the bucketing loop (currently at line 228 — move to before line 196)
2. In the bucketing `for` loop, add: `if (lastDebriefIdx !== -1 && messages.indexOf(msg) >= lastDebriefIdx) continue`

Or more precisely (index-based loop):
```typescript
// Compute lastDebriefIdx FIRST (before bucketing loop)
const lastDebriefIdx = messages.reduce<number>(
  (acc, m, i) => (m.type === 'debrief_divider' ? i : acc),
  -1,
)

for (let i = 0; i < messages.length; i++) {
  const msg = messages[i]
  if (lastDebriefIdx !== -1 && i >= lastDebriefIdx) break  // stop before debrief
  if (msg.type === 'round_divider') { ... }
  else { bucket.push(msg) }
}
```

**Test update needed in `debriefExporter.test.ts`:** The existing Group 3 test at line 165 ("Debrief section does NOT contain Round 2 inject.") already passes. Add a NEW assertion: "Round 2 transcript does NOT contain Chen's 'Final reflection.' message" — i.e., after the fix, `Final reflection.` should only appear in the `## Debrief` section, NOT in the Round 2 transcript. This is the regression guard.

**Group 3b multi-divider test** (line 188-220) already correctly tests that `INTERIM_DEBRIEF_MSG` and `R2_PLAY_MSG` appear in their round sections. After the fix, add: `R2_PLAY_MSG` must NOT appear in the round bucket if it's after `lastDebriefIdx`. This test will need updating if `R2_PLAY_MSG` (index 3, before the second `debrief_divider` at index 4) is in a round bucket — it should remain there.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Request capture for credential audit | Custom proxy middleware | `httpx.MockTransport` with `captured: list[httpx.Request]` — already in `test_llm_auth_header.py` | Built-in, zero deps, proven pattern |
| HAR file generation for credential audit | Browser extension or custom tool | Chrome DevTools Network tab → Export HAR | Sufficient for internal audit; HAR JSON > 100KB for full session; only need filtered excerpt |
| Missing env var detection | Custom validator | Pydantic `ValidationError` — already raised by `get_settings()` | Already wired; just test it |

---

## Common Pitfalls

### Pitfall 1: Testing wrong "malformed JSON" seam
**What goes wrong:** Writing a test that stubs `fetch` to return non-JSON body (400 or 200) and calling it "malformed LLM response". This tests `llmClient.ts` error handling, not the "LLM returns structurally invalid persona JSON" scenario.
**Root cause:** Two separate error layers — HTTP body parse failure (llmClient) vs persona schema validation failure (responseParser/gameStore).
**How to avoid:** The 08-04 scenario "malformed LLM response produces red error bubble" must mock `parsePersonaResponse` to return `{ ok: false, errorKind: 'PARSE_FAILURE' }` in `gameStore.test.ts`. The `llmClient.test.ts` already covers HTTP-layer malformed body.

### Pitfall 2: stateUpdater boundary tests for at-boundary values are missing
**What goes wrong:** Assuming "clamps 7→5" proves "accepts 5". These are different invariants: one tests clamping math, the other tests that a valid boundary value passes through unchanged.
**How to avoid:** Add explicit `it('accepts crisisSeverity=0 and crisisSeverity=5', ...)` tests — these are the cases from the success criteria (`crisisSeverity 0/5/6`) where 0 and 5 are "at boundary" (valid) and 6 is "one above max" (should clamp). Currently only "7→5" and "-3→0" are tested.

### Pitfall 3: Backend test missing env var — starting TestClient when env is missing
**What goes wrong:** Calling `with TestClient(app) as client:` after `monkeypatch.delenv("LLM_API_KEY")` will attempt to run the lifespan, which calls `get_settings()`, which raises `pydantic.ValidationError`. This will cause the test to fail with an unexpected exception rather than asserting the expected behaviour.
**How to avoid:** For missing-env-var tests, assert `get_settings()` raises `ValidationError` directly without starting the server — or assert `TestClient(app).__enter__` raises. Do not call routes after the startup fails.

### Pitfall 4: Debrief fix breaks the multi-divider test Group 3b
**What goes wrong:** After fixing round bucketing to stop at `lastDebriefIdx`, the Group 3b test assertion `expect(md).toContain('INTERIM_DEBRIEF_MSG')` (line 217) may fail if the INTERIM message is at index 1 (before the first divider at index 0 — but it's actually AFTER it at index 1). Check indices carefully: in the two-divider scenario, `INTERIM_DEBRIEF_MSG` is at index 1 (after first `debrief_divider` at index 0). Fix: `lastDebriefIdx` will be 4 (second divider). `INTERIM_DEBRIEF_MSG` at index 1 IS before index 4, so it still gets bucketed. No break.

### Pitfall 5: HAR file for credential audit — looking for auth headers in browser→backend requests
**What goes wrong:** DevTools Network shows the browser's `POST /api/llm` request. The `Authorization` header should NOT be present on this request (it's a browser→localhost request; the auth header is added by the backend to the outbound upstream request). The audit must confirm ABSENCE of auth headers on browser-originated requests, not presence.
**How to avoid:** In the DevTools network view, inspect the browser's `POST /api/llm` call. Expected: no `Authorization`, no `api-key` headers. The backend adds auth on the outbound side — not visible to the browser.

---

## Code Examples

### stateUpdater boundary test — missing crisisSeverity at-boundary pattern
```typescript
// Source: src/lib/stateUpdater.test.ts (extend existing file, following line 178 pattern)
describe('applyStateUpdatePure — crisisSeverity boundary (0..5)', () => {
  it('accepts crisisSeverity=0 and crisisSeverity=5', () => {
    const state = makeState({ crisisSeverity: 3 })
    const { nextState: s1, clampLog: log1 } = applyStateUpdatePure(state, { crisisSeverity: 0 })
    expect(s1.crisisSeverity).toBe(0)
    expect(log1).toEqual([])

    const { nextState: s2, clampLog: log2 } = applyStateUpdatePure(state, { crisisSeverity: 5 })
    expect(s2.crisisSeverity).toBe(5)
    expect(log2).toEqual([])
  })

  it('clamps crisisSeverity=6 → 5 and records clampLog', () => {
    const state = makeState({ crisisSeverity: 3 })
    const { nextState, clampLog } = applyStateUpdatePure(state, { crisisSeverity: 6 })
    expect(nextState.crisisSeverity).toBe(5)
    expect(clampLog).toContainEqual({ field: 'crisisSeverity', raw: 6, clamped: 5 })
  })
})
```

### Backend error injection pattern — extend test_llm_auth_header.py pattern
```python
# Source: backend/tests/test_llm_auth_header.py (lines 38-53 pattern)
def _build_mock_client_error(status: int, code: str, message: str) -> httpx.AsyncClient:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(status, json={"error": {"code": code, "message": message}})
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))

def test_upstream_timeout_returns_504(env_base):
    with TestClient(app) as client:
        original = app.state.http_client
        app.state.http_client = _build_mock_client_error(504, "LLM_TIMEOUT", "timed out")
        try:
            resp = _post_trivial_llm_request(client)
        finally:
            app.state.http_client = original
    assert resp.status_code == 504
    assert resp.json()["error"]["code"] == "LLM_TIMEOUT"
```

### Frontend parse failure error injection — gameStore.test.ts pattern
```typescript
// Source: src/lib/gameStore.test.ts (line 631 pattern — ALREADY EXISTS, verify it)
it('parse failure path: error bubble carries rawResponse + retryInput; gameState + llmHistory unchanged', async () => {
  initS1()
  const stateBefore = getState().gameState
  mockedCallLLMProxy.mockResolvedValueOnce({ ok: true, text: 'not-json{{{' })
  mockedParsePersonaResponse.mockReturnValueOnce({
    ok: false,
    errorKind: 'PARSE_FAILURE',
    raw: 'not-json{{{',
    detail: 'JSON.parse failed',
  })
  getState().sendFacilitatorMessage('inject')
  await waitFor(() => expect(getState().loading).toBe(false))
  const msgs = getState().messages.filter((m) => m.type === 'error')
  expect(msgs).toHaveLength(1)
  expect(msgs[0].errorCode).toBe('PARSE_FAILURE')
  expect(getState().gameState).toEqual(stateBefore)
  expect(getState().llmHistory).toHaveLength(0)
})
```

### Credential audit grep commands (zero-match assertions)
```bash
# Run from repo root — all must return zero matches
grep -r "Authorization" src/ --include="*.ts" --include="*.tsx" | grep -v ".test."
grep -r "Bearer " src/ --include="*.ts" --include="*.tsx" | grep -v ".test."
grep -r "api_key\|apiKey\|API_KEY" src/ --include="*.ts" --include="*.tsx" | grep -v ".test."
grep -r "sk-" src/ --include="*.ts" --include="*.tsx" | grep -v ".test."
grep -r "api.openai.com\|LLM_ENDPOINT" src/ --include="*.ts" --include="*.tsx" | grep -v ".test."
# Verify .env is gitignored
git check-ignore -v backend/.env
# Verify .env.example has no real keys
grep -E "sk-|[a-z0-9]{32,}" backend/.env.example
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact for Phase 8 |
|--------------|------------------|--------------|-------------------|
| `HISTORY_WINDOW_N = 6` | `HISTORY_WINDOW_N = 2` | Phase 06-08 | Live run 08-02 should confirm `llmHistory.length <= 5` per turn |
| Inline clamp logic in gameStore | `applyStateUpdatePure` + `CLAMP_RANGES` in `stateUpdater.ts` | Phase 06-03 | 08-01 tests go in `stateUpdater.test.ts`, NOT gameStore test |
| No credential isolation | Backend proxy pattern: auth headers added server-side only | Phase 02-02 | 08-03 confirms zero auth headers on browser→backend requests |

---

## Open Questions

1. **Corporate LLM context window size**
   - What we know: `SAFE_CONTEXT_CEILING_TOKENS = 7500` (gpt-4 8k assumption); total estimated 6724/7500 on EDIP config
   - What's unclear: Actual context window of the corporate endpoint (Azure OpenAI model variant)
   - Recommendation: Flag as ops-confirmation item in 08-02 plan. Facilitator must check `console.info('[promptBudget]', budget)` in DevTools during the live run. If `withinLimit: false`, the run is invalid and the ceiling constant needs updating.

2. **Corporate proxy timeout vs LLM generation time**
   - What we know: `LLM_TIMEOUT_SECONDS = 60` backend default; `LLM_FRONTEND_TIMEOUT_MS = 45000` client-side
   - What's unclear: Corporate proxy hard timeout (may be 30s, 60s, 120s)
   - Recommendation: Flag as live-run observation in 08-02. If requests consistently time out at the same wall-clock threshold under 45s, suspect proxy timeout rather than LLM generation time.

3. **OpenAI API key rotation status**
   - What we know: Key appeared in Phase 06-08 smoke test conversation logs; `.env` was scrubbed post-test (Phase 06-08 SUMMARY.md line 118); key rotation was listed as Phase 8 action item
   - What's unclear: Whether the key was actually rotated yet
   - Recommendation: 08-03 plan must include explicit step: "Confirm key was rotated per 06-08 follow-up #7. If not, rotate before running 08-02 live run."

4. **Debrief export fix: `messages.indexOf(msg)` performance**
   - What we know: The simplest fix uses an index-based `for` loop rather than `forEach` to get message index cheaply
   - What's unclear: Whether the current `for...of` loop will be refactored to index-based or if a separate `getIndex` map is preferable
   - Recommendation: Planner should specify index-based `for (let i = 0; i < messages.length; i++)` in the fix. It's a rewrite of 20 lines, not a 1-line patch.

---

## Sources

### Primary (HIGH confidence)
- Direct read of `src/lib/stateUpdater.test.ts` (373 lines, fully read) — naming conventions, coverage gaps
- Direct read of `src/lib/stateUpdater.ts` (143 lines) — CLAMP_RANGES, applyStateUpdatePure
- Direct read of `src/lib/debriefExporter.ts` (301 lines) — bucketing bug location at lines 196-215
- Direct read of `src/lib/debriefExporter.test.ts` (329 lines) — test coverage, missing assertions
- Direct read of `src/lib/gameStore.ts` (665 lines, key sections) — runLLMTurn seam at line 163
- Direct read of `src/lib/gameStore.test.ts` (1165 lines, key sections) — existing parse failure test at line 631
- Direct read of `src/lib/llmClient.test.ts` (253 lines) — confirms llmClient error path coverage
- Direct read of `src/lib/promptBuilder.ts` (277 lines) — confirms routing is in system prompt block 8
- Direct read of `backend/app/config.py` (54 lines) — missing env var fails at `get_settings()`
- Direct read of `backend/app/main.py` (119 lines) — lifespan calls `get_settings()` at startup
- Direct read of `backend/app/routers/llm.py` (full) — `settings = get_settings()` at request time (line 19)
- Direct read of `backend/tests/conftest.py` — `env_base` fixture, `reset_settings_cache` autouse
- Direct read of `backend/tests/test_llm_auth_header.py` (121 lines) — httpx.MockTransport pattern
- Direct read of `backend/.env.example` — no deployment README, no restart command documented
- Credential grep: `grep -r "Authorization" src/` returned zero matches — confirmed clean
- `.gitignore` read — `backend/.env` confirmed gitignored (line 9)

### Secondary (MEDIUM confidence)
- `07-VERIFICATION.md` and `06-08-SUMMARY.md` — Phase 8 follow-ups, key rotation history, live-run format reference

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new tools, all from package.json
- Test naming conventions: HIGH — read directly from test files
- Coverage gap analysis: HIGH — line-by-line comparison of test file vs success criteria
- Error injection seams: HIGH — traced through gameStore.ts → callLLMProxy → parsePersonaResponse
- Startup behaviour on missing env: HIGH — confirmed lifespan calls get_settings() line 72
- Debrief fix location: HIGH — confirmed bug mechanism, line numbers for fix
- Multi-trigger routing: HIGH — confirmed no TypeScript router; routing is in system prompt block 8
- HAR/credential audit format: MEDIUM — internal audit, no official standard required

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (stable codebase; no external dependency changes)
