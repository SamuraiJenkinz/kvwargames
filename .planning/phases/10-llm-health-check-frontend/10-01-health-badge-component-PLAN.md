---
phase: 10-llm-health-check-frontend
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/types/health.ts
  - src/components/setup/HealthBadge.tsx
  - src/components/setup/HealthBadge.test.tsx
autonomous: true

must_haves:
  truths:
    - "A new component HealthBadge exists at src/components/setup/HealthBadge.tsx that renders three visual states (checking / ok / failed) in a single inline badge"
    - "HealthBadge auto-fires GET /api/health/llm on mount via useEffect and surfaces checking → ok/failed transitions through a parent-owned onStatusChange callback"
    - "When the backend responds {ok:true, latencyMs}, the badge renders a green dot plus 'Connected — {latency}' using the format '820ms' under 1000ms and '1.2s' at/over 1000ms"
    - "When the backend responds {ok:false, code, status, hint, latencyMs}, the badge renders a red dot plus '{status} — {hint}' using the numeric HTTP status when present, falling back to the code string when status is null (timeout/network/tls) — hint text is rendered verbatim from the backend"
    - "When fetch itself rejects (TypeError network failure) OR res.ok is false (Vite proxy 502 HTML), the badge renders a red dot with the frontend-originated message 'Backend unreachable — is the API server running?'"
    - "A manual Re-check control (RefreshCw icon or 'Re-check' text) is always rendered, is disabled while status === 'checking', aborts any in-flight controller, and triggers a fresh fetch"
    - "On unmount the effect cleanup calls controller.abort() so React StrictMode's double-mount in dev does not leave a stale pending promise updating state"
    - "Backend code strings timeout | auth_error | not_found | rate_limited | upstream_error | network_error | tls_error | invalid_response are accepted without frontend mapping — the backend hint is the single source of truth for user-facing copy"
    - "HealthBadge.test.tsx passes vitest with coverage for: (a) ok path renders green dot + formatted latency, (b) failed path with numeric status renders '{status} — {hint}', (c) failed path with null status falls back to code string, (d) Vite 502 (res.ok false) renders 'Backend unreachable' message, (e) network rejection renders 'Backend unreachable' message, (f) Re-check button is disabled during checking and re-triggers fetch when clicked in ok/failed state, (g) onStatusChange callback fires with 'ok' and 'failed' transitions"
  artifacts:
    - path: "src/types/health.ts"
      provides: "TypeScript types for the GET /api/health/llm response contract — LLMHealthOk, LLMHealthFail, LLMHealthResponse, plus HealthStatus union"
      contains: "LLMHealthResponse"
      min_lines: 20
    - path: "src/components/setup/HealthBadge.tsx"
      provides: "Self-contained React component implementing auto-check on mount, three-state rendering, Re-check button, AbortController-based cleanup, parent onStatusChange callback"
      contains: "export default function HealthBadge"
      min_lines: 80
    - path: "src/components/setup/HealthBadge.test.tsx"
      provides: "Vitest + React Testing Library coverage for all three states, both failure modes (backend returns ok:false vs backend unreachable), Re-check behavior, and onStatusChange callback"
      contains: "describe('HealthBadge'"
      min_lines: 120
  key_links:
    - from: "src/components/setup/HealthBadge.tsx"
      to: "/api/health/llm"
      via: "fetch('/api/health/llm', { signal }) — Vite proxy forwards to backend:8000"
      pattern: "fetch\\(['\"]/api/health/llm"
    - from: "src/components/setup/HealthBadge.tsx"
      to: "src/types/health.ts"
      via: "import type { LLMHealthResponse } from '@/types/health'"
      pattern: "from ['\"]@/types/health"
    - from: "src/components/setup/HealthBadge.tsx"
      to: "lucide-react"
      via: "Loader2 for spinner, RefreshCw for Re-check button"
      pattern: "from ['\"]lucide-react"
    - from: "src/components/setup/HealthBadge.test.tsx"
      to: "vi.stubGlobal('fetch', ...)"
      via: "fetch mocking pattern established in GenerateBriefPanel.test.tsx"
      pattern: "vi\\.stubGlobal\\(['\"]fetch"
---

<objective>
Build a self-contained `HealthBadge` React component and its TypeScript response types so the integration plan (10-02) can drop it into `LoadConfigPanel` above the Launch buttons. This plan is the leaf — it owns fetch wiring, state machine, visual rendering, Re-check behavior, and test coverage. It does NOT touch `LoadConfigPanel.tsx` (10-02 does).

Purpose: Phase 10's goal is a visible green/red indicator that gates Launch. The badge component is the unit of encapsulation — all the fetch/abort/format/render logic lives here so 10-02's integration is a ~5-line change.

Output: Three new files. No modifications to existing files.
</objective>

<execution_context>
@C:\Users\taylo\.claude\get-shit-done\workflows\execute-plan.md
@C:\Users\taylo\.claude\get-shit-done\templates\summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/10-llm-health-check-frontend/10-CONTEXT.md
@.planning/phases/10-llm-health-check-frontend/10-RESEARCH.md

# Pattern source — fetch + AbortController + error handling. Mirror this skeleton:
@src/components/setup/GenerateBriefPanel.tsx

# Pattern source — vitest fetch stubbing + Response mocking. Mirror this test setup:
@src/components/setup/GenerateBriefPanel.test.tsx

# Pattern source — RefreshCw icon import style:
@src/components/game/ChatFeed/ErrorMessage.tsx

# Design tokens for dot colors (--color-crisis-none green, --color-category-crisis red):
@src/styles/index.css

# Backend contract authority — read response shape from here, types/health.ts must match:
@backend/app/routers/health.py
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create src/types/health.ts with LLMHealthResponse discriminated union</name>
  <files>src/types/health.ts</files>
  <action>
Create a new file defining the frontend-side TypeScript types that mirror the `GET /api/health/llm` response contract shipped by Phase 9. The backend is the authority (see `backend/app/routers/health.py` response shape); this file is the frontend's typed projection.

**Exact content:**

```typescript
// Frontend-side types for GET /api/health/llm
// Backend authority: backend/app/routers/health.py (Phase 9)
// The endpoint always returns HTTP 200; ok flag carries the signal.

export type HealthStatus = 'checking' | 'ok' | 'failed'

export type LLMHealthErrorCode =
  | 'timeout'
  | 'auth_error'
  | 'not_found'
  | 'rate_limited'
  | 'upstream_error'
  | 'network_error'
  | 'tls_error'
  | 'invalid_response'

export interface LLMHealthOk {
  ok: true
  latencyMs: number
}

export interface LLMHealthFail {
  ok: false
  code: LLMHealthErrorCode
  status: number | null // HTTP upstream status, null for timeout/network/tls
  hint: string
  latencyMs: number
}

export type LLMHealthResponse = LLMHealthOk | LLMHealthFail
```

**Do NOT:**
- Add runtime validators (zod/valibot) — this is a typed projection, not a parser. The backend contract is stable.
- Export any helper functions — only types belong here.
- Import anything — no runtime deps.
  </action>
  <verify>
1. File exists: `ls src/types/health.ts`
2. `npx tsc --noEmit` returns no errors referencing health.ts
3. `grep -n "LLMHealthResponse" src/types/health.ts` returns a match
4. `grep -n "number | null" src/types/health.ts` returns a match (status nullability from Pitfall 4)
5. All 8 error code strings from backend appear: `grep -cE "'(timeout|auth_error|not_found|rate_limited|upstream_error|network_error|tls_error|invalid_response)'" src/types/health.ts` returns 8
  </verify>
  <done>
`src/types/health.ts` exists, type-checks cleanly, and exports `HealthStatus`, `LLMHealthErrorCode`, `LLMHealthOk`, `LLMHealthFail`, `LLMHealthResponse`.
  </done>
</task>

<task type="auto">
  <name>Task 2: Create src/components/setup/HealthBadge.tsx</name>
  <files>src/components/setup/HealthBadge.tsx</files>
  <action>
Create the `HealthBadge` component — a self-contained inline badge that auto-checks on mount, renders three states, and exposes an `onStatusChange` callback so the parent (LoadConfigPanel, wired in 10-02) can gate Launch.

**Imports:**
```typescript
import { useEffect, useRef, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import type { HealthStatus, LLMHealthResponse } from '@/types/health'
```

**Props contract:**
```typescript
interface HealthBadgeProps {
  onStatusChange: (status: HealthStatus) => void
}
```

Parent owns `healthStatus` in its own `useState` (seeded with `'checking'`) and passes its setter as `onStatusChange`. `HealthBadge` also holds its own internal state for the rendered text, but publishes status transitions upward on every resolved fetch.

**Internal state:**
```typescript
const [state, setState] = useState<{ status: HealthStatus; text: string }>({
  status: 'checking',
  text: 'Checking LLM connection…',
})
const abortRef = useRef<AbortController | null>(null)
```

**Latency formatter (module-scope helper):**
```typescript
function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}
```
Decision locked in CONTEXT.md: under 1s → `820ms`, at/over 1s → `1.2s`.

**runCheck function (defined inside component):**
```typescript
function runCheck() {
  abortRef.current?.abort()
  const controller = new AbortController()
  abortRef.current = controller
  setState({ status: 'checking', text: 'Checking LLM connection…' })
  onStatusChange('checking')

  fetch('/api/health/llm', { signal: controller.signal })
    .then(async (res) => {
      if (!res.ok) {
        // Vite proxy 502 with HTML body when backend is down (RESEARCH.md Pitfall 2).
        // Do NOT call res.json() here — body is HTML and will SyntaxError.
        return { status: 'failed' as const, text: 'Backend unreachable — is the API server running?' }
      }
      const data = (await res.json()) as LLMHealthResponse
      if (data.ok) {
        return { status: 'ok' as const, text: `Connected — ${formatLatency(data.latencyMs)}` }
      }
      // RESEARCH.md Pitfall 4: data.status may be null for timeout/network/tls — fall back to code string.
      const displayCode = data.status != null ? String(data.status) : data.code
      return { status: 'failed' as const, text: `${displayCode} — ${data.hint}` }
    })
    .then((result) => {
      setState(result)
      onStatusChange(result.status)
    })
    .catch((err) => {
      if (err instanceof DOMException && err.name === 'AbortError') return
      // TypeError: Failed to fetch = backend unreachable at network layer.
      setState({ status: 'failed', text: 'Backend unreachable — is the API server running?' })
      onStatusChange('failed')
    })
}
```

**Auto-check on mount (useEffect with cleanup for StrictMode — RESEARCH.md Pitfall 1):**
```typescript
useEffect(() => {
  runCheck()
  return () => {
    abortRef.current?.abort()
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [])
```
Empty deps is intentional and locked by CONTEXT.md ("No re-check on config edits"). The ESLint disable is load-bearing — adding `runCheck` or `onStatusChange` to deps would re-fire on every parent render.

**JSX layout** — single inline row above Launch buttons. Mirror the error-banner styling from LoadConfigPanel (rounded-md border bg-*/10 p-3), use Phase 3 tokens `--color-crisis-none` (green) and `--color-category-crisis` (red), use `text-text-secondary` for neutral:

```tsx
return (
  <div
    role="status"
    aria-live="polite"
    className="mb-3 flex items-center gap-3 rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)]/40 p-3"
  >
    {state.status === 'checking' && (
      <Loader2
        className="h-4 w-4 animate-spin text-[var(--color-text-secondary)]"
        aria-hidden="true"
      />
    )}
    {state.status === 'ok' && (
      <span
        className="h-2.5 w-2.5 rounded-full bg-[var(--color-crisis-none)]"
        aria-hidden="true"
      />
    )}
    {state.status === 'failed' && (
      <span
        className="h-2.5 w-2.5 rounded-full bg-[var(--color-category-crisis)]"
        aria-hidden="true"
      />
    )}
    <span
      className={
        state.status === 'failed'
          ? 'flex-1 text-sm text-[var(--color-category-crisis)]'
          : 'flex-1 text-sm text-[var(--color-text-primary)]'
      }
    >
      {state.text}
    </span>
    <button
      type="button"
      onClick={runCheck}
      disabled={state.status === 'checking'}
      aria-label="Re-check LLM connection"
      className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border-subtle)] px-2 py-1 text-xs text-[var(--color-text-secondary)] transition hover:text-[var(--color-text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
      Re-check
    </button>
  </div>
)
```

**Export:** `export default function HealthBadge({ onStatusChange }: HealthBadgeProps) { ... }`

**Do NOT:**
- Put health state in gameStore (CONTEXT.md: transient setup-screen concern).
- Map backend `code` → custom hint strings (CONTEXT.md: backend hint is authoritative).
- Add a tooltip, expandable "Details", copy-to-clipboard, link-to-docs, or "launch anyway" override (CONTEXT.md: all explicitly rejected for v1.1).
- Add auto-retry on failure, polling, or re-check on configJson change (CONTEXT.md: one-shot on mount + manual only).
- Change the Re-check button label to something state-dependent ("Launch Scenario" stays unchanged during checking per CONTEXT.md — the badge carries the explanation).
  </action>
  <verify>
1. File exists and compiles: `npx tsc --noEmit` returns no errors for HealthBadge.tsx
2. `grep -n "fetch('/api/health/llm'" src/components/setup/HealthBadge.tsx` returns a match
3. `grep -n "AbortController" src/components/setup/HealthBadge.tsx` returns a match
4. `grep -n "formatLatency" src/components/setup/HealthBadge.tsx` returns matches (helper + call site)
5. `grep -n "Backend unreachable" src/components/setup/HealthBadge.tsx` returns TWO matches (res.ok false branch + catch branch)
6. `grep -n "onStatusChange" src/components/setup/HealthBadge.tsx` returns at least 4 matches (prop, checking, ok, failed transitions)
7. `grep -n "disabled={state.status === 'checking'}" src/components/setup/HealthBadge.tsx` returns a match (Re-check guard)
8. `grep -n "data.status != null" src/components/setup/HealthBadge.tsx` returns a match (Pitfall 4 null guard)
9. `grep -n "--color-crisis-none" src/components/setup/HealthBadge.tsx` returns a match (green dot)
10. `grep -n "--color-category-crisis" src/components/setup/HealthBadge.tsx` returns a match (red dot)
11. `grep -n "role=\"status\"" src/components/setup/HealthBadge.tsx` returns a match (a11y)
12. `npm run build` completes without TS errors
  </verify>
  <done>
`src/components/setup/HealthBadge.tsx` exists, compiles, renders three states, auto-checks on mount with AbortController cleanup, exposes `onStatusChange` callback, handles backend-returns-ok, backend-returns-failed (with null-status fallback), Vite-502-HTML, and fetch-rejection (TypeError) cases. Re-check button is disabled during `checking` and aborts any in-flight controller before firing a new request.
  </done>
</task>

<task type="auto">
  <name>Task 3: Create src/components/setup/HealthBadge.test.tsx</name>
  <files>src/components/setup/HealthBadge.test.tsx</files>
  <action>
Create a Vitest + React Testing Library test suite covering every state transition, both failure modes, and Re-check behavior. Use the `vi.stubGlobal('fetch', vi.fn())` pattern established in `GenerateBriefPanel.test.tsx`.

**Skeleton:**
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import HealthBadge from './HealthBadge'

describe('HealthBadge', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  // ... tests below
})
```

**Required test cases (at least one `it(...)` per case — 7 total minimum):**

1. **ok path renders green dot + formatted latency**
   - Mock fetch → `new Response(JSON.stringify({ ok: true, latencyMs: 820 }), { status: 200 })`
   - Render `<HealthBadge onStatusChange={vi.fn()} />`
   - `await waitFor(() => expect(screen.getByText(/Connected — 820ms/)).toBeInTheDocument())`

2. **ok path formats sub-second and multi-second latency correctly**
   - Mock fetch → latencyMs 1234 → assert `Connected — 1.2s`

3. **failed path with numeric status renders `{status} — {hint}`**
   - Mock fetch → `new Response(JSON.stringify({ ok: false, code: 'auth_error', status: 401, hint: 'Authentication failed — check LLM_API_KEY in .env', latencyMs: 120 }), { status: 200 })`
   - Assert `screen.getByText(/401 — Authentication failed/)` is present

4. **failed path with null status falls back to code string**
   - Mock fetch → `new Response(JSON.stringify({ ok: false, code: 'timeout', status: null, hint: 'LLM did not respond within 15 seconds — check network or provider latency', latencyMs: 15000 }), { status: 200 })`
   - Assert `screen.getByText(/timeout — LLM did not respond/)` is present (NOT `null — ...`)

5. **Vite 502 (res.ok false) renders "Backend unreachable" message**
   - Mock fetch → `new Response('<html>502 Bad Gateway</html>', { status: 502 })`
   - Assert `screen.getByText(/Backend unreachable — is the API server running/)` is present
   - Critical: test verifies res.json() is NOT called on the 502 body (no SyntaxError — RESEARCH.md Pitfall 2)

6. **Network rejection (fetch throws TypeError) renders "Backend unreachable"**
   - Mock fetch → `vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'))`
   - Assert `screen.getByText(/Backend unreachable — is the API server running/)` is present

7. **Re-check button is disabled during checking and re-triggers fetch when clicked from failed state**
   - First fetch mock: failed response (auth_error)
   - After it resolves, assert Re-check button is enabled
   - Second fetch mock: ok response
   - Click Re-check via `userEvent.click(screen.getByRole('button', { name: /Re-check LLM connection/i }))`
   - Assert fetch was called twice and final text contains `Connected —`

8. **onStatusChange callback is invoked with 'ok' on success and 'failed' on failure**
   - Render with `const onStatusChange = vi.fn()`
   - Success mock → `await waitFor(() => expect(onStatusChange).toHaveBeenCalledWith('ok'))`
   - Also assert it was called with `'checking'` at least once

**Notes for the executor:**

- Suppress the StrictMode double-mount effect noise: render directly without `<StrictMode>` wrapper — RTL's default render does NOT wrap in StrictMode, so tests see a single mount.
- Use `mockResolvedValueOnce` per test (not `mockResolvedValue`) so mocks reset predictably between assertions.
- `await waitFor(...)` for async state transitions; don't use arbitrary `await new Promise(r => setTimeout(r, 0))` hacks.
- Prefer `screen.getByText(new RegExp(...))` over exact string matches so minor wording tweaks don't break tests.
- Do NOT test implementation details (AbortController, useRef) — test observable behavior (rendered text, fetch call count, callback invocations).

**Do NOT:**
- Test against a real backend — this is a unit test suite, fetch is always mocked.
- Add tests for config-edit-should-not-retrigger behavior — there's no props-change path (badge is mounted once inside LoadConfigPanel; 10-02 will verify this at integration level).
- Add snapshot tests — text assertions are clearer and less fragile.
  </action>
  <verify>
1. `npm test -- HealthBadge` runs and passes 7+ test cases
2. `grep -c "it(" src/components/setup/HealthBadge.test.tsx` returns 7 or more
3. `grep -n "vi.stubGlobal('fetch'" src/components/setup/HealthBadge.test.tsx` returns a match
4. `grep -n "Backend unreachable" src/components/setup/HealthBadge.test.tsx` returns at least 2 matches (502 test + network-error test)
5. `grep -n "status: null" src/components/setup/HealthBadge.test.tsx` returns a match (Pitfall 4 coverage)
6. `grep -n "Connected — 820ms\|Connected — 1.2s" src/components/setup/HealthBadge.test.tsx` — matches at least one (latency formatting)
7. `grep -n "Re-check" src/components/setup/HealthBadge.test.tsx` returns at least one match (button interaction)
  </verify>
  <done>
`src/components/setup/HealthBadge.test.tsx` exists, `npm test -- HealthBadge` passes all 7+ tests covering: ok formatting, failed-with-numeric-status, failed-with-null-status (code fallback), Vite-502 (backend unreachable), network-reject (backend unreachable), Re-check re-trigger from failed→ok, and onStatusChange callback emissions.
  </done>
</task>

</tasks>

<verification>
**Component behavior (run locally):**
- `npm test -- HealthBadge` passes all tests with no warnings about act() or unhandled promise rejections.
- `npm run build` completes with no TypeScript errors.
- Manual: `npm run dev`, open a test harness page or temporarily mount `<HealthBadge onStatusChange={() => {}} />` in `App.tsx` — badge shows "Checking…" briefly then transitions to green/red based on real backend state. Revert the harness edit before commit.

**Requirement trace:**
- HEALTH-07 (status indicator with 3 visual states): Task 2 JSX (Loader2 spinner / green dot / red dot)
- HEALTH-08 (auto-check on mount): Task 2 useEffect with empty deps
- HEALTH-09 (Re-check button): Task 2 button element + runCheck handler
- HEALTH-10 (failure shows backend hint verbatim): Task 2 `${displayCode} — ${data.hint}` line
- HEALTH-12 (latency shown on success): Task 2 formatLatency helper + "Connected — {latency}" template

HEALTH-11 (Launch button gated) is covered by plan 10-02, which imports this component and wires its `onStatusChange` to extend `launchDisabled`.

**Pitfall coverage (from RESEARCH.md):**
- Pitfall 1 (StrictMode double-mount): AbortController cleanup in useEffect return — Task 2
- Pitfall 2 (Vite 502 HTML): `if (!res.ok) return { ... }` before `res.json()` — Task 2, tested in Task 3 case 5
- Pitfall 4 (status: null): `data.status != null ? String(data.status) : data.code` — Task 2, tested in Task 3 case 4
- Pitfall 5 (Re-check during in-flight): `disabled={state.status === 'checking'}` + `abortRef.current?.abort()` — Task 2, tested in Task 3 case 7

**Code hygiene:**
- No new packages installed (package.json unchanged).
- No changes to `LoadConfigPanel.tsx`, `SetupScreen.tsx`, `gameStore.ts`, `backend/`, or any other existing file.
- No new design tokens introduced — reuses Phase 3's `--color-crisis-none` and `--color-category-crisis`.
</verification>

<success_criteria>
- `src/types/health.ts` exports `HealthStatus`, `LLMHealthErrorCode`, `LLMHealthOk`, `LLMHealthFail`, `LLMHealthResponse` matching backend contract.
- `src/components/setup/HealthBadge.tsx` (~100 lines) renders 3 states, auto-checks on mount, handles both failure modes (backend returns ok:false AND backend unreachable), exposes onStatusChange callback, Re-check aborts+re-fires.
- `src/components/setup/HealthBadge.test.tsx` passes 7+ test cases covering ok formatting, both failure-body shapes, both unreachable shapes, Re-check interaction, and callback emissions.
- `npm test -- HealthBadge` green, `npm run build` clean, no files outside `files_modified` touched.
</success_criteria>

<output>
After completion, create `.planning/phases/10-llm-health-check-frontend/10-01-SUMMARY.md` with:
- Exact line count of each new file
- Whether `Loader2` from lucide-react imported cleanly (RESEARCH.md Open Question 2 flagged a risk with lucide-react@^1.8.0). If it failed, document the fallback (CSS animate-blink dot from GenerateBriefPanel line 198) and commit that instead.
- Whether tests were added beyond the required 7 cases and why
- Any deviation from CONTEXT.md's locked decisions (there should be none — flag loudly if one was necessary)
</output>
