---
phase: 06-llm-integration
plan: 06
type: execute
wave: 3
depends_on: ["06-02"]
files_modified:
  - src/lib/llmClient.ts
  - src/lib/llmClient.test.ts
autonomous: true

must_haves:
  truths:
    - "`callLLMProxy(systemPrompt, messages, { signal, maxTokens? })` POSTs to `/api/llm` and returns a structured `LLMCallResult` — never throws"
    - "AbortController signal cancels the in-flight fetch; aborted calls return `{ ok: false, errorCode: 'ABORTED' }` cleanly"
    - "Backend error codes (`LLM_TIMEOUT`/`LLM_AUTH_ERROR`/`LLM_UPSTREAM_ERROR`/`LLM_UNREACHABLE`/`INTERNAL_ERROR`) are preserved end-to-end — client returns the code string as-received"
    - "Network failure (fetch throws TypeError) maps to `{ ok: false, errorCode: 'NETWORK_ERROR' }`"
    - "Frontend-side timeout constant `LLM_FRONTEND_TIMEOUT_MS = 45000` exported for the store to consume when constructing the AbortController"
    - "All imports come from `@/types/llm` only: `HistoryEntry`, `LLMCallResult`, `LLMClientErrorCode`. No dependency on contextWindow.ts or responseParser.ts — so plan 06-06 truly only depends on plan 06-02 at the type level"
  artifacts:
    - path: "src/lib/llmClient.ts"
      provides: "callLLMProxy, LLM_FRONTEND_TIMEOUT_MS"
      exports: ["callLLMProxy", "LLM_FRONTEND_TIMEOUT_MS"]
      min_lines: 70
    - path: "src/lib/llmClient.test.ts"
      provides: "fetch mock tests for all error paths"
      min_lines: 100
  key_links:
    - from: "src/lib/llmClient.ts"
      to: "src/types/llm.ts"
      via: "HistoryEntry, LLMCallResult, LLMClientErrorCode"
      pattern: "from '@/types/llm'"
    - from: "src/lib/llmClient.ts"
      to: "/api/llm"
      via: "fetch POST with {systemPrompt, messages, maxTokens}"
      pattern: "fetch\\(['\"]\\/api\\/llm"
---

<objective>
Build the single fetch wrapper that every LLM call in the app goes through. Pure function in the sense that it returns a result rather than throwing; accepts an `AbortSignal` so the store owns cancellation lifecycle.

Purpose: Centralises the HTTP concern (URL, method, body shape, error code extraction) in one file. Store code stays focused on state atomicity; UI code never sees fetch.
Output: `llmClient.ts` + test suite mocking `fetch`.
</objective>

<execution_context>
@C:\Users\taylo\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\taylo\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/06-llm-integration/06-CONTEXT.md
@.planning/phases/06-llm-integration/06-RESEARCH.md
@src/types/llm.ts
@backend/app/routers/llm.py  # response shape + error codes reference
</context>

<tasks>

<task type="auto">
  <name>Task 1: `llmClient.ts` with fetch + AbortController + structured result mapping</name>
  <files>src/lib/llmClient.ts</files>
  <action>
    Create `src/lib/llmClient.ts`:

    ```typescript
    import type { HistoryEntry, LLMCallResult, LLMClientErrorCode } from '@/types/llm'

    export const LLM_FRONTEND_TIMEOUT_MS = 45000

    export interface LLMCallOptions {
      signal?: AbortSignal
      maxTokens?: number
    }

    export async function callLLMProxy(
      systemPrompt: string,
      messages: HistoryEntry[],
      options: LLMCallOptions = {},
    ): Promise<LLMCallResult> {
      const body = {
        systemPrompt,
        messages,
        ...(options.maxTokens != null ? { maxTokens: options.maxTokens } : {}),
      }

      let response: Response
      try {
        response = await fetch('/api/llm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: options.signal,
        })
      } catch (err) {
        // AbortController path — DOMException 'AbortError'
        if (err instanceof DOMException && err.name === 'AbortError') {
          return { ok: false, errorCode: 'ABORTED', message: 'LLM call cancelled' }
        }
        // Network failure (CORS, offline, DNS)
        return {
          ok: false,
          errorCode: 'NETWORK_ERROR',
          message: err instanceof Error ? err.message : 'Network error',
        }
      }

      // Success (200) — extract text
      if (response.ok) {
        try {
          const data = (await response.json()) as { text?: string }
          if (typeof data.text !== 'string') {
            return {
              ok: false,
              errorCode: 'INTERNAL_ERROR',
              message: 'Backend response missing text field',
            }
          }
          return { ok: true, text: data.text }
        } catch {
          return {
            ok: false,
            errorCode: 'INTERNAL_ERROR',
            message: 'Backend returned non-JSON body',
          }
        }
      }

      // Non-2xx — map backend error shape { error: { code, message } }
      try {
        const errBody = (await response.json()) as {
          error?: { code?: string; message?: string }
        }
        const code = errBody.error?.code
        const message = errBody.error?.message ?? `HTTP ${response.status}`
        // Known codes pass through; unknown → INTERNAL_ERROR
        const known: LLMClientErrorCode[] = [
          'LLM_TIMEOUT',
          'LLM_AUTH_ERROR',
          'LLM_UPSTREAM_ERROR',
          'LLM_UNREACHABLE',
          'INTERNAL_ERROR',
        ]
        const errorCode: LLMClientErrorCode =
          (known as string[]).includes(code ?? '') ? (code as LLMClientErrorCode) : 'INTERNAL_ERROR'
        return { ok: false, errorCode, message }
      } catch {
        return {
          ok: false,
          errorCode: 'INTERNAL_ERROR',
          message: `HTTP ${response.status} with unparseable body`,
        }
      }
    }
    ```

    Key points:
    - Never throws. Every error path returns a typed `LLMCallResult`.
    - `AbortError` is distinguished from general network failure.
    - Maps backend `{error: {code, message}}` → top-level `{errorCode, message}` for the store to show in the error bubble.
    - The store owns creating the `AbortController` and deciding when to abort (never cached/reused — per RESEARCH.md, new controller per call).
    - Imports `HistoryEntry` from `@/types/llm` (added in Plan 06-02) — NOT from `./contextWindow`. This keeps llmClient's only declared dependency at the type level to plan 06-02. contextWindow.ts re-exports the same type from the shared module for ergonomic imports elsewhere.
  </action>
  <verify>
    - `pnpm typecheck` passes.
    - `grep -c "throw" src/lib/llmClient.ts` returns `0` (the function never throws).
  </verify>
  <done>
    `callLLMProxy` exported with the signature above. `LLM_FRONTEND_TIMEOUT_MS` exported. Handles abort, network error, success-with-bad-body, HTTP error with backend code, HTTP error with unparseable body.
  </done>
</task>

<task type="auto">
  <name>Task 2: Test suite with mocked `fetch` covering every error path</name>
  <files>src/lib/llmClient.test.ts</files>
  <action>
    Create `src/lib/llmClient.test.ts`. Use `vi.stubGlobal('fetch', vi.fn())` to mock fetch per test.

    Cases:
    - **Happy path:** fetch resolves with `Response` (200, `{ text: 'hello' }`) → `{ ok: true, text: 'hello' }`.
    - **Success but missing text field:** fetch resolves with `{}` → `{ ok: false, errorCode: 'INTERNAL_ERROR', message: /missing text/ }`.
    - **Success but non-JSON body:** fetch resolves with body that throws on `.json()` → `INTERNAL_ERROR`.
    - **HTTP 504 with `LLM_TIMEOUT`:** fetch resolves with 504 + `{ error: { code: 'LLM_TIMEOUT', message: 'timed out' } }` → `{ ok: false, errorCode: 'LLM_TIMEOUT', message: 'timed out' }`.
    - **HTTP 401 with `LLM_AUTH_ERROR`:** similar.
    - **HTTP 502 with `LLM_UPSTREAM_ERROR`:** similar.
    - **HTTP 502 with `LLM_UNREACHABLE`:** similar.
    - **HTTP 500 with `INTERNAL_ERROR`:** similar.
    - **HTTP error with unknown backend code:** body `{ error: { code: 'WEIRD_CODE' } }` → `errorCode: 'INTERNAL_ERROR'` (known-list fallthrough).
    - **HTTP error with unparseable body:** `.json()` throws → `INTERNAL_ERROR` with `/unparseable body/` message.
    - **AbortController abort mid-flight:**
      ```typescript
      const controller = new AbortController()
      // Mock fetch to throw AbortError when signal is aborted
      vi.mocked(fetch).mockImplementation(({ signal } as any) => {
        return new Promise((_, reject) => {
          signal?.addEventListener('abort', () =>
            reject(Object.assign(new DOMException('aborted', 'AbortError')))
          )
        })
      })
      const p = callLLMProxy('sys', [], { signal: controller.signal })
      controller.abort()
      const result = await p
      expect(result).toEqual({ ok: false, errorCode: 'ABORTED', message: expect.any(String) })
      ```
    - **Network failure (fetch throws TypeError):** fetch mock `.mockRejectedValue(new TypeError('Failed to fetch'))` → `{ ok: false, errorCode: 'NETWORK_ERROR', message: 'Failed to fetch' }`.
    - **Body shape assertion:** capture the fetch call arg and assert `JSON.parse(call[1].body).systemPrompt === 'the prompt'` AND `messages.length === 2` AND `maxTokens` is absent when not passed (vs. present when passed).
    - **Never throws test:** wrap every call in `expect(() => callLLMProxy(...)).not.toThrow()`.
    - **`LLM_FRONTEND_TIMEOUT_MS === 45000`** — pinned constant test.

    Use `Response` constructor for mocked responses: `new Response(JSON.stringify(body), { status: 504 })`.
  </action>
  <verify>
    - `pnpm test src/lib/llmClient.test.ts` — all tests pass.
    - `pnpm typecheck` passes.
  </verify>
  <done>
    All 14+ cases above pass. The client's contract (never throws, returns typed result, correctly maps backend error codes, handles abort) is fully pinned.
  </done>
</task>

</tasks>

<verification>
- `pnpm test src/lib/llmClient.test.ts && pnpm typecheck` — green.
- `llmClient.ts` contains no `throw` statements.
- AbortSignal handling is covered by an async test that actually invokes `controller.abort()`.
</verification>

<success_criteria>
- `callLLMProxy` satisfies the integration contract with backend error codes defined in Phase 2.
- `LLM_FRONTEND_TIMEOUT_MS` exposed for the store to use.
- Store (Plan 06-07) can consume `callLLMProxy` with `AbortController` and get clean cancellation semantics.
</success_criteria>

<output>
After completion, create `.planning/phases/06-llm-integration/06-06-SUMMARY.md`.
</output>
