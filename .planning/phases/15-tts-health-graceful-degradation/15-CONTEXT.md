# Phase 15: TTS Health + Graceful Degradation - Context

**Gathered:** 2026-04-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the TTS-side parity of the v1.1 LLM health pattern: `GET /api/health/tts` backend endpoint (always HTTP 200, body.ok carries the signal, 8-code reason taxonomy, 30s cache, 15s SLA) + a setup-screen `TtsHealthBadge` that is **informational only and never gates Launch** + empirical proof that ElevenLabs failure never breaks the markdown debrief path. Reuses the Phase 14 podcast error banner verbatim for mid-generation failures — no new mid-gen error UI.

Out of scope for this phase: any new podcast-generation UX, any retry logic, any per-persona health probing, any new failure modes in the FakeTTSProvider runtime.

</domain>

<decisions>
## Implementation Decisions

### Badge UX differentiation (PODRES-02)
- **Structure matches `HealthBadge.tsx` exactly** — same three-state shape (checking spinner / ok dot / failed dot + message + Re-check button), same `aria-live="polite"`, same auto-check-on-mount-only (no re-check on edits), same `onStatusChange` callback shape. The TTS badge is a near-copy of the LLM badge with the fetch URL, copy, and failed-state color swapped.
- **Failed-state color differentiates from LLM** — LLM-failed uses `--color-category-crisis` (red) because LLM-down blocks Launch; TTS-failed uses an amber/warning tone (e.g. `--color-crisis-low` or equivalent warm-but-non-red token) because TTS-down is informational. The distinct color is the visual signal that the Launch button is still enabled.
- **Copy per state is locked**:
  - `checking`: `"Checking TTS connection…"`
  - `ok`: `"TTS connected — {formatLatency}"` (reuses the existing `formatLatency` helper verbatim — no separate copy)
  - `failed`: `"Podcast generation unavailable — markdown debrief will still work."` (SC2 verbatim; no variation per reason code)
- **Reason code is surfaced as diagnostic detail, not primary copy** — prepend `[{code}]` in small font-mono before the failed message (same pattern as Phase 14's `GenerationPanel` error banner, `[upstream_error] Podcast generation unavailable…`). Keeps the SC2 copy intact while giving facilitators a debuggable signal.
- **Backend hint goes into a `title` HTML attribute on the badge**, not into the visible copy. Facilitators who hover get the actionable diagnostic (`"Authentication failed — check ELEVENLABS_API_KEY in .env"`); the default view stays clean.
- **Launch button is never disabled by TTS status** — `LoadConfigPanel`'s `launchDisabled` derivation is NOT extended to read the TTS badge's `onStatusChange` output. The TTS badge's status callback is consumed purely for potential future use; for Phase 15 the parent just renders the badge and ignores the status.

### Mid-generation error surfacing (PODRES-01)
- **Reuse Phase 14's `GenerationPanel` error banner verbatim** — no new component, no new Phase 14 edits. The existing `[{error.code}] {error.message}` + Dismiss banner already satisfies PODRES-01's "clear error status (with reason)" requirement.
- **The 8-code taxonomy from `/api/health/tts` MUST match the 8 codes already flowing through `podcastStore.error.code` from Phase 14's podcast endpoint** — `timeout | auth_error | not_found | rate_limited | upstream_error | network_error | tls_error | invalid_response`. Planner to verify this invariant during 15-01 task design; if Phase 14's podcast endpoint uses a different code set, reconcile the taxonomies (prefer Phase 14's if they diverge — health is additive, podcast is load-bearing).
- **Markdown Download button is decoupled by construction** — it is rendered from a separate code path that never reads `podcastStore.status` or `podcastStore.error`. Verification is by code inspection (a single grep confirming the Download button's `onClick` handler references only the markdown export path) plus the empirical run below.

### Probe target + cache (PODRES-03)
- **Probe endpoint: `/v1/user`** — smaller response payload than `/v1/voices` (profile JSON vs. ~50KB voice list), exercises the same auth surface, sufficient to validate API key + network reachability. If `/v1/user` proves unreliable in the field, the fallback is `/v1/voices` (documented in RESEARCH.md during plan-phase).
- **Cache: 30s in-memory, global (not per-key)** — single-tenant dev tool, one `ELEVENLABS_API_KEY` at a time. Module-level `(timestamp, result)` tuple guarded by an `asyncio.Lock`. No Redis, no TTL store, no per-tenant keying.
- **Re-check button bypasses cache via `?force=true` query param** — user-initiated Re-check means "I want a fresh probe", cached result would defeat the purpose. Auto-check-on-mount respects the cache.
- **Cache invalidation on process restart is acceptable** — no persistence needed. 30s cache is short enough that a hung stale entry self-heals within half a minute.
- **Exception handler order mirrors `routers/health.py`** — `TimeoutException` before `RequestError`, `ConnectError` with SSL `__cause__` dispatch for `tls_error` vs `network_error`, `HTTPStatusError` dispatching on status code. Copy the pattern from lines 125-191 of the LLM health router directly.

### Verification methodology (SC3 + SC4)
- **Two empirical runs, documented in `.planning/phases/15-tts-health-graceful-degradation/15-VERIFICATION.md`**:
  1. **Garbage-key run** — Set `ELEVENLABS_API_KEY=badkey123` in `.env`, `TTS_PROVIDER=elevenlabs`, start dev server, run a full game to end-of-debrief, click Generate Podcast. Verify (a) podcast area renders `[auth_error]` banner, (b) Download Debrief (.md) button still downloads valid markdown, (c) setup-screen TtsHealthBadge shows amber `[auth_error]` state with the locked copy.
  2. **Mid-gen failure injection** — `TTS_PROVIDER=fake` with a test-only fault flag OR a pytest that mocks `httpx.RequestError` at the provider boundary. Verify the same two invariants: error banner renders, markdown download remains functional.
- **Evidence artifact: `15-VERIFICATION.md`** — includes (a) screenshot of the podcast error banner in the browser, (b) SHA-256 of the successfully downloaded `.md` file plus first 20 lines of its content, (c) console log excerpt showing the 8-code in `podcastStore.error.code`, (d) step-by-step reproduction instructions. Written-test artifact following the v1.1 precedent at `.planning/phases/12-*/12-LIVE-VERIFICATION.md` — no video.
- **Garbage-key run is the primary SC3 evidence.** The mid-gen injection is an automated pytest (backend) + vitest (frontend) test that exercises the error path with mocked failures — engineering-layer safety net, not the primary artifact.
- **Do NOT add a failure-mode env var to the FakeTTSProvider runtime** — that would be a Phase 13 contract change. Mid-gen failure injection is done via pytest monkeypatching `httpx` transport or the provider's `stream()` method, not via runtime flags.

### Claude's Discretion
- Exact color token for the amber failed state (pick the closest existing design-system token; do not introduce a new token)
- `formatLatency` reuse vs. duplication (prefer reuse — extract to `src/lib/formatLatency.ts` if HealthBadge's copy is not already importable)
- Test file naming and location (follow existing conventions in `backend/tests/` and `src/**/*.test.tsx`)
- Exact pytest/vitest mocking technique for mid-gen failure injection (monkeypatch vs. dependency injection — whichever is cleanest at implementation time)
- Whether `TtsHealthBadge` is a distinct component or a parameterized shared `HealthBadge` (prefer distinct component if the color/copy branching would clutter the shared one — the two badges have different user-visible semantics and couplings even though their shells look similar)

</decisions>

<specifics>
## Specific Ideas

- "Same shape as the LLM badge" — PODRES-02 wording plus the existing `HealthBadge.tsx` implementation is the concrete reference. Match the component structure top-to-bottom.
- v1.1 Tier-B precedent for empirical evidence — `.planning/phases/12-*/12-LIVE-VERIFICATION.md` is the shape. Markdown doc with screenshots and file hashes, not video.
- Backend health pattern — `backend/app/routers/health.py` (LLM health) is the direct reference for exception handler ordering, response shape, and logging. TTS router should be a sibling file (`backend/app/routers/health_tts.py` or extending the same module) mirroring the same patterns.
- Error code taxonomy is shared with the Phase 14 podcast endpoint — confirm alignment during planning; do not let the two diverge.

</specifics>

<deferred>
## Deferred Ideas

- Per-persona TTS health probes (e.g. voice-ID-specific validation) — future phase if voice-ID drift becomes an operational issue
- Persistent health status across page reloads (localStorage cache) — out of scope; 30s in-memory cache is sufficient for a setup screen
- TTS health as a hard Launch gate under an env flag — explicitly rejected by PODRES-02; would be a roadmap-level reversal, not a phase decision
- Video-capture evidence for the graceful-degradation run — written-test precedent from v1.1 is sufficient; revisit if audit feedback flags this

</deferred>

---

*Phase: 15-tts-health-graceful-degradation*
*Context gathered: 2026-04-18*
