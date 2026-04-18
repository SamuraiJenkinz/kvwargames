# Phase 15: TTS Health + Graceful Degradation - Research

**Researched:** 2026-04-18
**Domain:** FastAPI health endpoint (TTS), React badge component, error taxonomy alignment
**Confidence:** HIGH

---

## Summary

All reference files exist and have been read directly from the codebase. No gaps or
assumptions — findings below are derived from actual code, not inference.

The standard approach is a direct near-copy of two existing artifacts:
`backend/app/routers/health.py` (backend) and `src/components/setup/HealthBadge.tsx`
(frontend). The 8-code taxonomy is already fully consistent across all three layers —
`errors.py`, `elevenlabs_provider.py`, `health.py`, and `podcastStore.ts` all use
the same set with identical string values. No reconciliation is needed.

The markdown download path is completely decoupled from `podcastStore` — the
`handleDownload` handler in `ActionToolbar.tsx` reads only `gameStore` state and
calls `generateDebriefMarkdown` / `downloadDebrief` from `debriefExporter.ts`. It
never reads `podcastStore.status` or `podcastStore.error`. This is a structural
decoupling, not a convention — verification requires a single code-path inspection
rather than runtime testing.

**Primary recommendation:** Build `backend/app/routers/health_tts.py` as a sibling
to `health.py`, using a module-level `asyncio.Lock + (timestamp, result)` tuple for
the 30s cache, a fresh `httpx.AsyncClient` (not the shared LLM client), and the
`xi-api-key` header against `https://api.elevenlabs.io/v1/user`. Build
`src/components/setup/TtsHealthBadge.tsx` as a distinct component that duplicates
the `HealthBadge.tsx` shell with three locked substitutions: fetch URL, copy strings,
and failed-state color token.

---

## Standard Stack

### Backend
| Component | Version/Location | Purpose |
|-----------|-----------------|---------|
| `httpx.AsyncClient` | httpx >=0.28.0 (already in requirements.txt) | Raw async HTTP to ElevenLabs `/v1/user` |
| `asyncio.Lock` | stdlib | Guards the module-level 30s cache tuple |
| `fastapi.APIRouter` | already in project | Router registration |
| `get_settings()` | `app.config` | Reads `elevenlabs_api_key` and `tts_provider` |

### Frontend
| Component | Location | Purpose |
|-----------|----------|---------|
| `HealthBadge.tsx` | `src/components/setup/HealthBadge.tsx` | Shell to near-copy |
| `HealthStatus` type | `src/types/health.ts` | Reuse `'checking' \| 'ok' \| 'failed'` |
| `formatLatency` | inline in `HealthBadge.tsx` (lines 7–10) | Extract or duplicate |
| `LoadConfigPanel.tsx` | `src/components/setup/LoadConfigPanel.tsx` | Mount site for new badge |

### No New Dependencies
Everything required is already in the project. The TTS health endpoint does not use
the ElevenLabs SDK — it makes a raw `httpx.AsyncClient` GET to `/v1/user`.

---

## Architecture Patterns

### Backend: `backend/app/routers/health_tts.py` (new file)

**Router registration:** Add `from .routers import health_tts` and
`app.include_router(health_tts.router)` in `main.py` adjacent to the existing
`health.router` import. Order does not matter (distinct path prefixes).

**Client strategy:** The TTS health endpoint must NOT reuse `request.app.state.http_client`
(that client is the shared LLM client with LLM-specific timeouts and base URL). Create a
module-level `httpx.AsyncClient` for the TTS probe, OR create one per-request with a
`async with httpx.AsyncClient() as client:` context manager. Given the 30s cache reduces
call frequency, a per-request client is acceptable and simpler than managing lifecycle
in `main.py`'s lifespan.

**Probe details (HIGH confidence — confirmed from SDK source):**
- URL: `https://api.elevenlabs.io/v1/user`
- Auth header: `xi-api-key: {settings.elevenlabs_api_key}`
- Per-request timeout: `httpx.Timeout(15.0)` (same SLA as LLM health)
- Response validation: HTTP 200 + JSON with `subscription` key present

**Cache pattern (CONTEXT.md decision):**
```python
import asyncio
import time

_CACHE_TTL_S = 30.0
_cache_lock = asyncio.Lock()
_cache: tuple[float, dict] | None = None  # (timestamp, result_dict)
```
Re-check bypass: `?force=true` query param skips cache read (still writes on completion).

**Exception handler order (mirrors `health.py` exactly — load-bearing):**
```
httpx.TimeoutException     → timeout       (MUST precede RequestError)
httpx.HTTPStatusError      → auth_error (401/403) | rate_limited (429) | upstream_error (other)
httpx.ConnectError         → tls_error (SSLError __cause__) | network_error (other)
                             (MUST precede RequestError — subclass)
httpx.RequestError         → network_error (catch-all transport)
Exception                  → invalid_response (unexpected body shape)
```

**`TTS_PROVIDER=fake` path:** When `settings.tts_provider == "fake"`, the endpoint
has no `elevenlabs_api_key` to probe with. Return `{"ok": true, "latencyMs": 0}` immediately
(fake provider is always "healthy" — no network to fail). This avoids a confusing
`auth_error` result for dev-mode users.

**Response shape (matches v1.1 contract):**
```
Success: {"ok": true, "latencyMs": <int>}
Failure: {"ok": false, "code": <TTSErrorCode>, "status": <int|null>, "hint": <str>, "latencyMs": <int>}
```

### Frontend: `src/components/setup/TtsHealthBadge.tsx` (new file)

**Component structure:** Distinct component (not parameterized shared badge). The three
substitutions from `HealthBadge.tsx`:

1. **Fetch URL:** `'/api/health/llm'` → `'/api/health/tts'`
2. **Copy strings:**
   - checking: `'Checking TTS connection…'`
   - ok: `` `TTS connected — ${formatLatency(data.latencyMs)}` ``
   - failed: `` `[${data.code}] Podcast generation unavailable — markdown debrief will still work.` ``
   - backend unreachable (res.ok false): `'Backend unreachable — is the API server running?'`
3. **Failed dot color:** `bg-[var(--color-category-crisis)]` → `bg-[var(--color-crisis-supply)]`
   (`--color-crisis-supply: #FDCB6E` — the amber/warning token already in the design system;
   `--color-crisis-none` is green (ok), `--color-crisis-supply` is amber (warning/non-blocking))
4. **Failed text color:** `text-[var(--color-category-crisis)]` → `text-[var(--color-persona-finch)]`
   (Finch's amber `#DFA02A` is the closest semantic warm-warning text token — or use Tailwind
   `text-amber-400` which is already used in ActionToolbar for non-blocking elements)
5. **`aria-label` on Re-check button:** `'Re-check LLM connection'` → `'Re-check TTS connection'`
6. **`title` attribute on the badge container:** set to `data.hint` in the failed state
   (CONTEXT.md decision: hint goes in `title`, not visible copy)
7. **`onStatusChange` callback:** keep same signature `(status: HealthStatus) => void`
   but `LoadConfigPanel` does NOT wire it to `launchDisabled` (TTS status is purely informational)

**`formatLatency` location:** Currently inline in `HealthBadge.tsx` lines 7–10. It is
a 3-line pure function. CONTEXT.md gives Claude discretion to extract to
`src/lib/formatLatency.ts` or duplicate. Prefer extraction — avoids divergence if the
format ever changes.

### Mount site in `LoadConfigPanel.tsx`

Current `HealthBadge` mount (line 207):
```tsx
<HealthBadge onStatusChange={setHealthStatus} />
```

New mount — add `TtsHealthBadge` as an adjacent sibling BELOW `HealthBadge`:
```tsx
<HealthBadge onStatusChange={setHealthStatus} />
<TtsHealthBadge onStatusChange={(_s) => { /* informational only */ }} />
```

The `launchDisabled` derivation on line 106 is NOT changed:
```tsx
const launchDisabled =
  !parseResult.ok || validationErrors.length > 0 || healthStatus !== 'ok'
// healthStatus is set by HealthBadge (LLM) only — TTS status never touches it
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 30s cache with async safety | custom dict with threading.Lock | `asyncio.Lock` + module-level tuple | Event loop is single-threaded; asyncio.Lock is the correct primitive |
| TTS API auth | Invent header name | `xi-api-key` header (confirmed from SDK source `client_wrapper.py`) | Hardcoded in SDK |
| ElevenLabs probe | SDK call via `ElevenLabsTTSProvider` | Raw `httpx.AsyncClient` GET | SDK is sync-only; health endpoint is async |
| Error code taxonomy | New set for TTS health | Reuse `TTSErrorCode` from `errors.py` verbatim | Already aligned across all layers |

---

## Common Pitfalls

### Pitfall 1: Reusing the shared LLM `httpx.AsyncClient`
**What goes wrong:** `request.app.state.http_client` points to the LLM client, configured
with LLM endpoint defaults. Calling ElevenLabs `/v1/user` through it would work by
accident (httpx clients are generic) but couples the LLM and TTS transports and confuses
future maintainers.
**How to avoid:** Instantiate a fresh `httpx.AsyncClient` inside the TTS health handler
(or as a module-level singleton) with `timeout=httpx.Timeout(15.0)`.

### Pitfall 2: ElevenLabs SDK has no async client (as of 2.43.0)
**What goes wrong:** `AsyncElevenLabs` has open issue #243 (TypeError) per `base.py`
comment — do not use it. The probe must be a raw `httpx.AsyncClient` GET to
`https://api.elevenlabs.io/v1/user`, not an SDK call.
**How to avoid:** Raw httpx only for the health probe.

### Pitfall 3: TTS health endpoint when `TTS_PROVIDER=fake`
**What goes wrong:** `settings.elevenlabs_api_key` is `None` in fake mode. Sending
`xi-api-key: None` to ElevenLabs returns 401, yielding a misleading `auth_error` on
setup screen when the dev is intentionally running without ElevenLabs.
**How to avoid:** Early-return `{"ok": true, "latencyMs": 0}` when
`settings.tts_provider == "fake"`.

### Pitfall 4: Wiring `onStatusChange` to `launchDisabled`
**What goes wrong:** If `LoadConfigPanel` passes the TTS badge's status to the existing
`setHealthStatus` state, or creates a second gate, the Launch button would be blocked by
TTS failure — violating PODRES-02.
**How to avoid:** The `TtsHealthBadge`'s `onStatusChange` callback is ignored at the
parent level in Phase 15. The `launchDisabled` expression is not modified.

### Pitfall 5: `formatLatency` duplication drift
**What goes wrong:** Duplicating the 3-line function into both badge files means a format
change must be applied twice.
**How to avoid:** Extract to `src/lib/formatLatency.ts` and import in both badges.

### Pitfall 6: Handler order in `health_tts.py` — `ConnectError` after `RequestError`
**What goes wrong:** `httpx.ConnectError` is a subclass of `httpx.RequestError`. If
`RequestError` is caught first, all `ConnectError` instances are captured before reaching
the TLS discrimination branch.
**How to avoid:** Mirror `health.py` exactly: `TimeoutException` → `HTTPStatusError` →
`ConnectError` (with SSL dispatch) → `RequestError` → `Exception`.

### Pitfall 7: Cache write on `force=true` bypass
**What goes wrong:** If `?force=true` skips both the cache read AND the cache write,
subsequent auto-checks (no `force`) never benefit from the re-check's result.
**How to avoid:** `?force=true` skips the cache READ only; always writes the result back
to cache after a successful probe.

---

## Code Examples

### 8-Code Taxonomy — confirmed identical across all layers (HIGH confidence)

From `backend/app/services/tts/errors.py` (canonical definition):
```python
TTSErrorCode = Literal[
    "timeout", "auth_error", "not_found", "rate_limited",
    "upstream_error", "network_error", "tls_error", "invalid_response",
]
```

From `backend/app/routers/health.py` (LLM health, same 8 codes):
```
timeout | auth_error | not_found | rate_limited |
upstream_error | network_error | tls_error | invalid_response
```

From `src/lib/podcastStore.ts` (error shape at line 19):
```typescript
error: { code: string; message: string; persona?: PersonaKey } | null
```
The `code` field carries one of the 8 TTSErrorCode strings. The type is `string` (not a
union type), so no TypeScript union update is needed for Phase 15.

### GenerationPanel error banner — confirmed render pattern (HIGH confidence)

From `src/components/game/Podcast/GenerationPanel.tsx` lines 98–112:
```tsx
{status === 'error' && error && (
  <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 space-y-2">
    <p className="text-sm text-red-400">
      <span className="font-mono text-xs">[{error.code}]</span>{' '}
      {error.message}
    </p>
    <button type="button" onClick={reset} ...>Dismiss</button>
  </div>
)}
```
This banner already renders `[code] message` + Dismiss. No changes needed for PODRES-01
mid-gen failures. The CONTEXT.md decision to "reuse verbatim" is structurally correct.

### Markdown download path — decoupled from podcastStore (HIGH confidence)

From `src/components/game/FacilitatorInput/ActionToolbar.tsx` lines 99–112:
```typescript
const handleDownload = () => {
  const s = useGameStore.getState()   // reads ONLY gameStore
  if (!s.gameConfig || !s.gameState) return
  const snapshot = { ... s.messages ... }
  const md = generateDebriefMarkdown(snapshot)
  downloadDebrief(md, filename)
}
```
The `handleDownload` function has zero reference to `podcastStore`, `podcastStatus`,
or `podcastError`. The Download Debrief (.md) button at line 153–163 calls only
`handleDownload`. Structural decoupling confirmed.

### `formatLatency` — current implementation (HIGH confidence)

From `src/components/setup/HealthBadge.tsx` lines 7–10:
```typescript
function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}
```
Extract to `src/lib/formatLatency.ts` and import in both badges.

### Design token for amber failed state (HIGH confidence)

From `src/styles/index.css`:
```
--color-crisis-supply:   #FDCB6E;   ← amber/warning (existing token, correct semantic)
--color-category-crisis: #FF6B6B;   ← red (LLM badge uses this for failed state)
--color-crisis-none:     #2BC48A;   ← green (both badges use for ok dot)
```
For TTS badge failed dot: `bg-[var(--color-crisis-supply)]`
For TTS badge failed text: use Tailwind `text-amber-400` (already the project convention
for non-blocking warnings — see `ActionToolbar.tsx` lines 157, 174, 185).

---

## Taxonomy Alignment Check

**RESULT: FULLY ALIGNED. No reconciliation needed.**

| Layer | Codes | Source |
|-------|-------|--------|
| `errors.py` `TTSErrorCode` | timeout, auth_error, not_found, rate_limited, upstream_error, network_error, tls_error, invalid_response | Literal type definition |
| `elevenlabs_provider.py` | Same 8 codes (API-error dispatch + httpx-transport dispatch) | Error mapping comment + implementation |
| `health.py` LLM router | Same 8 codes | Module docstring + implementation |
| `podcastStore.ts` `error.code` | `string` type (no union restriction) | Line 19 of podcastStore.ts |
| CONTEXT.md taxonomy | Same 8 codes | Locked decision text |

The CONTEXT.md requirement "planner verifies this invariant during 15-01 task design"
is confirmed satisfied. No divergence exists.

---

## Open Questions

### Q1: Should the TTS health endpoint return `ok: true` when `TTS_PROVIDER=fake`?

**What we know:** `settings.elevenlabs_api_key` is `None` in fake mode. No probe can
succeed. The badge would always show amber in dev mode, which is noisy and misleading.
**Recommendation:** Return `{"ok": true, "latencyMs": 0}` immediately when
`tts_provider == "fake"`. Optionally include a `"hint": "TTS_PROVIDER=fake — no network check"` field in the body for clarity. This is not explicitly specified in CONTEXT.md but is the only behavior that avoids a constant false-alarm state in dev.

### Q2: New router file vs. extending `health.py`

**What we know:** CONTEXT.md mentions "`health_tts.py` or extending the same module".
**Recommendation:** New sibling file `backend/app/routers/health_tts.py`. The LLM
and TTS probes have entirely different auth/transport/cache patterns; combining them
would make both harder to understand and test.

### Q3: `formatLatency` — extract vs. duplicate

**What we know:** The function is 3 lines and currently inline in `HealthBadge.tsx`.
CONTEXT.md gives Claude discretion.
**Recommendation:** Extract to `src/lib/formatLatency.ts`. Cost is one new 5-line file;
benefit is no divergence risk across two badge files that share the same format spec.

### Q4: `env_tts_elevenlabs` fixture for backend tests

**What we know:** `conftest.py` has `env_tts_fake` but no `env_tts_elevenlabs` fixture.
The TTS health tests will need `TTS_PROVIDER=elevenlabs` + a fake `ELEVENLABS_API_KEY`
(does not require the 4 voice IDs since the health endpoint never calls `get_tts_provider`).
**Recommendation:** Add `env_tts_elevenlabs` fixture to `conftest.py` that sets
`TTS_PROVIDER=elevenlabs` and `ELEVENLABS_API_KEY=test-el-key-abc`. The 4 voice vars are
NOT needed (health endpoint only reads `settings.elevenlabs_api_key`). Note: the
`validate_elevenlabs_config` model validator in `config.py` will still fail unless
the voice vars are also set — check whether the health endpoint needs to bypass this
or whether the fixture must set all 4 vars.

> **BLOCKER for plan 15-01 task design:** The `@model_validator(mode="after")` in
> `config.py` raises `ValueError` when `tts_provider=elevenlabs` and any of the 4
> `ELEVENLABS_*` vars are missing. The health endpoint only needs `elevenlabs_api_key`
> but cannot get `get_settings()` to succeed without also providing the 3 voice IDs.
> Resolution options: (a) fixture sets all 4 vars (simplest), or (b) health endpoint
> reads the key directly from `os.environ` without going through `get_settings()`, or
> (c) add a separate `elevenlabs_api_key` property to settings that does not require
> the full validator. Option (a) is recommended — just set dummy voice IDs in the test fixture.

---

## Sources

### Primary (HIGH confidence — direct file reads)
- `/c/KVWarGame/backend/app/routers/health.py` — complete LLM health pattern
- `/c/KVWarGame/src/components/setup/HealthBadge.tsx` — badge shell to near-copy
- `/c/KVWarGame/src/types/health.ts` — `HealthStatus`, `LLMHealthResponse` types
- `/c/KVWarGame/backend/app/services/tts/errors.py` — canonical 8-code `TTSErrorCode`
- `/c/KVWarGame/backend/app/services/tts/elevenlabs_provider.py` — error mapping + httpx client pattern
- `/c/KVWarGame/src/components/game/Podcast/GenerationPanel.tsx` — mid-gen error banner shape
- `/c/KVWarGame/src/lib/podcastStore.ts` — `error.code` field shape
- `/c/KVWarGame/src/components/setup/LoadConfigPanel.tsx` — mount site + `launchDisabled` logic
- `/c/KVWarGame/src/components/game/FacilitatorInput/ActionToolbar.tsx` — markdown download decoupling proof
- `/c/KVWarGame/src/styles/index.css` — design token inventory
- `/c/KVWarGame/backend/app/config.py` — Settings fields + `validate_elevenlabs_config` validator
- `/c/KVWarGame/backend/app/main.py` — router registration pattern + lifespan
- `/c/KVWarGame/backend/tests/conftest.py` — test fixture conventions
- `/c/KVWarGame/backend/tests/test_health_llm.py` — test pattern to mirror
- Python runtime: `elevenlabs==2.43.0` SDK — confirmed `xi-api-key` header + `https://api.elevenlabs.io` base URL

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies already in project; SDK version confirmed
- Architecture: HIGH — both reference files read; patterns fully documented
- Error taxonomy alignment: HIGH — all 4 layers inspected, zero divergence found
- Pitfalls: HIGH — derived from actual code; not from training data
- Design tokens: HIGH — `index.css` read directly
- Open questions: MEDIUM — Q4/BLOCKER requires planner decision on `validate_elevenlabs_config`

**Research date:** 2026-04-18
**Valid until:** 2026-05-18 (elevenlabs SDK is pinned at 2.43.0; stable until next upgrade)
