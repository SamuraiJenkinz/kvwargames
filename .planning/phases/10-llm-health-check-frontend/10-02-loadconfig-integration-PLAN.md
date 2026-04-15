---
phase: 10-llm-health-check-frontend
plan: 02
type: execute
wave: 2
depends_on: ["10-01"]
files_modified:
  - src/components/setup/LoadConfigPanel.tsx
  - src/components/setup/LoadConfigPanel.test.tsx
autonomous: true

must_haves:
  truths:
    - "LoadConfigPanel imports and renders HealthBadge immediately above the Launch Scenario buttons block (before the `<div className=\"mt-4 flex flex-wrap gap-3\">` at line 197)"
    - "LoadConfigPanel owns a healthStatus useState<HealthStatus>('checking') and passes its setter to HealthBadge's onStatusChange prop"
    - "The launchDisabled derivation at line 96 is extended to include healthStatus !== 'ok' — Launch is disabled when JSON is invalid OR validation fails OR health is checking OR health is failed"
    - "When healthStatus is 'ok', Launch Scenario buttons become clickable (assuming JSON and validation also pass) and the facilitator can start a session"
    - "When healthStatus is 'checking' or 'failed', all Launch Scenario buttons are disabled via the existing disabled/aria-disabled attributes — no override mechanism exists, no 'launch anyway' escape hatch, no hidden buttons"
    - "The health badge is rendered exactly once per LoadConfigPanel mount — auto-check fires on mount, not on configJson edits, not on validation state changes"
    - "Existing LoadConfigPanel tests continue to pass — the health-disabled path does NOT break JSON-parse-error, validation-error, or happy-path launch tests (tests must mock fetch to return ok response so Launch becomes enabled when JSON is valid)"
    - "New integration tests verify: (a) Launch is disabled while healthStatus==='checking' even with valid JSON, (b) Launch is disabled when healthStatus==='failed' even with valid JSON, (c) Launch becomes enabled when healthStatus==='ok' AND JSON parses AND validation passes, (d) Launch remains disabled when healthStatus==='ok' but JSON is invalid"
  artifacts:
    - path: "src/components/setup/LoadConfigPanel.tsx"
      provides: "LoadConfigPanel with HealthBadge integrated above Launch buttons and launchDisabled extended to gate on health status"
      contains: "HealthBadge"
      min_lines: 230
    - path: "src/components/setup/LoadConfigPanel.test.tsx"
      provides: "Existing tests updated to mock /api/health/llm (returning ok response for happy paths) plus new cases covering the health-gate extension to launchDisabled"
      contains: "healthStatus"
      min_lines: 100
  key_links:
    - from: "src/components/setup/LoadConfigPanel.tsx"
      to: "src/components/setup/HealthBadge.tsx"
      via: "import HealthBadge from './HealthBadge'"
      pattern: "from ['\"]\\./HealthBadge"
    - from: "src/components/setup/LoadConfigPanel.tsx"
      to: "src/types/health.ts"
      via: "import type { HealthStatus } from '@/types/health'"
      pattern: "from ['\"]@/types/health"
    - from: "src/components/setup/LoadConfigPanel.tsx"
      to: "launchDisabled gate"
      via: "healthStatus !== 'ok' ORed into the existing derivation"
      pattern: "healthStatus !== ['\"]ok"
---

<objective>
Integrate the `HealthBadge` component (shipped in 10-01) into `LoadConfigPanel.tsx` so the setup screen shows a live LLM status indicator directly above the Launch Scenario buttons, and extend the existing `launchDisabled` gate to block Launch while health is `checking` or `failed`. Update the existing `LoadConfigPanel.test.tsx` to mock `/api/health/llm` (so existing tests remain green) and add targeted tests proving the new gate works.

Purpose: This is the phase goal — the green/red dot that prevents broken-pipeline live runs. 10-01 built the component in isolation; this plan makes it visible and load-bearing in the real setup flow.

Output: Two edits — one component file, one test file. No new files.
</objective>

<execution_context>
@C:\Users\taylo\.claude\get-shit-done\workflows\execute-plan.md
@C:\Users\taylo\.claude\get-shit-done\templates\summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/10-llm-health-check-frontend/10-CONTEXT.md
@.planning/phases/10-llm-health-check-frontend/10-RESEARCH.md
@.planning/phases/10-llm-health-check-frontend/10-01-health-badge-component-PLAN.md

# Edit target — Launch buttons at lines 196-223, launchDisabled at line 96:
@src/components/setup/LoadConfigPanel.tsx

# Existing test file to update — seed healthStatus mocks, add new gate cases:
@src/components/setup/LoadConfigPanel.test.tsx

# Component imported by this plan — do NOT modify, shipped by 10-01:
@src/components/setup/HealthBadge.tsx
@src/types/health.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Wire HealthBadge into LoadConfigPanel and extend launchDisabled gate</name>
  <files>src/components/setup/LoadConfigPanel.tsx</files>
  <action>
Edit `src/components/setup/LoadConfigPanel.tsx` to import `HealthBadge`, own `healthStatus` state, render the badge above the Launch buttons, and extend `launchDisabled` to gate on health.

**Edit 1 — Imports (top of file, after existing imports from line 8):**

Add these two lines after the `ScenarioSummary` import:
```typescript
import HealthBadge from './HealthBadge'
import type { HealthStatus } from '@/types/health'
```

**Edit 2 — Add healthStatus local state (inside the component body, alongside the existing useState hooks around line 33-44):**

After the `validationErrors` useState declaration (ends line 44), add:
```typescript
// Health check gates Launch. Seed 'checking' so Launch is disabled on initial mount
// before the first /api/health/llm response lands. HealthBadge (rendered below) fires
// the fetch on its own mount and calls setHealthStatus via its onStatusChange prop.
const [healthStatus, setHealthStatus] = useState<HealthStatus>('checking')
```

**Edit 3 — Extend `launchDisabled` at line 96:**

Current:
```typescript
const launchDisabled = !parseResult.ok || validationErrors.length > 0
```

Change to:
```typescript
// Launch is disabled when JSON parse fails, when schema validation has errors,
// OR when the LLM health check is still running / has failed. Locked decision
// (CONTEXT.md): no "launch anyway" override — the whole point of Phase 10 is
// preventing broken-pipeline live runs.
const launchDisabled =
  !parseResult.ok || validationErrors.length > 0 || healthStatus !== 'ok'
```

**Edit 4 — Render HealthBadge above the Launch buttons block (line 194-196 is where the comment + `<div className="mt-4 flex flex-wrap gap-3">` opens):**

Immediately BEFORE the existing comment `{/* Launch buttons — always rendered once scenarioCount is known; ... */}` and the `{scenarioCount !== null && (` block, insert:

```tsx
{/* LLM health indicator — auto-checks on mount, gates Launch.
    Sits directly above Launch buttons so the status + hint are
    the explanation for a disabled button (no tooltip duplication). */}
<HealthBadge onStatusChange={setHealthStatus} />
```

The badge must render regardless of `scenarioCount` — it is an always-visible row on the review/launch step. Do NOT nest it inside the `{scenarioCount !== null && (...)}` conditional, or it will disappear when the user's JSON is invalid at mount (and the facilitator won't see a health signal until they fix JSON).

**Edit 5 — Update the title attribute on Launch buttons (line 210) to reflect the new gate reason:**

Current:
```tsx
title={launchDisabled ? 'Fix JSON errors to launch' : undefined}
```

Change to:
```tsx
title={
  launchDisabled
    ? healthStatus !== 'ok'
      ? 'LLM health check must pass before launching'
      : 'Fix JSON errors to launch'
    : undefined
}
```

This title is a secondary affordance — the primary explanation is the badge text itself. CONTEXT.md explicitly rejects a "separate tooltip on the disabled button" duplicating the hint, but the existing title attribute was already there for JSON errors; we keep parity by giving it a generic health message when health is the blocker.

**Do NOT:**
- Put health state in `gameStore.ts` — CONTEXT.md: transient concern, local state is correct. `gameStore` is out of scope.
- Render the badge inside the `{scenarioCount !== null && (...)}` conditional — it must be unconditional.
- Remove or change any other JSX — only the 4 edits above.
- Add a "launch anyway" override button — explicitly rejected in CONTEXT.md.
- Add a second tooltip, toast, or error card near the button — the badge is the single explanation.
- Wire `healthStatus` into `gameStore.ts`, `SetupScreen.tsx`, or any other file.
- Add a periodic re-check / polling loop.
- Re-fire the health check when `configJson` changes.

**Invariants preserved from existing code:**
- "disabled-not-hidden" invariant from plan 04-04 — Launch buttons stay rendered, they just become disabled. Do NOT change this.
- 300ms debounced parse — untouched.
- Back button behavior — untouched.
- JsonEditor + ScenarioSummary layout — untouched.
  </action>
  <verify>
1. `npx tsc --noEmit` returns no errors
2. `grep -n "import HealthBadge" src/components/setup/LoadConfigPanel.tsx` returns a match
3. `grep -n "from '@/types/health'" src/components/setup/LoadConfigPanel.tsx` returns a match
4. `grep -n "useState<HealthStatus>('checking')" src/components/setup/LoadConfigPanel.tsx` returns a match
5. `grep -n "healthStatus !== 'ok'" src/components/setup/LoadConfigPanel.tsx` returns at least one match (in launchDisabled derivation)
6. `grep -n "<HealthBadge onStatusChange={setHealthStatus}" src/components/setup/LoadConfigPanel.tsx` returns a match
7. The `<HealthBadge ... />` line number is LESS than the line number of `{scenarioCount !== null &&` (badge must be outside the scenarioCount conditional)
8. `npm run build` completes without errors
9. `grep -c "launchDisabled" src/components/setup/LoadConfigPanel.tsx` shows unchanged count of references (still used for disabled+aria-disabled+title+className) — only the derivation changed
  </verify>
  <done>
`LoadConfigPanel.tsx` imports HealthBadge, owns `healthStatus` useState, renders the badge above the Launch buttons block (unconditionally), and extends `launchDisabled` with `healthStatus !== 'ok'`. `npm run build` and `npx tsc --noEmit` both clean.
  </done>
</task>

<task type="auto">
  <name>Task 2: Update LoadConfigPanel.test.tsx to mock /api/health/llm and add health-gate coverage</name>
  <files>src/components/setup/LoadConfigPanel.test.tsx</files>
  <action>
The existing tests in `LoadConfigPanel.test.tsx` will break because HealthBadge fires a real `fetch('/api/health/llm')` on mount. Since existing tests don't stub fetch, the badge will enter the `failed` branch on its catch handler, setting `healthStatus='failed'`, which keeps `launchDisabled=true` even when JSON is valid — breaking any test that asserts Launch is clickable.

**Two workstreams in this task:**

### A. Fix existing tests (make them green again)

At the top of the test file, add a fetch stub in `beforeEach` that returns a healthy response by default, mirroring the pattern from `GenerateBriefPanel.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
// ... existing imports

beforeEach(() => {
  // Default: health check returns ok so existing Launch-enabled assertions hold.
  // Individual health-gate tests below override with mockResolvedValueOnce.
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ ok: true, latencyMs: 100 }), { status: 200 })
  )
  vi.stubGlobal('fetch', fetchMock)
  // ... whatever existing beforeEach did (store reset etc.) — preserve it
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  // ... whatever existing afterEach did — preserve it
})
```

**Critical:** If the existing file already has `beforeEach`/`afterEach`, MERGE the fetch stub into them (don't double-declare). Use `vi.mocked(fetch).mockResolvedValueOnce(...)` inside individual tests to override.

Existing tests that assert Launch is clickable need to `await waitFor(() => expect(button).not.toBeDisabled())` because health state transitions async. If any existing test uses `fireEvent.click(launchButton)` immediately after mounting, wrap in `await waitFor` first so the health mock has resolved.

### B. Add four new health-gate tests

Add a new `describe('health gate on launchDisabled', ...)` block with these tests:

1. **Launch is disabled while health check is in-flight (checking state)**
   - Stub fetch with a promise that never resolves: `vi.mocked(fetch).mockImplementation(() => new Promise(() => {}))`
   - Render with a valid config that normally produces an enabled Launch
   - Assert `screen.getByRole('button', { name: /Launch Scenario 1/ })` is disabled

2. **Launch is disabled when health check fails, even with valid JSON**
   - Stub fetch: `vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ ok: false, code: 'auth_error', status: 401, hint: 'Authentication failed — check LLM_API_KEY in .env', latencyMs: 120 }), { status: 200 }))`
   - Render with valid config
   - `await waitFor(() => expect(screen.getByText(/401 — Authentication/)).toBeInTheDocument())`
   - Assert Launch button is disabled

3. **Launch becomes enabled when health is ok AND JSON parses AND validation passes**
   - Use default `beforeEach` healthy mock
   - Render with valid config
   - `await waitFor(() => expect(screen.getByText(/Connected — 100ms/)).toBeInTheDocument())`
   - Assert Launch button is NOT disabled

4. **Launch stays disabled when health is ok but JSON is invalid**
   - Use default healthy mock
   - Render with invalid JSON that fails `parseConfigJson`
   - `await waitFor(() => expect(screen.getByText(/Connected — 100ms/)).toBeInTheDocument())` — health badge shows green
   - Assert Launch button is disabled (JSON parse error still blocks)
   - This test proves the gate is a conjunction — health-ok alone is not sufficient

**Notes for executor:**
- The existing test file uses `vi.mock('zustand')` for store stubbing — preserve that setup verbatim.
- `LoadConfigPanel` uses a 300ms debounced parse (line 63-75). For tests that change `configJson`, continue using `vi.useFakeTimers()` + `act(() => vi.advanceTimersByTime(300))` if the existing file does so. Don't re-introduce a debounce race in new tests — the 4 new tests use the seeded default configJson, so the initial synchronous parse (line 33-35) is enough.
- Prefer `screen.getByRole('button', { name: /Launch Scenario/ })` over `getByText` for Launch buttons — aria-disabled is more reliably asserted via role matchers.
- If the existing file already imports `waitFor`, reuse that import; otherwise add it from `@testing-library/react`.

**Do NOT:**
- Delete or rewrite existing tests unless they are genuinely broken by the new behavior — the goal is ADDITIVE coverage.
- Introduce new test utilities or helpers — keep mocks inline.
- Mock `HealthBadge` itself — the integration tests should exercise the real component so the fetch-mock path is validated end to end.
  </action>
  <verify>
1. `npm test -- LoadConfigPanel` runs and passes ALL tests (existing + 4 new)
2. `grep -n "vi.stubGlobal('fetch'" src/components/setup/LoadConfigPanel.test.tsx` returns a match
3. `grep -c "it(" src/components/setup/LoadConfigPanel.test.tsx` shows an increase of ≥4 from the baseline (compare to `git diff --stat` or the pre-edit line count)
4. `grep -n "health gate on launchDisabled\|healthStatus" src/components/setup/LoadConfigPanel.test.tsx` returns a match
5. `grep -n "Connected — 100ms" src/components/setup/LoadConfigPanel.test.tsx` returns a match (healthy-state assertion)
6. `grep -n "401 — Authentication\|ok: false" src/components/setup/LoadConfigPanel.test.tsx` returns a match (failure-state assertion)
7. `npm run build` clean
  </verify>
  <done>
`LoadConfigPanel.test.tsx` passes all existing tests (with the fetch stub keeping health healthy by default) plus 4 new tests covering the health gate. `npm test -- LoadConfigPanel` is green.
  </done>
</task>

</tasks>

<verification>
**Full suite:**
- `npm test` runs the entire vitest suite green — no regressions in `HealthBadge.test.tsx` (from 10-01), `LoadConfigPanel.test.tsx` (updated here), or any other test file.
- `npm run build` completes with no TypeScript errors.

**Manual smoke (facilitator acceptance):**
1. Start backend: `uvicorn backend.app.main:app --reload` with valid `.env` (real LLM_API_KEY).
2. Start frontend: `npm run dev`.
3. Open `http://localhost:5173`, navigate to the Load Config / Review step (whichever route renders `LoadConfigPanel`).
4. Observe: badge briefly shows "Checking LLM connection…" with spinner, then "Connected — {latency}" in green. Launch Scenario 1 button becomes enabled.
5. Click Re-check → badge flashes checking, then green again. Button stays enabled after resolution.
6. Stop the backend process. Click Re-check → badge shows red "Backend unreachable — is the API server running?". Launch button is disabled.
7. Restart backend with a bad `LLM_API_KEY`. Click Re-check → badge shows red "401 — Authentication failed — check LLM_API_KEY in .env". Launch button is disabled.
8. Fix `.env`, restart, Re-check → green, button enabled.

**Requirement trace (complete phase):**
- HEALTH-07 (status indicator shown on setup screen): 10-01 Task 2 + 10-02 Task 1 Edit 4 (badge rendered in LoadConfigPanel)
- HEALTH-08 (auto-check on mount): 10-01 Task 2 useEffect with empty deps — fires when LoadConfigPanel mounts the badge
- HEALTH-09 (Re-check button): 10-01 Task 2 button + runCheck handler
- HEALTH-10 (failure shows backend hint verbatim): 10-01 Task 2 `${displayCode} — ${data.hint}` line
- HEALTH-11 (Launch disabled on checking/failed): **10-02 Task 1 Edit 3** — `launchDisabled || healthStatus !== 'ok'`
- HEALTH-12 (success shows latency): 10-01 Task 2 formatLatency helper

**Phase 10 success criteria (from roadmap):**
1. "Opening setup screen auto-triggers check, facilitator sees spinner → dot" — ✅ auto-check on mount (10-01 useEffect)
2. "Pass → green + latency (Connected — 820ms)" — ✅ formatLatency + green dot (10-01 JSX)
3. "Fail → red + status+hint" — ✅ `{displayCode} — {hint}` (10-01 failed branch)
4. "Re-check button retries without page refresh" — ✅ runCheck reused for manual trigger (10-01)
5. "Launch disabled while failed/checking, cannot start broken session" — ✅ **this plan, Task 1 Edit 3**

**Pitfalls acknowledged:**
- StrictMode double-mount (RESEARCH.md Pitfall 1) — handled in 10-01 via AbortController cleanup; no additional handling needed in this plan.
- Vite 502 HTML (Pitfall 2) — handled in 10-01 via `if (!res.ok)` guard; this plan's integration tests verify the end-to-end path works.
- `launchDisabled` stale re-render (Pitfall 3) — non-issue per RESEARCH.md; React re-renders on any state change and derives `launchDisabled` fresh each render.
- Backend `status: null` (Pitfall 4) — handled in 10-01; Task 2 Test 4 in 10-01 asserts `timeout — ...` not `null — ...`.
- Re-check during in-flight (Pitfall 5) — handled in 10-01 via `disabled={state.status === 'checking'}` + `abortRef.current?.abort()`.

**Code hygiene:**
- No new packages.
- Exactly 2 files modified in this plan, plus 3 files created in 10-01. No changes to `SetupScreen.tsx`, `gameStore.ts`, `backend/`, routing, or any other file.
- No new design tokens; `--color-crisis-none` and `--color-category-crisis` are Phase 3 artifacts.
</verification>

<success_criteria>
- `LoadConfigPanel.tsx` imports and renders `HealthBadge` unconditionally above the Launch buttons block.
- `launchDisabled` derivation includes `healthStatus !== 'ok'`.
- `LoadConfigPanel.test.tsx` passes ALL tests (existing + 4 new health-gate tests) with fetch mocked.
- `npm test` green across the whole suite, `npm run build` clean.
- Manual smoke: backend-up-valid-key → green + clickable Launch; backend-up-bad-key → red + disabled; backend-down → "Backend unreachable" + disabled.
</success_criteria>

<output>
After completion, create `.planning/phases/10-llm-health-check-frontend/10-02-SUMMARY.md` with:
- Exact line numbers in `LoadConfigPanel.tsx` where the 4 edits landed (post-edit line numbers)
- Whether existing LoadConfigPanel tests needed `waitFor` wrappers added to keep them green (which ones, and the reason)
- Number of existing tests vs. new tests in the updated test file (before/after `it(...)` count)
- Result of the manual smoke test (all 4 states observed: checking → ok, ok → re-check, backend-down, bad-key)
- Any deviation from CONTEXT.md's locked decisions (there should be none)
</output>
