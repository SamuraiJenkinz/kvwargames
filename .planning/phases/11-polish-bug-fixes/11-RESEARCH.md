# Phase 11: Polish Bug Fixes - Research

**Researched:** 2026-04-15
**Domain:** React routing guards, Zustand/Immer store, debrief export pipeline
**Confidence:** HIGH (all findings from direct code inspection)

---

## Summary

All three bug sites were confirmed by direct code reading. The ROUTE-01/02 fix is
straightforward: remove four lines from `src/App.tsx` and delete one file. The
setState-during-render warning is a consequence of the same DEV auto-seed, not a
store defect; it disappears by construction. The DEBRIEF-01 root cause was NOT
located via static analysis — the code path from user input → `state.messages` →
`renderMessage` → markdown string contains no `.slice(1)` or off-by-one that would
drop a leading character. The planner must include a "write failing test, then trace"
task as the CONTEXT.md specifies. No additional libraries are needed.

**Primary recommendation:** One plan (11-01) in the order: (1) remove DEV auto-seed
+ delete `seedMockState.ts`, (2) diagnose DEBRIEF-01 via failing test, (3) fix bug
at located source, (4) add one regression test, (5) manual smoke.

---

## Bug Site Inventory

### Bug 1 — ROUTE-01/02: DEV auto-seed in GuardedGameScreen

**File:** `src/App.tsx`

Lines 18–33 (full function shown for planner reference):

```typescript
// App.tsx:3
import { seedMockState } from '@/mocks/seedMockState'

// App.tsx:18-33
function GuardedGameScreen() {
  const gameState = useGameStore((s) => s.gameState)

  if (gameState === null) {
    if (import.meta.env.DEV) {     // ← lines 22-28: entire block must be deleted
      seedMockState()               // ← calls store mutations during render body
      return null
    }
    return <Navigate to="/setup" replace />   // ← line 29: correct; keep as-is
  }

  return <GameScreen />
}
```

**Exact deletion scope:**
- `src/App.tsx` line 3: delete `import { seedMockState } from '@/mocks/seedMockState'`
- `src/App.tsx` lines 22–28: delete the `if (import.meta.env.DEV) { ... }` block

After deletion, `GuardedGameScreen` collapses to the correct 6-line form:

```typescript
function GuardedGameScreen() {
  const gameState = useGameStore((s) => s.gameState)
  if (gameState === null) {
    return <Navigate to="/setup" replace />
  }
  return <GameScreen />
}
```

**Confidence:** HIGH — code read directly.

---

### Bug 2 — React setState-during-render warning

**Claimed location:** `gameStore.ts:304`

Line 304 is `state.setupMode = mode` inside `setSetupMode`'s Immer `set()` callback.
This setter is correct. The React warning fires because `seedMockState()` (App.tsx:25)
calls `useGameStore.getState()` then invokes `setGameConfig`, `setGameState`,
`addMessages`, `setLoading` synchronously inside the render body of
`GuardedGameScreen`. Each `set()` call dispatches a store update during render,
which React reports as "setState called during render."

**Fix by construction:** Removing the DEV auto-seed block eliminates all
synchronous store mutations from the render path. No code change to `gameStore.ts`
is needed.

**Confidence:** HIGH — `seedMockState.ts` confirms it calls `setGameConfig`,
`setGameState`, `addMessages`, `setLoading` via `useGameStore.getState()` at lines
18–24.

---

### Bug 3 — DEBRIEF-01: R1 first-character truncation

#### What the live run showed

Phase 8 live run (`08-02-DEBRIEF-export.md` line 26):

```
**Facilitator:** ound 1 is now live. Kent, set the scene for the Council...
```

The HAR file (`08-02-network.har` line 1119) shows the LLM request body contained
the FULL string as the user message:

```json
"messages":[{"role":"user","content":"Round 1 is now live. Kent, set the scene..."}]
```

This means `llmHistory` was populated correctly. The bug is in the exported
markdown, not in the LLM pipeline.

#### Code paths ruled out by static analysis

**`responseParser.ts:106` `.slice(1)`** — BOM-strip on raw LLM response string.
This only runs on the text returned by the LLM proxy (`llmResult.text`). Facilitator
message text is never passed through `parsePersonaResponse`. Ruled out.

**`contextWindow.ts:55` `.slice(1)`** — drops leading `assistant` entry from the
`llmHistory` ARRAY when `slice(-2N)` starts on an assistant role. Operates on the
history entries array, not on any message text string. Ruled out.

**`renderMessage` in `debriefExporter.ts:108–129`** — returns
`` `**Facilitator:** ${msg.text ?? ''}` ``. No string manipulation on `msg.text`.
Ruled out as the truncation site.

**`sendFacilitatorMessage` in `gameStore.ts:609–624`** — pushes
`{ type: 'facilitator', text: trimmed }` where `trimmed = text.trim()`. The input
`"Round 1 is now live..."` trims to the same string. Ruled out.

**`MessageInput.tsx:31`** — `const trimmed = value.trim()` then
`sendFacilitatorMessage(trimmed)`. The double-trim is idempotent. Ruled out.

**`generateDebriefMarkdown` assembly (`sections.join('\n')`)**  — `roundSections`
is an array of strings joined with `'\n\n'`; no character-level manipulation.
Ruled out.

#### Root cause: NOT YET LOCATED

Static analysis found no code path that would drop the leading "R" from a
facilitator message. The bug was observed once in a live session. Possible
explanations not ruled out:

- A keyboard input edge case where the textarea captured the "R" keystroke for
  a hotkey before it reached the value state (browser/OS level).
- A race condition in the Immer store under the specific devtools serialization
  active during that live run.
- Something in `Blob` → file download → file reader that dropped the first byte
  under specific OS/browser conditions.

**What this means for the planner:** The CONTEXT.md diagnosis instruction is
correct — a failing test is the required first step. The test must assert that
`generateDebriefMarkdown` (or the `messages` array in the store) preserves the
full first character of a Round 1 facilitator message text. If that test passes
(meaning the bug is not reproducible in the pure function path), the bug is in
the browser/OS download pipeline and is cosmetic-but-elusive. If the test fails,
it will point directly at the truncation site.

**Candidate test to write (will either fail and locate the bug, or pass and
indicate the bug is outside the pure function):**

```typescript
// in src/lib/debriefExporter.test.ts
it('DEBRIEF-01 regression: R1 facilitator message text preserves leading character', () => {
  const messages: ChatMessage[] = [
    {
      id: 'f1',
      type: 'facilitator',
      text: 'Round 1 is now live. Kent, set the scene.',
      timestamp: '10:00',
    },
    {
      id: 'd1',
      type: 'debrief_divider',
      label: 'DEBRIEF',
      isDebrief: true,
      timestamp: '11:00',
    },
    {
      id: 'p1',
      type: 'persona',
      speaker: 'kent',
      text: 'Debrief response.',
      timestamp: '11:01',
    },
  ]
  const snapshot: DebriefSnapshot = {
    ...baseSnapshot,
    messages,
  }
  const md = generateDebriefMarkdown(snapshot)
  // Must NOT appear — this is the bug string
  expect(md).not.toContain('**Facilitator:** ound 1 is now live')
  // Must appear — full text preserved
  expect(md).toContain('**Facilitator:** Round 1 is now live')
})
```

**Confidence on root cause:** LOW — static analysis exhausted without finding it.

---

## seedMockState.ts Consumer Audit

`grep` across all `src/` files for `seedMockState` imports:

| File | Reference |
|------|-----------|
| `src/App.tsx:3` | `import { seedMockState }` — the only real import |
| `src/App.tsx:25` | call site |
| `src/mocks/seedMockState.ts:4,17` | definition |
| `src/components/setup/LoadConfigPanel.test.tsx:417` | comment only, no import |

**Conclusion:** `seedMockState` has exactly ONE consumer: `App.tsx`. After removing
the import and call from `App.tsx`, `src/mocks/seedMockState.ts` becomes dead code
with no imports anywhere. It is safe to delete.

Note: `src/mocks/seedMockState.ts` itself imports from:
- `@/lib/gameStore`
- `@/data/edipConfig`
- `./mockGameState` (sibling file)

Deleting `seedMockState.ts` does NOT delete `mockGameState.ts` — that file is
still imported by other tests and must be kept.

**Confidence:** HIGH

---

## Test Framework and Naming Conventions

**Framework:** Vitest 4.1.4 (confirmed in `package.json`). NOT Jest.

**Environment:** jsdom (set in `vite.config.ts` test block).

**Setup file:** `src/test/setup.ts` — imports `@testing-library/jest-dom` and
mocks `scrollIntoView`.

**Test file location:** Co-located alongside source files. No separate `__tests__/`
directory exists. Pattern: `[SourceFile].test.ts` or `[SourceFile].test.tsx`.

Examples:
- `src/lib/debriefExporter.ts` → `src/lib/debriefExporter.test.ts`
- `src/lib/gameStore.ts` → `src/lib/gameStore.test.ts`
- `src/App.tsx` → no test file exists yet (no `src/App.test.tsx`)

**For the ROUTE-01 regression test:** The existing `AppRoutes` describe block
already lives in `src/components/setup/LoadConfigPanel.test.tsx` (lines 419–438).
It already tests `/game` → `/setup` redirect with `vi.stubEnv('DEV', false)`.
After removing the DEV branch, that test still passes but `vi.stubEnv('DEV', false)`
becomes a no-op. The planner may want to update that test's comment/stub call, but
no new routing test is strictly required — the success criterion is already covered.

**For the DEBRIEF-01 regression test:** Add to
`src/lib/debriefExporter.test.ts`. The existing test file already has all the
necessary imports (`generateDebriefMarkdown`, `DebriefSnapshot`, fixture helpers).
The test should be appended in a new `describe` block or added to the
`generateDebriefMarkdown` group.

**Confidence:** HIGH

---

## Smoke Test Commands

| Purpose | Command |
|---------|---------|
| Run full test suite | `npm test` (invokes `vitest`) |
| Single-run (CI mode) | `npx vitest run` |
| Dev server | `npm run dev` (invokes `vite`) — starts on localhost:5173 by default |
| Build check | `npm run build` (invokes `tsc -b && vite build`) |

---

## Gotchas and Caveats

### React Router v6 `<Navigate replace />`

`<Navigate to="/setup" replace />` is correct React Router v6 usage. The `replace`
prop prevents a history entry so the browser back button cannot loop between
`/game` and `/setup`. This is already in the code at `App.tsx:29` and is the
correct behavior. No changes needed here.

**Gotcha:** `<Navigate>` must be returned from the render function, not called
imperatively. The current code structure (returning `<Navigate>` JSX) is correct
React Router v6 usage.

### Immer store: `set()` during render is always wrong

The reason `seedMockState()` triggers the warning is that Zustand's `set()` (even
through `getState()`) dispatches a React state update synchronously. Any call to
`useGameStore.getState()` followed by store mutations inside a render body violates
React's render purity contract. The fix (removing the call) is correct — do NOT
introduce `useEffect` wrappers as an alternative, since that would delay the seed
and introduce flicker.

### DEV import.meta.env guard

After removing the DEV branch, `import.meta.env.DEV` is still referenced elsewhere
in `gameStore.ts` (lines 258, 444, 452, 673) for dev-only console output. Those
are fine — they are NOT in render paths. The removal in `App.tsx` is surgical and
does not affect any other DEV guards in the codebase.

### `src/mocks/mockGameState.ts` must NOT be deleted

`seedMockState.ts` imports `MOCK_GAME_STATE` and `MOCK_MESSAGES` from
`src/mocks/mockGameState.ts`. This sibling file is imported by component tests
(e.g., `ChatFeed.test.tsx`, `GameScreen.test.tsx`). Only `seedMockState.ts` is
the delete target.

### Existing AppRoutes test needs minor update post-fix

`LoadConfigPanel.test.tsx:422` calls `vi.stubEnv('DEV', false)` before rendering
AppRoutes. After the DEV branch is deleted, this stub becomes a no-op (the
`import.meta.env.DEV` check in GuardedGameScreen no longer exists). The test will
still pass. The planner can choose to remove the stub call for cleanliness, or
leave it as harmless dead code.

### DEBRIEF-01: "audit all rounds" instruction from CONTEXT.md

The CONTEXT.md says to audit Rounds 2+. From code inspection: `renderMessage` is
a pure function applied identically to all rounds. If the bug is inside
`generateDebriefMarkdown`, it would affect all rounds equally. The "R1 only"
observation is most likely reporter sampling bias (R1 was the only round with a
typed-out "Round X is now live" sentence as the first user message).

---

## Open Questions

1. **DEBRIEF-01 root cause is unknown.** What we know: not in `renderMessage`,
   not in `sendFacilitatorMessage`, not in `contextWindow`, not in
   `responseParser`. What's unclear: whether the bug is in the pure function
   pipeline (reproducible in a unit test) or in the browser download path.
   **Recommendation:** write the failing test first; if it passes, document the
   bug as "browser/OS download artifact, cosmetic, not reproducible in unit
   tests" and close DEBRIEF-01 with that finding plus a note in REQUIREMENTS.md.

2. **Whether to add a new `src/App.test.tsx`** for the routing fix. Currently no
   App-level test file exists. The existing AppRoutes test in
   `LoadConfigPanel.test.tsx` covers the redirect contract. Whether to move it or
   supplement it is the planner's call — the CONTEXT.md says "one regression test
   only" and it already exists.

---

## Sources

All findings are from direct file reads. No external references needed for this
phase.

| File | Lines Read | Finding |
|------|-----------|---------|
| `src/App.tsx` | 1–63 | Bug site confirmed; deletion scope identified |
| `src/mocks/seedMockState.ts` | 1–25 | Sole consumer of `useGameStore.getState()` during render; safe to delete |
| `src/lib/gameStore.ts` | 290–310, 404–460, 516–600, 605–675 | setState warning root cause; no text manipulation on messages |
| `src/lib/responseParser.ts` | 95–124 | `.slice(1)` only on raw LLM string; ruled out for DEBRIEF-01 |
| `src/lib/contextWindow.ts` | 45–59 | `.slice(1)` on history array; ruled out for DEBRIEF-01 |
| `src/lib/debriefExporter.ts` | 1–314 | Full read; no character-level manipulation on facilitator text |
| `src/lib/debriefExporter.test.ts` | 1–260 | Test patterns, fixture structure, existing regression coverage |
| `src/components/setup/LoadConfigPanel.test.tsx` | 415–439 | Existing AppRoutes redirect test identified |
| `.planning/phases/08-qa-credential-audit/08-02-DEBRIEF-export.md` | 1–30 | Confirmed bug text verbatim |
| `.planning/phases/08-qa-credential-audit/08-02-network.har` | line 1119 | HAR confirms full text reached LLM; messages pipeline not culprit |
| `package.json`, `vite.config.ts` | all | Test framework: Vitest 4.1.4, jsdom, `npm test` |
| `src/test/setup.ts` | 1–7 | Test setup file path confirmed |

---

## Metadata

**Confidence breakdown:**
- ROUTE-01/02 bug site and fix: HIGH — code read directly, deletion scope exact
- ROUTE-01/02 regression coverage: HIGH — existing test already covers the contract
- seedMockState.ts consumer audit: HIGH — grep across all src/ files
- setState warning root cause: HIGH — confirmed causal chain through seedMockState
- DEBRIEF-01 code paths ruled out: HIGH — all `.slice` calls catalogued and traced
- DEBRIEF-01 root cause: LOW — not found; failing test required
- Test framework and conventions: HIGH — confirmed from package.json and file glob

**Research date:** 2026-04-15
**Valid until:** Stable codebase; no expiry concern for this phase's scope
