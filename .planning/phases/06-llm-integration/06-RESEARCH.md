# Phase 6: LLM Integration - Research

**Researched:** 2026-04-14
**Domain:** LLM client wiring, prompt construction, JSON parse defense, Zustand atomicity, context windowing
**Confidence:** HIGH (all findings from direct codebase inspection)

---

## Summary

Phase 6 wires the existing stub `sendFacilitatorMessage` to a real LLM call loop, builds the system prompt from live game state, defensively parses the structured JSON response, applies state updates atomically, and windows the conversation history. All foundation code (store, types, components, backend proxy) is already in place — this phase adds the five new modules and replaces three stubs.

The standard approach is: **all new modules live in `src/lib/`** (promptBuilder, llmClient, stateUpdater, contextWindow, responseParser), **wired together in `gameStore.ts`** by replacing the `sendFacilitatorMessage` / `advanceRound` / `triggerDebrief` stubs. No new backend code is required — `llm.py` is complete and correct for the Azure OpenAI endpoint shape, with one exception: the auth header is currently `Authorization: Bearer ...` but Azure uses `api-key: ...`. This needs a `llm_auth_header_name` config field.

The highest-risk work is prompt construction (3,900 token estimated system prompt must be measured empirically before locking N=6), error UX (ChatMessage type needs two new fields: `rawResponse` and `errorCode`), and the Azure auth header mismatch (currently a breaking bug for the corporate endpoint).

**Primary recommendation:** Build in this order — (1) fix Azure auth header in backend config, (2) implement stateUpdater pure function (simplest, most testable), (3) build promptBuilder (pure function, unit-testable before LLM exists), (4) implement contextWindow builder, (5) implement responseParser with defensive layers, (6) implement llmClient with AbortController, (7) wire everything into gameStore, (8) extend ErrorMessage component, (9) add state-change animations, (10) measure token budget empirically.

---

## Standard Stack

### Core (already installed — no new dependencies needed)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| zustand | 5.0.12 | Store + immer for atomic state mutation | Already installed |
| immer | 11.1.4 | Structural sharing for store mutations | Already installed — `zustand/middleware/immer` used |
| react | 19.2.5 | UI rendering with staggered persona reveal | Already installed |
| TypeScript | 6.0.2 | Type safety for LLM response shapes | Already installed |

### No new frontend dependencies required

The project has **no schema validation library** (no Zod, no Yup, no Joi). The existing pattern (`jsonValidation.ts` uses manual structural checks, not a schema library) is the project standard. Phase 6 should follow the same pattern: manual type guards in `responseParser.ts`.

`fetch` API is native in the browser — no HTTP client library needed on the frontend.

### Backend: No new dependencies required

`httpx`, `fastapi`, `pydantic-settings` already cover all needs. **Do NOT add `tiktoken`** — it requires C compilation and adds a heavyweight dependency for a single measurement use case. Token counting uses character-count approximation (see Token Budget section below).

---

## Architecture Patterns

### Recommended File Structure for Phase 6

```
src/
├── lib/
│   ├── promptBuilder.ts       # NEW — builds 10-block system prompt
│   ├── llmClient.ts           # NEW — fetch wrapper to /api/llm with AbortController
│   ├── responseParser.ts      # NEW — strip fences → JSON.parse → type guard → typed result
│   ├── stateUpdater.ts        # NEW — pure function: (GameState, StateUpdate) → GameState
│   ├── contextWindow.ts       # NEW — windowing of llmHistory to N=6 pairs
│   ├── gameStore.ts           # MODIFY — replace 3 stubs with real LLM wiring
│   ├── gameStore.test.ts      # MODIFY — add Phase 6 stub-replacement tests
│   ├── promptBuilder.test.ts  # NEW — unit tests
│   ├── stateUpdater.test.ts   # NEW — unit tests (clamping, field updates)
│   ├── responseParser.test.ts # NEW — unit tests (defensive parse cases)
│   ├── contextWindow.test.ts  # NEW — unit tests (invariant checks)
│   └── ...existing...
├── types/
│   ├── game.ts               # MODIFY — add rawResponse?, errorCode? to ChatMessage
│   └── llm.ts                # MODIFY — add LLMStructuredResponseWithControl type
└── components/game/
    ├── ChatFeed/
    │   └── ErrorMessage.tsx   # MODIFY — add collapsible raw + Retry affordance
    └── FacilitatorInput/
        └── ActionToolbar.tsx  # MODIFY — wire Advance Round + Trigger Debrief to LLM
```

**Backend: one file change only**

```
backend/app/
├── config.py     # MODIFY — add llm_auth_header_name field (default "Authorization")
└── routers/
    └── llm.py    # MODIFY — use configurable auth header name + bearer prefix logic
```

---

### Pattern 1: Pure Function State Updater

**What:** `stateUpdater.ts` is a pure function with no side effects. It takes the current state and a delta and returns a new state (already done by immer in the store, but the pure function can be tested without the store).

**When to use:** Any time LLM response parse succeeds and contains a non-null `stateUpdate`.

**Key insight:** `applyStateUpdate` already exists in `gameStore.ts` and is correct (verified by 30+ tests in `gameStore.test.ts`). Phase 6 does NOT need to rewrite clamping logic. The "stateUpdater" module is primarily for:
1. Providing a **testable pure function** that mirrors the store's `applyStateUpdate` logic
2. **Logging clamp events** (console.warn the clamped value before applying)

```typescript
// src/lib/stateUpdater.ts
import type { GameState, StateUpdate } from '@/types/game'

export interface ClampLog {
  field: string
  teamId?: string
  raw: number
  clamped: number
}

export function applyStateUpdatePure(
  state: GameState,
  update: StateUpdate,
): { nextState: GameState; clampLog: ClampLog[] } {
  // Deep clone via structuredClone (no immer needed here — this is a pure utility)
  // Returns new state + any clamping events for dev console logging
}
```

**Integration with store:** The store's `applyStateUpdate` action calls `applyStateUpdatePure` then applies the result in a single `set()` call. This achieves atomicity.

---

### Pattern 2: Defensive JSON Parse Layers

**What:** Four sequential defense layers before parsed result is trusted.

**Order:**
1. **Pre-parse cleanup:** Strip BOM (`\uFEFF`), trim whitespace, strip markdown fences (regex: `/^```(?:json)?\n?|\n?```$/gm`)
2. **JSON.parse:** Wrapped in try/catch; catch returns `{ ok: false, errorKind: 'PARSE_FAILURE' }`
3. **Type guard validation:** Manual checks — `responses` is array, length 1–3, each item has `speaker` in `['kent','finch','chen']`, `message` is string, etc.
4. **Post-validation normalization:** Sort responses by `PERSONA_ORDER`, enforce max 3 / min 1 (defensive; LLM should handle this but stateUpdater logic enforces as guard)

**Implementation module: `src/lib/responseParser.ts`**

```typescript
type ParseSuccess = { ok: true; value: LLMStructuredResponse }
type ParseFailure = { ok: false; errorKind: 'PARSE_FAILURE' | 'VALIDATION_FAILURE'; raw: string; detail: string }
export type ParseResult = ParseSuccess | ParseFailure
```

**No Zod:** The project uses manual type guards (see `jsonValidation.ts`). Zod would be the right choice for a complex validation library, but adding it as a dependency solely for Phase 6 is not justified given the existing project pattern and small surface area of the LLM response schema.

---

### Pattern 3: Atomic State Update in Zustand + Immer

**What:** Parse the full LLM response, validate it completely, THEN apply all state changes in a single `set()` call.

**Constraint confirmed from codebase:** `gameStore.ts` uses `zustand/middleware/immer` — mutations inside `set(state => { ... })` are handled by immer's `produce()`. A single `set()` call is one atomic transaction.

**Pattern:**
```typescript
// Inside gameStore.ts sendFacilitatorMessage replacement:

// 1. Call LLM (async, outside set())
const parseResult = await callAndParse(text, get())

// 2. On success: single set() call applies ALL changes atomically
if (parseResult.ok) {
  set((state) => {
    // Apply all persona messages at once
    state.messages.push(...buildPersonaMessages(parseResult.value.responses))
    // Apply state update if present (using existing applyStateUpdate logic)
    for (const resp of parseResult.value.responses) {
      if (resp.stateUpdate) {
        applyStateUpdateMutation(state, resp.stateUpdate)
      }
    }
    // Append to LLM history
    state.llmHistory.push(...)
    state.loading = false
  })
}

// 3. On failure: single set() call adds error message, does NOT touch gameState
if (!parseResult.ok) {
  set((state) => {
    state.messages.push(buildErrorMessage(parseResult))
    state.loading = false
    // gameState intentionally NOT touched
  })
}
```

**Critical immer pattern note (from STATE.md decision 05-02):** `advanceRound` captures `newRound` BEFORE calling `addMessages` because you cannot read immer draft values after `set()` completes. Same pattern applies here — capture any values needed from current state BEFORE the `set()` call.

---

### Pattern 4: LLM Client with AbortController

**What:** `llmClient.ts` wraps `fetch('/api/llm', ...)` with an `AbortController`. Retry re-creates a new `AbortController` (cannot reuse a cancelled one).

**Confirmed from codebase:** No existing LLM client exists. The `sendFacilitatorMessage` stub sets `loading = true` but never makes a fetch call. Phase 6 creates this module from scratch.

**Pattern:**
```typescript
// src/lib/llmClient.ts
export interface LLMCallOptions {
  signal?: AbortSignal
}

export async function callLLMProxy(
  systemPrompt: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  options?: LLMCallOptions
): Promise<{ ok: true; text: string } | { ok: false; errorCode: string; message: string }> {
  // fetch('/api/llm', { signal: options?.signal, ... })
  // Returns structured result, never throws
  // Distinguishes: NETWORK_ERROR, HTTP_ERROR (with code), ABORT
}
```

**Error code mapping from `llm.py`:**
- `LLM_TIMEOUT` (504) → "LLM timed out after {N}s"
- `LLM_AUTH_ERROR` (401) → "API key rejected"
- `LLM_UPSTREAM_ERROR` (502) → "Upstream LLM error {code}"
- `LLM_UNREACHABLE` (502) → "Cannot reach LLM endpoint"
- `INTERNAL_ERROR` (500) → "Server error"
- Network failure (fetch throws) → "Network error"

---

### Pattern 5: Context Window Builder

**What:** `contextWindow.ts` takes `llmHistory` (full session history stored in store) and returns the windowed slice to send to the LLM.

**Confirmed from codebase:** `llmHistory` is already in the store as `Array<{ role: 'user' | 'assistant'; content: string }>`. `appendHistory(role, content)` adds to it. The store does NOT window — it accumulates the full history. Windowing happens only at call time in `contextWindow.ts`.

**Message pair definition:** 1 user message + 1 assistant message = 1 pair. So N=6 pairs = 12 entries max in window.

**System prompt position:** NOT in `llmHistory`. Sent as `systemPrompt` field in `LLMProxyRequest`. Backend injects it as `{ role: 'system', content: body.systemPrompt }` before the messages array. This means the invariant `llmHistory.length ≤ 2×N = 12` (not 13; the `+1` in the spec refers to the system prompt in the final messages array sent to the LLM, not in `llmHistory`).

**Pruning algorithm:**
```typescript
export function windowHistory(
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  N: number = 6
): Array<{ role: 'user' | 'assistant'; content: string }> {
  // Take last 2*N entries
  // Ensure window starts on a 'user' message (don't split a pair)
  const maxEntries = N * 2
  const sliced = history.slice(-maxEntries)
  // If first entry is 'assistant', drop it (orphaned response)
  if (sliced.length > 0 && sliced[0].role === 'assistant') {
    return sliced.slice(1)
  }
  return sliced
}
```

**Round divider inclusion:** Round dividers are `ChatMessage` objects in `messages`, NOT in `llmHistory`. If the CONTEXT.md decision to "include round dividers when they fall inside the window" is to be honored, the contextWindow builder must either:
- Separately scan `messages` for round dividers in the recent window and prepend them as context strings into the user message, OR
- Treat round dividers as pseudo-messages in `llmHistory`

**Recommendation:** Store round divider context AS PART of the user message that follows the divider (i.e., when `advanceRound` triggers an LLM call, the user message content is `"[Round N start] {inject text}"`) — this is simpler and keeps `llmHistory` as pure user/assistant pairs.

---

### Pattern 6: Prompt Builder Architecture

**Decision: Frontend, in `src/lib/promptBuilder.ts`**

**Evidence:**
- `CONTEXT.md` explicitly: "frontend constructs user-visible turn prompt, backend injects system prompt?" — but then: "stateUpdater enforces rules defensively, client-side JSON parse"
- Backend `llm.py` accepts `systemPrompt` as a field in `LLMProxyRequest` — the frontend already sends the full system prompt
- WARGAME_ENGINE_DEV_SPEC.md section 9 places `promptBuilder.ts` in `src/lib/` (frontend)
- No server-side prompt construction code exists in backend — backend is a dumb proxy

**Conclusion:** All 10 blocks are built in `src/lib/promptBuilder.ts` on the frontend. The backend never sees the prompt content — it only forwards it. This is already the architecture.

**Function signature:**
```typescript
// src/lib/promptBuilder.ts
export function buildSystemPrompt(
  config: GameConfig,
  gameState: GameState
): string
```

The 10 blocks are assembled as a template literal string. Live state values (crisisSeverity, team resources) come from `gameState`. Static game data (card effects, personas, mechanics) come from `config`.

---

### Pattern 7: Action Toolbar LLM Trigger Flow

**Current state (confirmed from `ActionToolbar.tsx`):** Advance Round calls `advanceRound()` directly; Trigger Debrief calls `triggerDebrief()` directly. Both are store actions (stubs).

**Phase 6 replacement:** `advanceRound` in the store needs to:
1. Increment round counter + insert round divider (as now)
2. Build an LLM call with trigger context `"[Round N start] {inject for round N}"`
3. Follow same LLM flow as `sendFacilitatorMessage`

**Trigger type signaling to prompt:** The prompt's routing rules encode trigger detection from message content. The frontend signals trigger type by including it in the user message content (e.g., `"[ROUND_START Round 2] {inject}"`, `"[DEBRIEF_TRIGGER] {facilitator note}"`). This is simpler than a separate trigger metadata field in the API request.

**Control field handling:** The `control: { advanceRound?, triggerDebrief? }` field in the LLM JSON response (from CONTEXT.md) requires updating `LLMStructuredResponse` type in `src/types/llm.ts`:
```typescript
export interface LLMStructuredResponse {
  responses: PersonaResponse[]
  control?: {
    advanceRound?: boolean
    triggerDebrief?: boolean
  }
}
```

---

## Integration Points with Existing Code

### Files to Modify

**`src/types/game.ts`**
- Add `rawResponse?: string` and `errorCode?: string` to `ChatMessage` interface
- These support the collapsible "Show raw response" on error bubbles and distinct error bubble rendering

**`src/types/llm.ts`**
- Add `control?: { advanceRound?: boolean; triggerDebrief?: boolean }` to `LLMStructuredResponse`

**`src/lib/gameStore.ts`**
- Replace `sendFacilitatorMessage` stub with real LLM call (calls promptBuilder + contextWindow + llmClient + responseParser + stateUpdater)
- Replace `advanceRound` stub with version that also triggers LLM call after inserting round divider
- Replace `triggerDebrief` stub with version that triggers all-3-persona debrief LLM call
- Add `currentAbortController: AbortController | null` to store state (for Retry support)
- Add `lastFacilitatorInput: string` to store state (for Retry support — replay last input)
- Add `pendingControlBanner: { type: 'advanceRound' | 'triggerDebrief' } | null` to store state (for non-blocking confirmation banner)

**`src/components/game/ChatFeed/ErrorMessage.tsx`**
- Extend to show: plain-English error reason, collapsible "Show raw response" (uses `message.rawResponse`), Retry button (calls `useGameStore(s => s.retryLastMessage)`)
- The component is currently minimal (10 lines) — this is the Phase 6 extension point explicitly designed for this

**`src/components/game/FacilitatorInput/ActionToolbar.tsx`**
- Add "Request Debrief Now" button (currently missing from the component — spec says it should be there)

**`src/components/game/StatePanel/TrackBar.tsx`**
- Currently uses `transition-[width] duration-300 ease-out` — this already implements the 400ms transition requirement. No change needed.
- For delta ghost-text: this needs to be added at `StatePanel.tsx` level (parent), NOT inside TrackBar, because TrackBar has no previous-value knowledge

**`src/components/game/StatePanel/TeamCard.tsx`**
- Currently static rendering — pulse/flash on changed cells requires tracking previous team state
- Approach: `useRef` for previous team state + CSS animation class applied conditionally on change

**`backend/app/config.py`**
- Add `llm_auth_header_name: str = "Authorization"` (see Azure auth section below)
- Add `llm_auth_value_prefix: str = "Bearer "` (configurable to empty string for `api-key` style)

**`backend/app/routers/llm.py`**
- Replace hardcoded `"Authorization": f"Bearer {settings.llm_api_key}"` with:
  `settings.llm_auth_header_name: f"{settings.llm_auth_value_prefix}{settings.llm_api_key}".strip()`

### Phase 5 Extension Points (confirmed working)

- `loading` boolean → `ChatFeed.tsx` already renders `<LoadingIndicator>` when `loading=true`. Phase 6 just sets `loading=true` at LLM call start and `loading=false` on completion/error. ✅
- `sendFacilitatorMessage` signature `(text: string) => void` → Phase 6 replaces the function body, signature stays. ✅
- `useStickyBottomScroll` → accepts `loading` as dependency, already handles staggered inserts via `messages.length` dependency. ✅
- `PersonaMessage` → already renders `message.flag` when present. ✅
- `ErrorMessage` → exists but needs extension for collapsible raw + Retry.

---

## Azure OpenAI Auth Header — Critical Bug

**Finding:** `llm.py` line 77 hardcodes `"Authorization": f"Bearer {settings.llm_api_key}"`. The corporate Azure OpenAI endpoint documented in STATE.md uses `api-key` header (not `Authorization: Bearer`).

**Evidence from sample config:**
```
AZURE_OPENAI_ENDPOINT=https://stg1.mmc-dallas-int-non-prod-ingress.mgti.mmc.com/coreapi/openai/v1/deployments/...
AZURE_OPENAI_API_KEY=1a9...
```

Azure OpenAI REST API uses `api-key: {key}` for direct key auth, not `Authorization: Bearer {key}`. The `Bearer` pattern is for Azure AD token auth.

**LLM_EXTRA_HEADERS workaround:** The existing `llm_extra_headers` mechanism CANNOT override the hardcoded `Authorization` header because Python dict merge with `**settings.get_extra_headers()` comes AFTER the `Authorization` key is set, and duplicate keys in dict literals are the SECOND value winning — but the headers dict construction is `{"Authorization": ..., "Content-Type": ..., **extra}`, so `llm_extra_headers` CAN override Authorization if set to `{"Authorization": "..."}`. However, this is a workaround, not a clean solution.

**Recommended fix:**
```python
# config.py additions
llm_auth_header_name: str = "Authorization"
llm_auth_value_prefix: str = "Bearer "  # Set to "" for api-key style auth

# llm.py change
auth_value = f"{settings.llm_auth_value_prefix}{settings.llm_api_key}".strip()
headers = {
    settings.llm_auth_header_name: auth_value,
    "Content-Type": "application/json",
    **settings.get_extra_headers(),
}
```

**Corporate endpoint env vars would be:**
```
LLM_API_KEY=1a9...
LLM_ENDPOINT_URL=https://stg1.mmc-dallas-int-non-prod-ingress.mgti.mmc.com/coreapi/openai/v1/deployments/mmc-tech-gpt-4o-mini-128k-2024-07-18/chat/completions
LLM_MODEL=gpt-4
LLM_AUTH_HEADER_NAME=api-key
LLM_AUTH_VALUE_PREFIX=
LLM_TIMEOUT_SECONDS=60
```

**Response shape confirmed:** The endpoint URL path ends in `/chat/completions` (standard Azure OpenAI completions). The `choices[0].message.content` extraction path in `llm.py` line 91 is correct for Azure OpenAI. No change needed to response extraction.

---

## Token Budget

**Measurement approach (no tiktoken):** Character count ÷ 4 is the standard approximation (works for English prose; code is slightly more tokens-per-character). Build `promptBuilder.ts` with a `measurePromptTokens(prompt: string): number` utility that returns `Math.ceil(prompt.length / 4)`.

**Empirical measurement plan (Plan 06-06):** Call `buildSystemPrompt(EDIP_CONFIG, mockGameState)` and log token estimate to console. Compare against the corporate deployment's context limit.

**Current estimates from codebase analysis:**

| Component | Chars | Approx Tokens |
|-----------|-------|---------------|
| 10 structural blocks (instructions) | ~12,000 | ~3,000 |
| Config data (teams × personas × unique actions) | ~8,000 | ~2,000 |
| Card effects (11 cards × ~200 chars each) | ~2,200 | ~550 |
| Mechanics + objectives | ~2,000 | ~500 |
| **Total system prompt** | ~24,200 | **~6,050** |
| N=6 history (12 messages, ~250 tokens avg) | — | ~3,000 |
| Current user message | — | ~100 |
| **Grand total per call** | — | **~9,150** |

**Context window safety:**
- `gpt-4o-mini 128k`: Comfortable — system prompt is ~5% of window
- `gpt-4 8k` (mmc deployment shows `gpt-4`): MARGINAL — system prompt alone exceeds the 8k limit. At 6,050 system + 3,100 history = 9,150 total, this EXCEEDS 8k.
- `gpt-4 32k`: Comfortable

**Risk:** The `AZURE_OPENAI_DEPLOYMENT=gpt-4` in the sample config suggests a base gpt-4 (8k context) deployment, NOT gpt-4-32k or gpt-4o. **This is a real risk.**

**Mitigation strategy for Plan 06-06:**
1. Measure actual prompt tokens empirically
2. If > 6,000 tokens for system prompt, consider compacting blocks 3–5 (teams/cards/mechanics can be JSON-formatted rather than natural language — more dense)
3. `LLM_MAX_TOKENS=2048` (current default) is the OUTPUT budget; confirm the corporate deployment's INPUT context limit
4. If 8k is confirmed, N=6 may need to drop to N=3 OR the system prompt must be compressed

---

## Error Bubble Extension

**Current `ErrorMessage.tsx`:** 10 lines, renders `message.text`, uses `bg-crisis-security` red styling. No collapsible or Retry.

**Required changes to `ChatMessage` type:**
```typescript
// src/types/game.ts additions
export interface ChatMessage {
  // ... existing fields ...
  rawResponse?: string    // For collapsible "Show raw response" on error bubbles
  errorCode?: string      // 'PARSE_FAILURE' | 'LLM_TIMEOUT' | 'LLM_UPSTREAM_ERROR' | etc.
  retryInput?: string     // The facilitator input to replay on Retry
}
```

**ErrorMessage component design (per CONTEXT.md):**
- Plain-English reason (from `message.text`, already)
- Collapsible "Show raw response" (`<details><summary>`) — uses `message.rawResponse`
- Inline Retry button — calls `useGameStore(s => s.retryLastMessage)` where `retryLastMessage` replays `message.retryInput` through the full LLM flow

**Retry implementation:** Store tracks `lastFacilitatorInput` (string). Retry re-creates `AbortController` and calls the full LLM flow with the same input. The store action `retryLastMessage` is the clean API.

**Whether to extract shared component vs inline per type:** Keep a single `ErrorMessage` component, add optional props for `rawResponse`, `retryInput`. The `type` field on `ChatMessage` routes to this single component in `ChatFeed.tsx`.

---

## State Change Animations

**TrackBars (already animate):** `TrackBar.tsx` already uses `transition-[width] duration-300 ease-out` via Tailwind. When `applyStateUpdate` updates `gameState.crisisSeverity` or `gameState.edipLegitimacy`, React re-renders TrackBar with new value → CSS transition fires automatically. **No code change needed for bar animation.**

**Delta ghost-text:** Requires `useRef` for previous value + local state for display. Best placed at the `StatePanel.tsx` level where all values are visible:
```typescript
// Track previous gameState for delta calculation
const prevGameStateRef = useRef<GameState | null>(null)
// On each render, compare current vs prev to compute deltas
```

**Cell pulse/flash:** Add a CSS animation class (`animate-pulse-once`) to any TeamCard field that changed. Requires prev-value tracking in `TeamCard.tsx` (or passed as prop from StatePanel).

**Pattern for prev-value tracking:**
```typescript
const prevRef = useRef(currentValue)
useEffect(() => { prevRef.current = currentValue }, [currentValue])
const hasChanged = prevRef.current !== currentValue && /* after first render */
```

**No new Tailwind tokens needed** — `bg-crisis-security/10`, `bg-persona-kent/8` etc. already exist for pulse effects.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Schema validation of LLM response | Custom DSL or complex validator | Manual type guards (project pattern) | Consistent with `jsonValidation.ts`; Zod is an unnecessary dep for a 7-field struct |
| Token counting | Server-side tiktoken integration | `Math.ceil(prompt.length / 4)` approximation | Close enough for budget estimation; no new deps |
| Retry-with-exponential-backoff | Custom retry loop | Single retry on user click only | Overcomplicated for a facilitator tool; user controls retry timing |
| LLM streaming | SSE implementation | Single response fetch | Locked in CONTEXT.md; no streaming |
| AbortController management outside component | Global singleton | New AbortController per LLM call in store | Simpler; store owns lifecycle |
| Context window summary | Summarize-dropped-turns compression | Sliding window, no summary | Locked in CONTEXT.md for Phase 6 |

---

## Common Pitfalls

### Pitfall 1: Immer Draft Access After `set()` Completes
**What goes wrong:** Reading `state.gameState.round` after calling `set(state => { state.gameState.round++ })` returns the OLD value in Zustand 5 with immer middleware.
**Why it happens:** The immer draft is finalised inside `set()`; after the call, `get()` returns the new state but the draft reference is dead.
**How to avoid:** Capture any values needed from current state BEFORE the `set()` call, not after. Already documented in STATE.md from the `advanceRound` fix (05-02).
**Warning sign:** Stale round number appearing in round divider labels.

### Pitfall 2: Tailwind Template Literal Class Names Being Purged
**What goes wrong:** Dynamic class generation like `bg-${persona}-color/8` is purged by Tailwind v4 at build time.
**Why it happens:** Tailwind v4 scans for literal class strings only.
**How to avoid:** All conditional classes must be pre-baked strings. Already established in the project (PERSONA_META.bubbleClass, CAT_CHIP_CLASS lookup). Phase 6 animation classes must also be pre-baked.
**Warning sign:** Styles work in dev (JIT sees dynamic classes) but break in production build.

### Pitfall 3: Staggered Message Inserts Breaking Sticky Scroll
**What goes wrong:** `useStickyBottomScroll` triggers on `messages.length` change. If messages are added one-by-one with setTimeout stagger, each add fires a scroll check. If the user has scrolled up between stagger intervals, scroll position jumps unexpectedly.
**Why it happens:** The hook uses `useLayoutEffect` on `[dependencyList.length, loading]` — fires synchronously before paint on every length change.
**How to avoid:** Insert all persona messages in a single `addMessages()` call (Phase 5 API already exists). Then use CSS animation delay (e.g., `animation-delay: calc(index * 500ms)`) for the stagger visual, NOT sequential setTimeout state updates. This way `messages.length` only changes once.
**Warning sign:** Chat feed jumps when new messages arrive while user is scrolled up.

### Pitfall 4: Azure OpenAI API Version Query Parameter
**What goes wrong:** Standard Azure OpenAI endpoints require `?api-version=2023-05-15` as a query parameter. If the corporate proxy URL already includes this in the path (as suggested by the sample URL structure), the backend's `POST` to `settings.llm_endpoint_url` will work. If the URL does NOT include it, the request will fail with 400.
**Why it happens:** Azure OpenAI requires `api-version` as a query param in the URL.
**How to avoid:** The sample env var `AZURE_OPENAI_ENDPOINT=.../chat/completions` is the full URL (no api-version shown). Verify with the ops team whether the corporate proxy injects api-version automatically or if it must be in the URL. If needed, add `llm_api_version: str = ""` to `config.py` and append `?api-version={value}` to the URL if set.
**Warning sign:** 400 Bad Request from the LLM endpoint.

### Pitfall 5: `sendFacilitatorMessage` Is Called from `MessageInput.tsx` — It Must Remain Synchronous at the Call Site
**What goes wrong:** `MessageInput.tsx` calls `sendFacilitatorMessage(trimmed)` and then `setValue('')` synchronously. If the store action becomes async, the textarea clears but loading state might not be set yet, causing a flash.
**Why it happens:** Store actions are synchronous in Zustand — they can't be `async` directly.
**How to avoid:** Keep `sendFacilitatorMessage` as a synchronous function that: (1) adds the facilitator message, (2) sets `loading=true`, (3) fires a non-awaited async function. The async work runs in the background. This is the existing stub pattern — just replace the no-op with a real async invocation.

### Pitfall 6: `llmHistory` Grows Unboundedly in the Store
**What goes wrong:** `appendHistory` adds to `llmHistory` without limit. By Round 5 of Scenario 2 (5 rounds, 3+ facilitator messages per round = 15+ turns), `llmHistory` could be 30+ entries.
**Why it happens:** The store is designed to accumulate the full session history (for future export). Windowing happens only at call time.
**How to avoid:** Windowing is already architecturally correct — `contextWindow.ts` takes the full `llmHistory` and returns the windowed slice. The store accumulates; the call site windows. This is the right design.
**Warning sign:** Would only matter if the store was windowed in place (which it is not).

---

## Open Risks

### Risk 1: gpt-4 8k Context Limit (HIGH PROBABILITY)
**What we know:** Sample config shows `AZURE_OPENAI_DEPLOYMENT=gpt-4`. Standard gpt-4 is 8,192 tokens. Estimated system prompt is ~6,050 tokens. With N=6 history, total could reach ~9,150 tokens.
**What's unclear:** Whether the corporate endpoint is base gpt-4 (8k), gpt-4-32k, or gpt-4o-mini-128k. The URL mentions `gpt-4o-mini-128k-2024-07-18` but the deployment env var says `gpt-4`.
**Recommendation:** Plan 06-06 (token measurement) must query the ops team for the actual context limit. If 8k is confirmed, reduce system prompt via JSON compaction of blocks 3-5, and reduce N from 6 to 3. Add a `LLM_CONTEXT_WINDOW` env var (default: 128000) to config.py and expose it to the frontend via a new `/api/config` endpoint, OR hardcode the compact-prompt threshold in `promptBuilder.ts`.

### Risk 2: Azure Auth Header Mismatch (CONFIRMED BUG)
**What we know:** `llm.py` uses `Authorization: Bearer`. Azure OpenAI REST uses `api-key`.
**Recommendation:** Fix in the first plan of Phase 6 (backend config change). Unblocks all LLM testing.

### Risk 3: Corporate Proxy Timeout vs LLM Generation Time
**What we know:** `LLM_TIMEOUT_SECONDS` defaults to 60 in `config.py`. `httpx.AsyncClient` is created with `httpx.Timeout(settings.llm_timeout_seconds)` in `main.py`. This means the frontend's `fetch()` will wait up to 60 seconds.
**What's unclear:** Whether the corporate proxy has a shorter timeout (est. 30s from STATE.md).
**Recommendation:** `AbortController` in `llmClient.ts` with a frontend-side timeout of 45s (conservative). If the backend returns 504, the frontend error handler receives the error and renders the timeout error bubble. Add `LLM_FRONTEND_TIMEOUT_MS: 45000` constant in `src/lib/llmClient.ts` for easy adjustment.

### Risk 4: LLM Persona Voice Quality
**What we know:** This is a prompt engineering risk, not a code risk.
**What's unclear:** Whether gpt-4o-mini (or gpt-4) at the corporate endpoint maintains distinct Kent/Finch/Chen voices reliably across 5 rounds.
**Recommendation:** Out of Phase 6 scope for the first pass. Include a "raw response" inspector for facilitators to audit, which is already locked in CONTEXT.md.

### Risk 5: staggered reveal vs single `addMessages()` insert
**What we know:** CONTEXT.md says "UI reveals each persona bubble sequentially with ~500ms stagger."
**Decision required:** Must use CSS animation-delay (static, no state updates) rather than sequential setTimeout. Single `addMessages([kent, finch, chen])` call, each ChatMessage gets an `animationDelay` or an index that maps to CSS keyframe delay. This avoids the sticky-scroll pitfall.
**Recommendation:** Add optional `revealDelay?: number` field to `ChatMessage` (ms). `PersonaMessage.tsx` applies it as `style={{ animationDelay: '${message.revealDelay ?? 0}ms' }}` to the existing `messageIn` animation. No new Tailwind tokens needed.

---

## Concrete Recommendations Per Open Question

1. **Prompt builder location** → `src/lib/promptBuilder.ts` (frontend). No backend changes to prompt logic.

2. **State updater module design** → Pure function `applyStateUpdatePure(state, update) → { nextState, clampLog }`. Integrate with store's `applyStateUpdate` by calling this and merging result in single `set()` call. Clamping constants already in store (inline) — extract to a shared `CLAMP_RANGES` const in `stateUpdater.ts`.

3. **Context window builder** → `contextWindow.ts` pure function. `llmHistory` in Zustand store accumulates full session. Windowed slice computed at call time. Round dividers encoded in user message content (not as separate history entries).

4. **LLM client** → `src/lib/llmClient.ts` using `fetch` + `AbortController`. New controller per call. Retry passes `retryInput` from store via `retryLastMessage` action. Returns structured success/failure (never throws).

5. **JSON parse defense** → Three layers in `src/lib/responseParser.ts`: strip fences → JSON.parse → manual type guard. No Zod. Return `ParseResult` discriminated union.

6. **Action toolbar triggers** → Signal trigger type via user message content prefix (`"[ROUND_START Round 2] {inject}"`). No separate API field. Prompt routing rules detect these patterns.

7. **Atomicity** → All messages + state update applied in a single `set(state => { ... })` call. Parse completely before any `set()`. Store action is synchronous wrapper around async operation.

8. **Error bubble component** → Single `ErrorMessage` component extended with optional `rawResponse` + `retryInput` fields on `ChatMessage`. Show collapsible `<details>` for raw response, Retry button calls `retryLastMessage` store action.

9. **Token measurement** → `Math.ceil(prompt.length / 4)` approximation in `promptBuilder.ts`. Log in dev console. No tiktoken.

10. **Azure OpenAI auth** → Add `llm_auth_header_name` + `llm_auth_value_prefix` to `config.py`. Fix `llm.py` header construction. `api-key` header (no prefix) for Azure.

---

## Code Examples

### responseParser.ts — Fence Stripping + Parse

```typescript
// Source: project convention (mirrors jsonValidation.ts pattern)
const FENCE_RE = /^```(?:json)?\s*\n?|\n?\s*```$/gm

export function parsePersonaResponse(raw: string): ParseResult {
  // Layer 1: pre-parse cleanup
  const cleaned = raw
    .replace(/^\uFEFF/, '')   // Strip BOM
    .trim()
    .replace(FENCE_RE, '')    // Strip ```json ... ``` fences
    .trim()

  // Layer 2: JSON.parse
  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch (err) {
    return {
      ok: false,
      errorKind: 'PARSE_FAILURE',
      raw,
      detail: err instanceof Error ? err.message : 'JSON parse error',
    }
  }

  // Layer 3: type guard validation
  if (!isLLMStructuredResponse(parsed)) {
    return {
      ok: false,
      errorKind: 'VALIDATION_FAILURE',
      raw,
      detail: 'Response missing required field: responses[]',
    }
  }

  return { ok: true, value: parsed }
}
```

### contextWindow.ts — Invariant

```typescript
// Source: CONTEXT.md decision, CTX-02
export const HISTORY_WINDOW_N = 6

export function windowHistory(
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  n: number = HISTORY_WINDOW_N,
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const maxEntries = n * 2
  const sliced = history.slice(-maxEntries)
  // Invariant: window must start on a user message
  if (sliced.length > 0 && sliced[0].role === 'assistant') {
    return sliced.slice(1)
  }
  // Post-condition: sliced.length <= 2*N (and is even unless edge case above)
  return sliced
}
```

### Atomic store update pattern

```typescript
// Source: gameStore.ts existing pattern + Phase 6 requirement
// This is the pattern for sendFacilitatorMessage replacement:

sendFacilitatorMessage: async (text: string) => {
  const trimmed = text.trim()
  if (!trimmed || get().loading) return

  // 1. Synchronously add facilitator message + set loading
  set((state) => {
    state.messages.push(buildFacilitatorMessage(trimmed))
    state.loading = true
  })

  // 2. Build prompt + window history (outside set())
  const { gameConfig, gameState, llmHistory } = get()
  if (!gameConfig || !gameState) { set(s => { s.loading = false }); return }

  const systemPrompt = buildSystemPrompt(gameConfig, gameState)
  const windowedHistory = windowHistory(llmHistory)

  // 3. Call LLM (async, outside set())
  const llmResult = await callLLMProxy(systemPrompt, [
    ...windowedHistory,
    { role: 'user', content: trimmed },
  ])

  if (!llmResult.ok) {
    // 4a. Failure: single set() adds error message, does NOT touch gameState
    set((state) => {
      state.messages.push(buildErrorMessage(llmResult, trimmed))
      state.loading = false
    })
    return
  }

  const parseResult = parsePersonaResponse(llmResult.text)

  if (!parseResult.ok) {
    // 4b. Parse failure: same pattern
    set((state) => {
      state.messages.push(buildParseErrorMessage(parseResult, trimmed))
      state.loading = false
    })
    return
  }

  // 5. Success: single set() applies ALL changes atomically
  set((state) => {
    // Add all persona messages at once (single addMessages equivalent)
    const personaMsgs = parseResult.value.responses.map((r, i) =>
      buildPersonaMessage(r, i * 500) // revealDelay for CSS stagger
    )
    state.messages.push(...personaMsgs)

    // Apply state update (inline clamping per existing applyStateUpdate logic)
    for (const resp of parseResult.value.responses) {
      if (resp.stateUpdate) {
        applyStateUpdateMutation(state, resp.stateUpdate)
        // Log clamps to dev console
      }
    }

    // Append to LLM history
    state.llmHistory.push({ role: 'user', content: trimmed })
    state.llmHistory.push({ role: 'assistant', content: llmResult.text })
    state.loading = false
  })
},
```

---

## Sources

### Primary (HIGH confidence — direct codebase inspection)
- `C:\KVWarGame\backend\app\routers\llm.py` — backend proxy implementation, auth header, response extraction
- `C:\KVWarGame\backend\app\config.py` — settings model, env var names
- `C:\KVWarGame\src\lib\gameStore.ts` — store interface, stubs, existing clamping in `applyStateUpdate`
- `C:\KVWarGame\src\types\game.ts` — `ChatMessage`, `StateUpdate`, `GameState` interfaces
- `C:\KVWarGame\src\types\llm.ts` — `LLMRequest`, `LLMStructuredResponse`, `PersonaResponse`
- `C:\KVWarGame\src\lib\jsonValidation.ts` — manual type guard pattern (no Zod precedent)
- `C:\KVWarGame\src\components\game\ChatFeed\ErrorMessage.tsx` — current error bubble (minimal, needs extension)
- `C:\KVWarGame\src\components\game\ChatFeed\ChatFeed.tsx` — loading state rendering, message routing
- `C:\KVWarGame\src\components\game\FacilitatorInput\ActionToolbar.tsx` — Advance Round / Trigger Debrief call site
- `C:\KVWarGame\src\components\game\FacilitatorInput\MessageInput.tsx` — sendFacilitatorMessage call site
- `C:\KVWarGame\src\components\game\StatePanel\TrackBar.tsx` — existing CSS transition (already animates)
- `C:\KVWarGame\src\data\edipConfig.ts` — full game config, 22,169 chars
- `C:\KVWarGame\package.json` — no Zod, no validation lib, confirmed
- `C:\KVWarGame\.planning\phases\06-llm-integration\06-CONTEXT.md` — locked decisions
- `C:\KVWarGame\.planning\STATE.md` — prior phase decisions, known pitfalls
- `C:\KVWarGame\WARGAME_ENGINE_DEV_SPEC.md` — original spec for `promptBuilder.ts`, `stateUpdater.ts`, `llmClient.ts`

### Secondary (MEDIUM confidence)
- Azure OpenAI REST API auth header pattern (`api-key` vs `Authorization: Bearer`) — from training data, verified consistent with sample endpoint URL structure
- Token estimation (~4 chars/token for English prose) — industry standard approximation, no exact measurement

---

## Metadata

**Confidence breakdown:**
- Backend architecture (auth fix, config change): HIGH — codebase evidence
- Frontend module architecture (where files go, how they wire): HIGH — spec + codebase evidence
- JSON parse defense pattern: HIGH — consistent with project's existing jsonValidation.ts approach
- Zustand atomicity pattern: HIGH — immer middleware behavior confirmed, prior State.md decisions documented
- Token budget estimate: MEDIUM — character count is empirical, token conversion is approximate
- Azure auth header fix: HIGH — code shows `Bearer` pattern, Azure spec uses `api-key`; must verify with ops team
- Stagger animation via CSS delay: HIGH — avoids sticky-scroll pitfall, no new deps
- Context window algorithm: HIGH — straightforward slice + pair-alignment

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (30 days; stack is stable)
