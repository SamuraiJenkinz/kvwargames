---
phase: 06-llm-integration
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - src/types/game.ts
  - src/types/llm.ts
autonomous: true

must_haves:
  truths:
    - "`ChatMessage` carries the error-diagnostic metadata (`rawResponse`, `errorCode`, `retryInput`) needed by the error bubble component and Retry action"
    - "`ChatMessage` carries a `revealDelay` field so staggered reveal can be driven by CSS animation-delay on a single `addMessages` insert (sticky-scroll-safe pattern)"
    - "`LLMStructuredResponse` carries the optional `control` block (advanceRound/triggerDebrief flags) used by the non-blocking confirmation banner"
    - "`HistoryEntry` is defined in `src/types/llm.ts` so both `contextWindow.ts` (06-05) and `llmClient.ts` (06-06) import it from the shared types module rather than from each other — prevents a type-level dependency between 06-05 and 06-06"
    - "Existing `MessageType` union is extended cleanly (no breaking changes to callers that already compile)"
  artifacts:
    - path: "src/types/game.ts"
      provides: "Extended ChatMessage interface"
      contains: "rawResponse"
    - path: "src/types/llm.ts"
      provides: "LLMStructuredResponse with control field; HistoryEntry shared type"
      contains: "control"
  key_links:
    - from: "src/types/game.ts"
      to: "components using ChatMessage"
      via: "structural typing (optional new fields)"
      pattern: "ChatMessage"
---

<objective>
Add the type-level seats that Phase 6 UI and store work will write into: error metadata + reveal-delay on `ChatMessage`, and the optional `control` block on `LLMStructuredResponse`.

Purpose: Every downstream Phase 6 plan depends on these fields existing. Isolating them in a single early plan prevents three separate plans from each trying to add the same fields to the same file and colliding.
Output: Two type files updated with additive, optional fields and light JSDoc documenting intent.
</objective>

<execution_context>
</execution_context>

<context>
@.planning/phases/06-llm-integration/06-CONTEXT.md
@.planning/phases/06-llm-integration/06-RESEARCH.md
@src/types/game.ts
@src/types/llm.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extend `ChatMessage` with error metadata and reveal delay</name>
  <files>src/types/game.ts</files>
  <action>
    In `src/types/game.ts`, modify the `ChatMessage` interface to add these optional fields (keep existing fields as-is):

    ```typescript
    export interface ChatMessage {
      id: string
      type: MessageType
      speaker?: PersonaId | 'facilitator'
      text?: string
      flag?: string | null

      // ─── Phase 6 additions ───────────────────────────────────────────────
      /** Raw LLM response text — populated on error bubbles for the "Show raw response" disclosure. */
      rawResponse?: string
      /** Machine-readable error code (e.g. 'PARSE_FAILURE', 'LLM_TIMEOUT', 'LLM_UPSTREAM_ERROR'). */
      errorCode?: string
      /** Facilitator input to replay when the Retry button is clicked on this error bubble. */
      retryInput?: string
      /** ms delay for staggered reveal animation (set on persona messages). Applied via CSS animation-delay. */
      revealDelay?: number

      label?: string
      timestamp: string
      isDebrief?: boolean
    }
    ```

    No changes to `MessageType`, `PersonaId`, or other interfaces in this file.

    Rationale for keeping fields optional: all existing callers (Phase 5 mock data, Phase 5 store stubs) continue to satisfy the interface without modification. Only Phase 6 code will set the new fields.
  </action>
  <verify>
    From `C:\KVWarGame`:
    - `pnpm typecheck` (or `pnpm tsc --noEmit`) passes with zero errors — this proves the additive fields don't break any existing caller.
    - `pnpm test` (vitest) passes — existing tests of gameStore / ChatFeed / PersonaMessage don't care about the new optional fields.
  </verify>
  <done>
    `ChatMessage` in `src/types/game.ts` exposes `rawResponse?`, `errorCode?`, `retryInput?`, and `revealDelay?` with JSDoc. TypeScript compile passes. All existing tests pass.
  </done>
</task>

<task type="auto">
  <name>Task 2: Extend `LLMStructuredResponse` with the `control` block</name>
  <files>src/types/llm.ts</files>
  <action>
    In `src/types/llm.ts`, modify `LLMStructuredResponse` to include the optional `control` block:

    ```typescript
    export interface LLMStructuredResponse {
      responses: PersonaResponse[]
      /**
       * Optional control signals from the LLM that trigger a non-blocking facilitator
       * confirmation banner. The banner offers [Advance]/[Enter Debrief]/[Dismiss] — the
       * store never auto-applies these. Only one of advanceRound / triggerDebrief should
       * be set per response; the store resolves conflicts by preferring `triggerDebrief`.
       */
      control?: {
        advanceRound?: boolean
        triggerDebrief?: boolean
      }
    }
    ```

    Also add an exported type alias for the discriminated parse result used by `responseParser.ts` (built in plan 06-05) so both that module and `llmClient.ts` (06-06) can share the shape:

    ```typescript
    export type ParseErrorKind = 'PARSE_FAILURE' | 'VALIDATION_FAILURE'

    export type ParseResult =
      | { ok: true; value: LLMStructuredResponse }
      | { ok: false; errorKind: ParseErrorKind; raw: string; detail: string }
    ```

    Also add a `LLMClientError` union for `llmClient.ts` to return (keeps `llmClient.ts` free of type proliferation):

    ```typescript
    export type LLMClientErrorCode =
      | 'LLM_TIMEOUT'
      | 'LLM_AUTH_ERROR'
      | 'LLM_UPSTREAM_ERROR'
      | 'LLM_UNREACHABLE'
      | 'INTERNAL_ERROR'
      | 'NETWORK_ERROR'
      | 'ABORTED'

    export type LLMCallResult =
      | { ok: true; text: string }
      | { ok: false; errorCode: LLMClientErrorCode; message: string }
    ```

    Finally, add the shared `HistoryEntry` type used by both `contextWindow.ts` (06-05) and `llmClient.ts` (06-06). Defining it here keeps 06-06 from having a type-level dependency on 06-05:

    ```typescript
    /**
     * A single role-tagged message in the rolling LLM conversation history.
     * Consumed by `windowHistory` (contextWindow.ts) and `callLLMProxy` (llmClient.ts).
     */
    export type HistoryEntry = { role: 'user' | 'assistant'; content: string }
    ```

    No other changes to `llm.ts`.
  </action>
  <verify>
    - `pnpm typecheck` passes.
    - `pnpm test` passes (no code references these yet, but compile must succeed).
    - `grep -c "control?" src/types/llm.ts` returns `1`.
    - `grep -c "LLMCallResult" src/types/llm.ts` returns `1`.
    - `grep -c "HistoryEntry" src/types/llm.ts` returns ≥ `1`.
  </verify>
  <done>
    `LLMStructuredResponse.control` is typed. `ParseResult`, `LLMClientErrorCode`, `LLMCallResult`, and `HistoryEntry` are exported for downstream plans to import. Compile passes.
  </done>
</task>

</tasks>

<verification>
- Additive type changes only; no existing caller needs modification.
- Downstream plans (03–07) can import `ParseResult`, `LLMCallResult`, and the new ChatMessage fields directly.
- `pnpm typecheck && pnpm test` passes with zero diagnostics.
</verification>

<success_criteria>
- `src/types/game.ts` `ChatMessage` has `rawResponse?`, `errorCode?`, `retryInput?`, `revealDelay?` fields.
- `src/types/llm.ts` exports `LLMStructuredResponse.control`, `ParseResult`, `LLMClientErrorCode`, `LLMCallResult`, and `HistoryEntry`.
- No existing test breaks.
</success_criteria>

<output>
After completion, create `.planning/phases/06-llm-integration/06-02-SUMMARY.md`.
</output>
