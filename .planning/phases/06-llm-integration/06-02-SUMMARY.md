---
phase: 06-llm-integration
plan: 02
subsystem: types
tags: [typescript, types, phase-6-seed]

dependency-graph:
  requires: []
  provides:
    - ChatMessage.rawResponse
    - ChatMessage.errorCode
    - ChatMessage.retryInput
    - ChatMessage.revealDelay
    - LLMStructuredResponse.control
    - ParseResult
    - ParseErrorKind
    - LLMCallResult
    - LLMClientErrorCode
    - HistoryEntry
  affects: [06-03, 06-04, 06-05, 06-06, 06-07, 06-08, 06-09]

tech-stack:
  added: []
  patterns:
    - discriminated-union result types for parser + client (ok: true | ok: false)
    - shared HistoryEntry co-located in llm.ts to break sibling type dependency

key-files:
  created: []
  modified:
    - src/types/game.ts
    - src/types/llm.ts

decisions:
  - "HistoryEntry is defined in src/types/llm.ts (not contextWindow.ts) so llmClient.ts (06-06) does not take a type-level dependency on contextWindow.ts (06-05). Both sibling modules import from the shared types module."
  - "All new ChatMessage fields are optional — Phase 5 mock data, Phase 5 store stubs, and all existing callers continue to satisfy the interface unchanged. Only Phase 6 producers will set the new fields."
  - "LLMStructuredResponse.control is a nested object literal (not a flat field) to cleanly namespace the advance/debrief signals. Only one of advanceRound / triggerDebrief should be set per response; the store will prefer triggerDebrief when both are true (documented in JSDoc)."
  - "ParseResult + LLMCallResult use discriminated unions on { ok: true | false } rather than throwing — downstream consumers pattern-match without try/catch and error metadata is carried through the value channel."
  - "ParseErrorKind values ('PARSE_FAILURE' | 'VALIDATION_FAILURE') are string literals rather than enum members — keeps serialization trivial and matches the errorCode strings that will end up in ChatMessage.errorCode."

metrics:
  duration: "1m 13s"
  completed: "2026-04-14"
  tests-added: 0
  tests-total: 212
---

# Phase 6 Plan 02: Types Extension Summary

**One-liner:** Additive type-only extensions seeding every downstream Phase 6 plan with error metadata on ChatMessage, a control block on LLMStructuredResponse, and shared ParseResult/LLMCallResult/HistoryEntry types in src/types/llm.ts.

## What Was Built

### Task 1 — `src/types/game.ts`

Added four optional fields to `ChatMessage` with JSDoc:

- `rawResponse?: string` — raw LLM text for the error bubble "Show raw response" disclosure.
- `errorCode?: string` — machine-readable code (`PARSE_FAILURE`, `LLM_TIMEOUT`, `LLM_UPSTREAM_ERROR`, etc.).
- `retryInput?: string` — facilitator input to replay via the Retry button on an error bubble.
- `revealDelay?: number` — ms delay for CSS `animation-delay`-driven staggered reveal on a single `addMessages` insert (sticky-scroll-safe pattern).

No changes to `MessageType`, `PersonaId`, or any other interface in the file.

### Task 2 — `src/types/llm.ts`

Extended `LLMStructuredResponse` and added four new exports:

- `LLMStructuredResponse.control?: { advanceRound?: boolean; triggerDebrief?: boolean }` — optional non-blocking confirmation signals; store never auto-applies.
- `ParseErrorKind = 'PARSE_FAILURE' | 'VALIDATION_FAILURE'`
- `ParseResult = { ok: true; value: LLMStructuredResponse } | { ok: false; errorKind, raw, detail }` — consumed by `responseParser.ts` (06-05).
- `LLMClientErrorCode = 'LLM_TIMEOUT' | 'LLM_AUTH_ERROR' | 'LLM_UPSTREAM_ERROR' | 'LLM_UNREACHABLE' | 'INTERNAL_ERROR' | 'NETWORK_ERROR' | 'ABORTED'`
- `LLMCallResult = { ok: true; text } | { ok: false; errorCode, message }` — consumed by `llmClient.ts` (06-06).
- `HistoryEntry = { role: 'user' | 'assistant'; content: string }` — shared by `contextWindow.ts` (06-05) and `llmClient.ts` (06-06).

## Verification

- `pnpm typecheck` → passes with zero diagnostics (additive optional fields don't break any existing caller).
- `pnpm test` → 212/212 pass (no new tests; existing tests of gameStore, ChatFeed, PersonaMessage don't reference the new fields).
- `grep -c "control?" src/types/llm.ts` → 1.
- `grep -c "LLMCallResult" src/types/llm.ts` → 1.
- `grep -c "HistoryEntry" src/types/llm.ts` → 1.

## Deviations from Plan

None — plan executed exactly as written.

## Next Phase Readiness

Downstream Phase 6 plans can now import these types without needing to add them themselves:

- **06-03 (state updater):** no direct import yet (operates on GameState), but benefits from stable `LLMStructuredResponse.control` contract.
- **06-04 (prompt builder):** may import `HistoryEntry` when it begins generating the user turn.
- **06-05 (response parser + context window):** imports `ParseResult`, `ParseErrorKind`, `LLMStructuredResponse`, and `HistoryEntry`.
- **06-06 (llm client):** imports `LLMCallResult`, `LLMClientErrorCode`, and `HistoryEntry`.
- **06-07 (store + ui wiring):** reads `rawResponse`, `errorCode`, `retryInput`, `revealDelay` on `ChatMessage`; reads `control` on `LLMStructuredResponse`.
- **06-09 (state visibility):** no direct type dependency but unblocked by error bubble metadata on `ChatMessage`.

All fields are optional and additive; zero callers need updating in this plan by design.
