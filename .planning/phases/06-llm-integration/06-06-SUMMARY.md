---
phase: 06-llm-integration
plan: 06
subsystem: llm
tags: [fetch, abortcontroller, http, error-mapping, typescript, vitest, mock-fetch]

# Dependency graph
requires:
  - phase: 06-llm-integration
    provides: "06-02 type definitions (HistoryEntry, LLMCallResult, LLMClientErrorCode)"
provides:
  - "callLLMProxy — never-throws fetch wrapper returning discriminated LLMCallResult"
  - "LLM_FRONTEND_TIMEOUT_MS = 45000 — constant for store's AbortController"
affects: [06-07-store-and-ui-wiring, 06-08-token-budget-and-smoke-test]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Never-throws fetch wrapper — grep-verified zero `throw` statements"
    - "Discriminated LLMCallResult union — error metadata on value channel, no try/catch at call sites"
    - "AbortController ownership stays with store — client only consumes AbortSignal"
    - "vi.stubGlobal('fetch', vi.fn()) test harness + Response constructor for mocked bodies"

key-files:
  created:
    - src/lib/llmClient.ts
    - src/lib/llmClient.test.ts
  modified: []

key-decisions:
  - "Client imports only from @/types/llm (HistoryEntry, LLMCallResult, LLMClientErrorCode) — zero dependency on contextWindow.ts or responseParser.ts; 06-06 truly depends only on 06-02 at type level"
  - "DOMException name 'AbortError' distinguished from generic network errors — ABORTED vs NETWORK_ERROR surfaces cancellation cleanly"
  - "Unknown backend error codes fall through to INTERNAL_ERROR via known-list membership check — prevents arbitrary strings leaking through LLMClientErrorCode type"
  - "error.message fallback uses `HTTP ${status}` — backend error shape guarantees code but message is optional per Phase 2 contract"
  - "fetch signal is forwarded directly; no wrapping AbortController at client layer — store owns cancellation lifecycle (per RESEARCH.md: fresh controller per call, never cached)"
  - "Non-Error rejection (e.g. string thrown) maps to NETWORK_ERROR with 'Network error' fallback message — belt-and-braces type narrowing in catch block"

patterns-established:
  - "HTTP client boundary contract: discriminated result union, never throws, preserves backend error codes end-to-end"
  - "Test harness: vi.stubGlobal('fetch') + new Response(JSON.stringify(body), {status}) — zero mock library deps"

# Metrics
duration: 1m 57s
completed: 2026-04-14
---

# Phase 6 Plan 6: LLM Client Summary

**Never-throws fetch wrapper (`callLLMProxy`) that POSTs to `/api/llm`, returns a discriminated `LLMCallResult`, preserves backend error codes (LLM_TIMEOUT/LLM_AUTH_ERROR/LLM_UPSTREAM_ERROR/LLM_UNREACHABLE/INTERNAL_ERROR) end-to-end, distinguishes AbortError from network failure, and exposes `LLM_FRONTEND_TIMEOUT_MS = 45000` for the store's AbortController.**

## Performance

- **Duration:** 1m 57s
- **Started:** 2026-04-14T13:07:16Z
- **Completed:** 2026-04-14T13:09:13Z
- **Tasks:** 2
- **Files modified:** 2 (both created)

## Accomplishments
- `callLLMProxy(systemPrompt, messages, { signal?, maxTokens? })` — single fetch boundary for every LLM call in the app
- All five backend error codes from Phase 2 preserved end-to-end; unknown codes safely fall through to INTERNAL_ERROR
- AbortController cancellation returns `{ ok: false, errorCode: 'ABORTED' }` cleanly, never rejects
- Network failures (TypeError: Failed to fetch, DNS errors, CORS) map to `NETWORK_ERROR` with original message
- Success-with-malformed-body (missing text field, non-JSON) maps to `INTERNAL_ERROR` — defensive against backend bugs
- 19 tests, 0 throws in source, grep-verified. Full 350-test suite green.

## Task Commits

Each task was committed atomically:

1. **Task 1: llmClient.ts with fetch + AbortController + structured result mapping** — `3b1a0b4` (feat)
2. **Task 2: Test suite with mocked fetch covering every error path** — `009ea06` (test)

**Plan metadata:** (added after SUMMARY write)

## Files Created/Modified
- `src/lib/llmClient.ts` — 102 lines. Exports `callLLMProxy` and `LLM_FRONTEND_TIMEOUT_MS`. Single responsibility: HTTP concern.
- `src/lib/llmClient.test.ts` — 253 lines. 19 tests across 7 describe blocks (success, backend error codes, abort, network, body shape, never-throws, constant pin).

## Decisions Made
Captured in frontmatter key-decisions. Summary:

1. **Type-only dependency on 06-02.** `HistoryEntry`, `LLMCallResult`, `LLMClientErrorCode` all import from `@/types/llm`. Zero import of `./contextWindow` or `./responseParser` — 06-06 can ship and be reverted independently of 06-05.
2. **AbortError distinguished from network failure.** `err instanceof DOMException && err.name === 'AbortError'` → `ABORTED`. All other catch paths → `NETWORK_ERROR`. Store can branch on these cleanly in 06-07.
3. **Known-list gate on backend codes.** `(known as string[]).includes(code ?? '')` — backend is source of truth for the five documented codes, but unknown strings coerce to `INTERNAL_ERROR` so the union type stays tight.
4. **Non-Error rejection handled.** `err instanceof Error ? err.message : 'Network error'` — catches the edge case where code throws non-Error values and the catch block still returns a valid `LLMCallResult`.
5. **Store owns AbortController lifecycle.** Client takes a `signal`, forwards it to fetch, does not wrap or cache. Per RESEARCH.md: fresh controller per call.

## Deviations from Plan

None — plan executed exactly as written. The pseudocode from the `<action>` block translated 1:1 to `src/lib/llmClient.ts`. Test cases extended slightly beyond the 14+ specified:
- Added "uses HTTP status text when error.message is absent" (fallback path)
- Added "non-Error rejection" to network failure describe block
- Added "forwards the AbortSignal to fetch" to request body shape describe block

All additions tighten the contract; no planned case was dropped.

## Issues Encountered
None.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- **06-07 (store + UI wiring) unblocked.** Store can now `import { callLLMProxy, LLM_FRONTEND_TIMEOUT_MS } from '@/lib/llmClient'` and wire it into `sendFacilitatorMessage` alongside `buildSystemPrompt` (06-04), `windowHistory` (06-05), `parsePersonaResponse` (06-05), `applyStateUpdatePure` (06-03).
- **AbortController pattern for the store:** create fresh `AbortController`, pass `.signal` to `callLLMProxy`, wire `setTimeout(() => controller.abort(), LLM_FRONTEND_TIMEOUT_MS)` for frontend-side timeout, always `clearTimeout` on resolve.
- **Error-bubble message rendering (06-07):** map `LLMCallResult.errorCode` to user-facing retry messages in the chat feed; `ABORTED` likely silent, `NETWORK_ERROR`/`LLM_UNREACHABLE` → "connection issue, retry?", `LLM_TIMEOUT` → "model took too long", `LLM_AUTH_ERROR` → "configuration issue, contact admin", etc.
- **No blockers for Wave 3 completion.** 06-03 + 06-04 + 06-05 + 06-06 all shipped; 06-07 can consume the complete stack.

---
*Phase: 06-llm-integration*
*Completed: 2026-04-14*
