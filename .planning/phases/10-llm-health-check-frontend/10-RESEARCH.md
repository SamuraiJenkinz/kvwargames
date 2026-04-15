# Phase 10: LLM Health Check — Frontend - Research

**Researched:** 2026-04-15
**Domain:** React + TypeScript frontend, setup screen integration, fetch wiring, Vitest/RTL testing
**Confidence:** HIGH (all findings verified against actual source files)

---

## Summary

Phase 10 adds a single `HealthBadge` component to the `LoadConfigPanel` (the "review/launch" step — the only setup screen that shows Launch buttons). The badge sits directly above the Launch Scenario buttons, auto-checks on mount, shows three states (checking/ok/failed), offers a Re-check button, and gates the Launch buttons to disabled while status is `checking` or `failed`.

The setup screen is a Zustand-driven multi-panel (`SetupMode` = `'home' | 'load' | 'brief' | 'review'`). The "review/launch step" maps exclusively to `LoadConfigPanel` — `SetupScreen.tsx` currently routes both `'load'` and `'review'` to `LoadConfigPanel`. The Launch Scenario buttons already exist in `LoadConfigPanel` at lines 197–223 with a `launchDisabled` flag that drives both `disabled` and `aria-disabled`. The badge must extend this gate to also consider health status.

The HTTP client pattern is plain `fetch` with no shared wrapper library. Health fetch is a simple `GET /api/health/llm` (no body, no auth headers required from frontend). The Vite proxy (`/api` → `http://localhost:8000`) means a backend-down scenario surfaces as a `TypeError: Failed to fetch` (not a 4xx/5xx). State management for health can be local component state (`useState`) — the Launch button already lives in the same component so no cross-component Zustand slice is needed.

**Primary recommendation:** Implement `HealthBadge` as a self-contained component with local `useState` for status. Wire it into `LoadConfigPanel` above the launch buttons section. Extend `launchDisabled` to include health status. Use `lucide-react` `Loader2` for spinner, plain filled `div` circle for dots (pattern already established in codebase), `RefreshCw` for Re-check (already imported in `ErrorMessage.tsx`).

---

## Standard Stack

The stack is fully established — no new packages required.

### Core (already installed)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| react | ^19.2.5 | Component rendering | `useState`, `useEffect` for health state |
| zustand | ^5.0.12 | Store | NOT needed for health — local state suffices |
| tailwindcss | ^4.2.2 | Styling via `@theme` tokens | CSS-first, all tokens in `index.css` |
| lucide-react | ^1.8.0 | Icons | `RefreshCw` already used; `Loader2` available |

### Test (already installed)
| Library | Version | Purpose |
|---------|---------|---------|
| vitest | ^4.1.4 | Test runner |
| @testing-library/react | ^16.3.2 | Component testing |
| @testing-library/user-event | ^14.6.1 | User interaction simulation |
| jsdom | ^29.0.2 | DOM environment |

**Installation:** No new packages needed.

---

## Architecture Patterns

### Where to Edit: LoadConfigPanel.tsx

The Launch Scenario buttons live in `src/components/setup/LoadConfigPanel.tsx` at lines 197–223. The `launchDisabled` variable (line 96) currently gates on `!parseResult.ok || validationErrors.length > 0`. Health status must join this gate.

**Current button section (lines 196–223):**
```tsx
{scenarioCount !== null && (
  <div className="mt-4 flex flex-wrap gap-3">
    {Array.from({ length: scenarioCount }, (_, i) => {
      ...
      return (
        <button
          key={scenarioId}
          onClick={() => handleLaunch(i)}
          disabled={launchDisabled}
          ...
        >
          Launch Scenario {i + 1}
        </button>
      )
    })}
  </div>
)}
```

The `HealthBadge` component renders immediately above this `<div className="mt-4 flex flex-wrap gap-3">` block.

### Recommended Project Structure

New file:
```
src/
└── components/
    └── setup/
        ├── LoadConfigPanel.tsx       # EDIT — add HealthBadge + extend launchDisabled
        ├── HealthBadge.tsx           # NEW — self-contained status badge component
        └── HealthBadge.test.tsx      # NEW — Vitest + RTL tests
```

No changes to `SetupScreen.tsx`, `gameStore.ts`, `HomeScreen.tsx`, or `GenerateBriefPanel.tsx`.

### Pattern 1: Health Badge with Local State

**What:** `HealthBadge` manages its own fetch lifecycle with `useState` + `useEffect`. Returns a callback to trigger re-check, which `LoadConfigPanel` uses to read current status for gating.

**When to use:** Status only needs to be read by the parent (same file). Local state avoids Zustand overhead for a leaf concern.

**Recommended state shape:**
```typescript
// Source: inferred from backend contract (health.py lines 24–31)
type HealthStatus = 'checking' | 'ok' | 'failed'

interface HealthState {
  status: HealthStatus
  latencyMs?: number        // present when ok
  displayCode?: string      // present when failed — numeric HTTP status or code string
  hint?: string             // present when failed — verbatim from backend
}
```

**Example fetch wrapper (plain fetch, no library):**
```typescript
// Source: pattern from GenerateBriefPanel.tsx (lines 71–118)
async function checkHealth(signal: AbortSignal): Promise<HealthState> {
  try {
    const res = await fetch('/api/health/llm', { signal })
    if (!res.ok) {
      // Vite proxy 502 with HTML body — res.ok is false
      return { status: 'failed', displayCode: String(res.status), hint: 'Backend unreachable — is the API server running?' }
    }
    const data = await res.json() as { ok: boolean; latencyMs?: number; status?: number | null; hint?: string; code?: string }
    if (data.ok) {
      return { status: 'ok', latencyMs: data.latencyMs }
    }
    // Failure: render status (HTTP code if present, else code string) + hint verbatim
    const displayCode = data.status != null ? String(data.status) : (data.code ?? 'error')
    return { status: 'failed', displayCode, hint: data.hint }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err  // let caller handle unmount abort
    }
    // TypeError: Failed to fetch = backend unreachable
    return { status: 'failed', displayCode: undefined, hint: 'Backend unreachable — is the API server running?' }
  }
}
```

**useEffect auto-check on mount:**
```typescript
// Source: pattern from GenerateBriefPanel.tsx useEffect (line 61–66)
useEffect(() => {
  const controller = new AbortController()
  setHealth({ status: 'checking' })
  checkHealth(controller.signal)
    .then(setHealth)
    .catch(() => {}) // abort on unmount — ignore
  return () => controller.abort()
}, [])  // empty deps = runs once on mount only
```

**React StrictMode double-fire:** The app uses `<StrictMode>` (main.tsx line 11). In development StrictMode mounts components twice to detect side effects. The cleanup function (`controller.abort()`) handles this correctly — the first mount's effect is aborted before the second fires. The badge will show a brief `checking` flash in dev but works correctly in production.

### Pattern 2: Latency Formatting

From CONTEXT.md decision: `820ms` under 1s, `1.2s` at/over 1s.

```typescript
function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}
```

### Pattern 3: Design Token Usage

**Existing tokens from `src/styles/index.css`:**
- Green (success): `--color-crisis-none: #2BC48A` → `text-crisis-none`, `bg-crisis-none`
  - Alternative: `--color-resource-readiness: #2BC48A` (same value, same green)
- Red (error): `--color-category-crisis: #FF6B6B` OR `--color-crisis-security: #FF6B6B` (same value)
- Neutral spinner: `text-text-secondary` for the checking state text
- Dot size: existing persona dots are `w-2 h-2 rounded-full` (PersonaDots.tsx line 16)
- Badge border style: mirror the error banner in LoadConfigPanel: `rounded-md border bg-*/10 p-3`
- Button patterns in setup screen: small text buttons for nav ("← Back") or chip-style (`px-3 py-1.5 rounded-md text-sm bg-bg-surface border border-border-dim`)

**Recommended semantic colours for badge states:**
```
checking: text-text-secondary spinner
ok:       text-crisis-none (green #2BC48A) filled dot
failed:   text-category-crisis (red #FF6B6B) filled dot
```

**Spinner:** Use `Loader2` from `lucide-react` with `animate-spin` class — standard Tailwind v4 spinner pattern. Alternative: repurpose the existing animated blink dot from `GenerateBriefPanel.tsx` (lines 198–204) which uses `animate-blink` custom keyframe.

**Re-check button:** Use `RefreshCw` from `lucide-react` (already imported in `ErrorMessage.tsx`). Icon-only with `aria-label="Re-check LLM connection"` matches the compact inline space. Alternatively text "Re-check" — either fits.

### Pattern 4: Launch Gate Extension

In `LoadConfigPanel.tsx` the `launchDisabled` derivation (line 96):

```typescript
// CURRENT:
const launchDisabled = !parseResult.ok || validationErrors.length > 0

// EXTENDED:
const launchDisabled = !parseResult.ok || validationErrors.length > 0 || healthStatus !== 'ok'
```

Where `healthStatus` is lifted from the `HealthBadge` component via a callback prop OR managed directly in `LoadConfigPanel`'s local state (with `HealthBadge` receiving it as a controlled prop). Either approach works — local state in `LoadConfigPanel` is simpler since it already owns `parseResult` and `validationErrors`.

### Anti-Patterns to Avoid

- **Putting health state in gameStore:** Unnecessary — health is transient setup-screen concern. The Launch button lives in the same component as the badge. No other component needs health status.
- **Re-checking on configJson changes:** CONTEXT.md explicitly locks this out. The debounce `useEffect` on `configJson` must NOT trigger a health re-check.
- **Auto-retry on failure:** Locked decision — one shot on mount + manual only.
- **Non-200 from `/api/health/llm`:** Backend always returns HTTP 200. If `res.ok` is false, that means the Vite proxy couldn't reach the backend at all (returns 502 with an HTML error page). This is the "backend unreachable" case.
- **Parsing the 502 HTML body as JSON:** `res.json()` will throw on the Vite 502 HTML response. The `try/catch` around `fetch` catches this correctly and shows the frontend-originated "Backend unreachable" hint.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Spinner animation | Custom CSS keyframe | `lucide-react` `Loader2` + `animate-spin` | Already installed, consistent icon style |
| Abort on unmount | Manual flag check | `AbortController` + cleanup return | Established pattern in `GenerateBriefPanel` |
| Fetch error discrimination | Custom error class | `try/catch` + `DOMException` check | Pattern used in `llmClient.ts` lines 43–46 |
| Token formatting | String manipulation | Simple conditional (`< 1000`) | Two-line helper, no library needed |

**Key insight:** The fetch, abort, and error handling patterns are already established in `GenerateBriefPanel.tsx` and `llmClient.ts`. The health client is simpler (GET, no body) and follows the same skeleton.

---

## Common Pitfalls

### Pitfall 1: React StrictMode Double-Mount

**What goes wrong:** In development, `useEffect` fires twice (mount → cleanup → mount). If the first `fetch` doesn't abort before the second fires, two concurrent health checks run. The second resolves after the component has already processed the first, causing a stale state update.

**Why it happens:** `main.tsx` uses `<StrictMode>`. In dev mode, React unmounts and remounts every component once to detect side effects.

**How to avoid:** Always return a cleanup that calls `controller.abort()` from the `useEffect`. The first `fetch` aborts; the second fires correctly. The `catch(() => {})` in the `.catch` swallows the `AbortError` from the first mount cleanly.

**Warning signs:** "Checking…" badge flashes briefly on initial load in dev — this is expected and correct behaviour.

### Pitfall 2: Vite Proxy 502 HTML Body

**What goes wrong:** When the backend is down, the Vite dev proxy returns HTTP 502 with an HTML error page body. Code that calls `await res.json()` without first checking `res.ok` will throw a JSON parse error, not a typed error.

**Why it happens:** The Vite proxy intercepts the request at the network layer and returns its own 502 before the request reaches Python. The body is HTML, not JSON.

**How to avoid:** Check `res.ok` before `res.json()`. If `!res.ok`, return the frontend-originated "Backend unreachable" message directly without attempting to parse the body.

**Warning signs:** Unhandled promise rejection with `SyntaxError: Unexpected token '<'` in console.

### Pitfall 3: `launchDisabled` Stale on Re-check

**What goes wrong:** If `launchDisabled` is computed at render time but health state changes asynchronously (e.g., Re-check completes while JSON is being edited), the gate might not update.

**Why it happens:** React re-renders when state changes, so this is not actually a problem — any state change triggers re-render and fresh `launchDisabled` derivation. The existing pattern (computing `launchDisabled` in render body) is correct.

**How to avoid:** Keep health status as `useState` in the same component (`LoadConfigPanel`). The computed `launchDisabled` will always reflect the latest state on each render.

### Pitfall 4: Backend `status` Field Nullability

**What goes wrong:** The failure body has `"status": null` for network/timeout errors (backend `health.py` line 134 — `status: "int | None" = None`). Code that does `String(data.status)` renders `"null"` to the user.

**Why it happens:** The backend design intentionally uses `null` when no HTTP status code exists (e.g., timeout, TLS error, network error). The frontend must guard for this.

**How to avoid:** `data.status != null ? String(data.status) : (data.code ?? 'error')` — fall back to the string `code` field when status is null.

### Pitfall 5: Re-check Button During In-Flight Check

**What goes wrong:** Clicking Re-check while a check is already in-flight fires a second concurrent fetch. Both may resolve and race to update state.

**Why it happens:** No guard on the Re-check handler.

**How to avoid:** Disable the Re-check button when `status === 'checking'` (per CONTEXT.md decision). Abort the previous controller before starting a new check.

---

## Code Examples

### TypeScript Types for Health Response

```typescript
// Source: backend/app/routers/health.py lines 24-31
// Add to src/types/llm.ts or a new src/types/health.ts

export interface LLMHealthOk {
  ok: true
  latencyMs: number
}

export interface LLMHealthFail {
  ok: false
  code: 'timeout' | 'auth_error' | 'not_found' | 'rate_limited' | 'upstream_error' | 'network_error' | 'tls_error' | 'invalid_response'
  status: number | null  // HTTP status, or null for network/timeout errors
  hint: string
  latencyMs: number
}

export type LLMHealthResponse = LLMHealthOk | LLMHealthFail
```

### HealthBadge Component Skeleton

```typescript
// Source: patterns from GenerateBriefPanel.tsx, ErrorMessage.tsx, PersonaDots.tsx
import { useEffect, useRef, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import type { LLMHealthResponse } from '@/types/health'

type HealthStatus = 'checking' | 'ok' | 'failed'

interface HealthBadgeProps {
  onStatusChange: (status: HealthStatus) => void
}

export default function HealthBadge({ onStatusChange }: HealthBadgeProps) {
  const [state, setState] = useState<{ status: HealthStatus; text: string }>({
    status: 'checking',
    text: 'Checking LLM connection…',
  })
  const abortRef = useRef<AbortController | null>(null)

  function runCheck() {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setState({ status: 'checking', text: 'Checking LLM connection…' })

    fetch('/api/health/llm', { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          return { status: 'failed' as const, text: 'Backend unreachable — is the API server running?' }
        }
        const data = await res.json() as LLMHealthResponse
        if (data.ok) {
          const latency = data.latencyMs < 1000 ? `${data.latencyMs}ms` : `${(data.latencyMs / 1000).toFixed(1)}s`
          return { status: 'ok' as const, text: `Connected — ${latency}` }
        }
        const code = data.status != null ? String(data.status) : (data.code ?? 'error')
        return { status: 'failed' as const, text: `${code} — ${data.hint}` }
      })
      .then((result) => {
        setState(result)
        onStatusChange(result.status)
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setState({ status: 'failed', text: 'Backend unreachable — is the API server running?' })
        onStatusChange('failed')
      })
  }

  useEffect(() => {
    runCheck()
    return () => { abortRef.current?.abort() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // render: spinner (checking), green dot (ok), red dot (failed) + Re-check button
}
```

### LoadConfigPanel Integration Sketch

```typescript
// In LoadConfigPanel.tsx — new additions:
const [healthStatus, setHealthStatus] = useState<'checking' | 'ok' | 'failed'>('checking')

// Extended launchDisabled:
const launchDisabled = !parseResult.ok || validationErrors.length > 0 || healthStatus !== 'ok'

// In JSX, before the launch buttons div:
<HealthBadge onStatusChange={setHealthStatus} />
```

### Test Pattern: Mocking fetch for Health

```typescript
// Source: GenerateBriefPanel.test.tsx pattern (lines 13-18)
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => {
  vi.unstubAllGlobals()
})

// Health success response:
vi.mocked(fetch).mockResolvedValueOnce(
  new Response(JSON.stringify({ ok: true, latencyMs: 820 }), { status: 200 })
)

// Health failure response (auth error):
vi.mocked(fetch).mockResolvedValueOnce(
  new Response(
    JSON.stringify({ ok: false, code: 'auth_error', status: 401, hint: 'Authentication failed — check LLM_API_KEY in .env', latencyMs: 120 }),
    { status: 200 }  // backend always returns 200
  )
)

// Backend unreachable (Vite proxy 502):
vi.mocked(fetch).mockResolvedValueOnce(
  new Response('<html>502 Bad Gateway</html>', { status: 502 })
)

// Network error (TypeError):
vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'))
```

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|-----------------|-------|
| React Query / SWR for data fetching | Plain `fetch` + `useEffect` | This codebase uses plain fetch everywhere; no React Query installed |
| Global state for all UI signals | Local state for transient UI | Health is LoadConfigPanel-scoped; gameStore is for session data |
| Tailwind config.js tokens | CSS-first `@theme {}` in index.css | Tailwind v4 pattern used throughout |

**Deprecated/outdated:**
- Tailwind v3 `tailwind.config.js` / `theme.extend` pattern: Not used here — project is Tailwind v4 with CSS-first `@theme {}` only.

---

## Backend API Contract (Confirmed from health.py)

| Field | Type | When Present | Notes |
|-------|------|-------------|-------|
| `ok` | boolean | Always | `true` = LLM reachable and responded |
| `latencyMs` | number | Always | Round-trip ms; present in both ok and failed |
| `code` | string | Failed only | `timeout \| auth_error \| not_found \| rate_limited \| upstream_error \| network_error \| tls_error \| invalid_response` |
| `status` | number \| null | Failed only | HTTP status from upstream; `null` for timeout/network errors |
| `hint` | string | Failed only | Human-readable, frontend renders verbatim |

HTTP status of `/api/health/llm` response: **always 200**. `res.ok` will be false ONLY when the Vite proxy (or network) cannot reach the backend.

---

## Open Questions

1. **`HealthBadge` prop vs co-location strategy**
   - What we know: `LoadConfigPanel` owns `launchDisabled` and all launch button rendering. It needs health status to extend the gate.
   - What's unclear: Whether the badge is a pure child prop (`onStatusChange` callback) vs. `healthStatus` state living directly in `LoadConfigPanel` with `HealthBadge` receiving a `runCheck` trigger function.
   - Recommendation: Simplest is `HealthBadge` managed internally, exposes `onStatusChange` callback to parent. Parent holds `healthStatus` in local state only for `launchDisabled` computation.

2. **`lucide-react` version 1.8.0 icon availability**
   - What we know: `Loader2` exists in lucide-react. The package is version `^1.8.0` which is unusual — most projects use `^0.x` or `^4x`. The version string `^1.8.0` may be a pre-release or a fork.
   - What's unclear: Whether `Loader2` is in this specific version.
   - Recommendation: Verify with `import { Loader2 } from 'lucide-react'` compiles cleanly before committing. Fallback: CSS animate-blink dot from `GenerateBriefPanel` line 198 (`<span className="inline-block w-3 h-3 rounded-full bg-text-secondary animate-blink" />`).

---

## Sources

### Primary (HIGH confidence)
- `src/components/setup/LoadConfigPanel.tsx` — exact Launch button location (lines 196–223), `launchDisabled` (line 96), existing fetch/state patterns
- `src/components/setup/GenerateBriefPanel.tsx` — fetch + AbortController + error handling patterns (lines 71–118)
- `src/lib/llmClient.ts` — `fetch` error discrimination pattern (lines 36–53), network error handling
- `src/styles/index.css` — all design tokens (`--color-crisis-none: #2BC48A` green, `--color-category-crisis: #FF6B6B` red, animation keyframes)
- `src/components/setup/SetupScreen.tsx` — confirms `'load'` and `'review'` both render `LoadConfigPanel`
- `backend/app/routers/health.py` — complete response contract (lines 24–31, success/failure bodies)
- `src/main.tsx` — confirms `<StrictMode>` is active (double-mount caveat)
- `vite.config.ts` — proxy config (`/api` → `localhost:8000`), test setup (jsdom, setupFiles)
- `__mocks__/zustand.ts` + `src/test/setup.ts` — test mock pattern (store reset, `vi.stubGlobal('fetch', ...)`)
- `src/components/setup/LoadConfigPanel.test.tsx` — exact test pattern (fake timers, `vi.mock('zustand')`, store seeding)
- `src/components/setup/GenerateBriefPanel.test.tsx` — fetch mock pattern, cancel/abort test pattern
- `src/lib/llmClient.test.ts` — `vi.stubGlobal('fetch', vi.fn())` pattern
- `package.json` — confirms lucide-react ^1.8.0, vitest ^4.1.4, no React Query or axios

### Secondary (MEDIUM confidence)
- `src/components/game/ChatFeed/ErrorMessage.tsx` — `RefreshCw` icon import pattern; crisis-security colour usage
- `src/components/game/StatePanel/PersonaDots.tsx` — `w-2 h-2 rounded-full` dot pattern
- `src/components/game/ChatFeed/LoadingIndicator.tsx` — `animate-blink` spinner alternative pattern

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages confirmed in package.json
- Architecture: HIGH — all file paths and line numbers verified from actual source
- Pitfalls: HIGH — StrictMode double-mount and Vite 502 confirmed from main.tsx and vite.config.ts respectively
- Backend contract: HIGH — read directly from health.py

**Research date:** 2026-04-15
**Valid until:** 2026-05-15 (stable stack; backend contract is Phase 9 shipped artifact)
