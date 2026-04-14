# Phase 4: Setup Screen - Research

**Researched:** 2026-04-13
**Domain:** React Router v7, JSON editing UX, debounce patterns, route guards
**Confidence:** HIGH for routing/guards/debounce; MEDIUM for JSON error location; HIGH for appPhase decision

---

## Summary

Phase 4 introduces React Router into a project that currently has no router at all — `main.tsx` renders `<App />` directly. The store already has `appPhase: 'setup' | 'game' | 'debrief'` and `setupMode: 'home' | 'load' | 'brief' | 'review'`, but adding React Router makes URL the canonical navigation source, which creates a duplication question that must be resolved cleanly.

The standard approach for this phase: install `react-router` (v7, single package), wrap at `main.tsx`, define flat `/setup` and `/game` routes in `App.tsx`, guard `/game` with an inline `<Navigate>` check against `gameState`, and debounce the JSON textarea parse with a `useEffect` + `setTimeout` cleanup. For the JSON editor, a plain `<textarea>` with a CSS line-number gutter and a character-offset-to-line-number conversion function is the correct choice given the zero-dep constraint and the light editing use case. `jsonc-parser` provides reliable line/column error location if the plain-error-string approach proves fragile.

**Primary recommendation:** React Router v7 (`react-router` package) with flat routes, `<Navigate replace>` guard, and a plain textarea JSON editor — no additional UI library dependencies required for this phase.

---

## 1. React Router v7 Integration

### Package

React Router v7 consolidated `react-router-dom` and `react-router` into a single package:

```bash
npm install react-router
```

All imports come from `"react-router"` (not `"react-router-dom"`). The package is currently at **v7.14.x**.

**Confidence:** HIGH — verified against official React Router installation docs.

### Where to Mount BrowserRouter

Mount `<BrowserRouter>` in `main.tsx`, wrapping `<App />`. This keeps `App.tsx` clean for route definitions:

```tsx
// main.tsx
import { BrowserRouter } from "react-router";
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
```

`App.tsx` then contains `<Routes>` + `<Route>` definitions only. This is the pattern in React Router v7 official docs.

**Confidence:** HIGH — from official declarative mode installation docs.

### Flat Routes vs Outlet/Nested Routes

For this project, **flat routes** are correct. `/setup` and `/game` are fully independent screens with no shared layout chrome at the router level. A layout route (path-less `<Route element={<Shell/>}>`) is unnecessary overhead when each screen owns its own chrome.

```tsx
// App.tsx
import { Routes, Route, Navigate } from "react-router";
import SetupScreen from "@/components/setup/SetupScreen";
import GameScreen from "@/components/game/GameScreen";
import { useGameStore } from "@/lib/gameStore";

function GameGuard() {
  const gameState = useGameStore((s) => s.gameState);
  if (!gameState) return <Navigate to="/setup" replace />;
  return <GameScreen />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/setup" element={<SetupScreen />} />
      <Route path="/game" element={<GameGuard />} />
      <Route path="*" element={<Navigate to="/setup" replace />} />
    </Routes>
  );
}
```

The catch-all `path="*"` redirects `/`, unknown paths, etc. to `/setup`.

**Confidence:** HIGH — standard React Router v7 declarative pattern.

### Null gameState Guard

The canonical idiom is an **element-level inline check**, not a loader, not a custom `<ProtectedRoute>` wrapper (though a wrapper is fine too). The minimal form:

```tsx
function GameGuard() {
  const gameState = useGameStore((s) => s.gameState);
  if (!gameState) return <Navigate to="/setup" replace />;
  return <GameScreen />;
}
```

Using `replace` (not `push`) is critical — it prevents the user from hitting Back and re-entering `/game` without state. No loading state is needed here because Zustand state is synchronous.

**Confidence:** HIGH — from React Router official docs on Navigate component.

### Page Refresh at /game

On a hard refresh at `/game`:
1. Zustand store rehydrates to initial state (gameState = null).
2. `GameGuard` renders, sees null, returns `<Navigate to="/setup" replace />`.
3. User sees setup screen.

This is correct behaviour per the spec. No extra work needed.

**SPA 404 on refresh (dev/preview):** Vite's default `appType: 'spa'` already serves `index.html` for unmatched routes in both the dev server and preview server. No additional vite.config changes are needed. The existing `vite.config.ts` does not set `appType`, which defaults to `'spa'`, so this works out of the box.

**Confidence:** HIGH — verified in Vite shared-options docs (appType:'spa' is the default and enables SPA HTML fallback).

---

## 2. AppPhase vs React Router — Resolution

The store currently has:
- `phase: AppPhase` (`'setup' | 'game' | 'debrief'`)
- `setupMode: SetupMode` (`'home' | 'load' | 'brief' | 'review'`)
- `setPhase()` / `setSetupMode()`

With React Router added, there are two navigation mechanisms. The key question: which is source of truth?

**Recommendation: URL is source of truth for top-level screen (`/setup` vs `/game`). `setupMode` in Zustand remains for sub-navigation within setup.**

Rationale:
- `phase` (`'setup' | 'game' | 'debrief'`) maps 1:1 to URL routes. Keeping it in the store alongside the URL creates synchronisation debt (two things that must always agree).
- `setupMode` (`'home' | 'load' | 'brief' | 'review'`) is sub-navigation *within* `/setup`. It does not need a URL segment for Phase 4 (context decision: no URL for home vs load panel). This lives correctly in Zustand.
- React Router docs explicitly state that URL should be the source of truth for navigation state; in-memory state for ephemeral/local UI state only.

**What to do with `phase`:**
- `initGame` currently sets `state.phase = 'game'` and `resetGame` sets `state.phase = 'setup'`. With React Router, those `setPhase` mutations should be replaced with `useNavigate()` calls at the call site. The `phase` field and `setPhase` action can be removed from the store, or left as dead code in Phase 4 and cleaned up later. **Do not keep both in sync — pick one.**
- Simplest safe path for Phase 4: remove `phase` from store, use `useNavigate('/game')` in the launch handler, use `useNavigate('/setup')` in reset. `setupMode` stays.

**Confidence:** MEDIUM — React Router state management docs are clear on URL-as-truth; the specific Zustand integration pattern is inferred from those principles. No official Zustand+RR7 integration guide was found.

---

## 3. JSON Editor Approach

### Options Evaluated

| Option | Bundle cost | Line-jump UX | Syntax highlight | Verdict |
|--------|-------------|-------------|-----------------|---------|
| Plain `<textarea>` + CSS gutter | ~0 KB | Needs manual cursor set via `selectionStart` | None | **Recommended** |
| `react-simple-code-editor` + PrismJS | ~15–25 KB gzipped total | Highlight-overlay approach; cursor jump possible | Basic JSON | Acceptable if highlighting desired |
| Monaco Editor | ~2 MB+ | Full IDE | Full | Overkill |
| CodeMirror 6 | ~100–200 KB | Full | Full | Overkill |

**Context decision (locked): "plain textarea + monospace + line-number gutter unless syntax highlighting is effectively free."**

`react-simple-code-editor` is NOT free — it requires PrismJS (a separate language grammar bundle) and the overlay approach has a known performance problem with large documents. The EDIP JSON is ~200–300 lines, which is within comfortable range, but the 15–25 KB gzipped cost plus PrismJS is not "effectively free."

**Recommendation: plain textarea.** The EDIP JSON is not arbitrary user text — facilitators will paste and lightly edit it, not author it from scratch. Monospace font + line numbers is sufficient for that workflow.

**Confidence:** MEDIUM — react-simple-code-editor npm page 403'd; bundle size estimate is from training knowledge and WebSearch snippets. The "not optimised for large documents" claim appears on the react-simple-code-editor GitHub. Treat as MEDIUM, but the zero-dep plain textarea is demonstrably safe.

### Plain Textarea Line-Number Gutter Pattern

A CSS flexbox approach: a read-only `<pre>` element on the left generates line numbers; the `<textarea>` is on the right. Both must have matching `font-size`, `line-height`, and `padding`. Scroll synchronisation requires an `onScroll` handler that sets `scrollTop` of the gutter equal to the textarea's `scrollTop`.

This is ~30 lines of React code, zero deps. The gutter does not need to be pixel-perfect — it just needs to visually track line count and scroll position.

**Confidence:** MEDIUM — well-documented pattern on multiple tutorials (Webtips, Medium) and CodePen examples. No library needed.

---

## 4. JSON Parse + Error Location

### Native JSON.parse Error Format

Modern V8 (Chrome/Chromium) encodes line and column in the **error message string** in the format:

```
SyntaxError: Unexpected token '}' at line 12 column 5 of the JSON data
```

or (older V8):

```
SyntaxError: Unexpected token } in JSON at position 107
```

The newer format ("at line X column Y") is available in recent V8 builds but is **not standardised** — the exact format varies by engine and engine version. A TC39 proposal to add structured `.line` / `.column` / `.offset` properties to `SyntaxError` exists but has not been adopted.

**Parsing the message string with regex is fragile.** The regex would be something like:

```ts
/at line (\d+) column (\d+)/
```

but it will fail on older V8, Firefox, Safari, and future engine changes. This is LOW confidence for cross-engine reliability.

### Alternative: Character-Offset-to-Line Calculation

If the error message contains a character offset ("at position 107"), converting to line/column is reliable and engine-independent:

```ts
function offsetToLineCol(text: string, offset: number): { line: number; col: number } {
  const lines = text.slice(0, offset).split('\n');
  return { line: lines.length, col: lines[lines.length - 1].length + 1 };
}
```

Regex to extract position: `/at position (\d+)/` — this format is consistent in V8 for at least several major versions.

**Confidence:** MEDIUM — position number extraction is more stable than line/column extraction from the string; the offsetToLineCol calculation is deterministic.

### jsonc-parser as Alternative

`jsonc-parser` (Microsoft, used in VS Code) provides the `visit()` API with `onError(error, offset, length, startLine, startCharacter)` callbacks — true structured line/column data, cross-engine reliable.

- Gzipped size: **~7.5 KB** (from bundlephobia data in search results; not independently verified via bundlephobia which was unavailable).
- API: `visit(text, visitor, options)` where `visitor.onError` gives `startLine` and `startCharacter`.
- Only needed if the native message-parsing approach proves unreliable in testing.

**Recommendation for Phase 4:** Start with native `JSON.parse` + offset extraction + `offsetToLineCol`. Add `jsonc-parser` only if cross-browser testing reveals the offset format is unreliable. This keeps zero new deps for the happy path.

**Confidence:** MEDIUM for jsonc-parser bundle size (bundlephobia was unavailable; size from secondary sources). HIGH for the jsonc-parser API (from GitHub README).

---

## 5. Debounce Pattern in React 18

### Recommended Pattern: useEffect + setTimeout cleanup

```ts
// Inside component
const [jsonText, setJsonText] = useState(initialJson);

useEffect(() => {
  const id = setTimeout(() => {
    // parse jsonText, update parsed state
  }, 300);
  return () => clearTimeout(id);
}, [jsonText]);
```

**Why this pattern:**
- Cancels correctly on unmount (cleanup runs).
- Cancels on every keystroke before the 300 ms fires (dependency array change triggers cleanup).
- No extra library needed.
- Works correctly under React 18 Strict Mode (double-invocation in dev: the cleanup fires immediately, which is correct behaviour and tests the cancel path).

**Why not `useDeferredValue`:** `useDeferredValue` defers a re-render of a lower-priority subtree — it does not debounce side effects. It would not prevent the parse from running on every keystroke.

**Why not a shared debounce utility:** A simple `useEffect` + `setTimeout` is idiomatic React and requires no import. A `useDebounce` custom hook is a fine extraction if the same pattern is needed in multiple places, but for a single textarea it is over-engineering.

**Zustand integration:** The parse result (parsed `GameConfig | null` and any error) should be **local component state**, not Zustand. The store's `setGameConfig` and `setConfigJson` are called only at launch time (or when the textarea changes for persistence). Keeping transient parse state local avoids unnecessary global re-renders.

**Confidence:** HIGH — useEffect+setTimeout debounce is the standard React idiom; verified against multiple recent sources and React docs on effects.

---

## 6. "Stubbed" Card UX — Visible but Non-Functional

### Recommended pattern: `aria-disabled` + visual dimming + badge

For the "Generate from Brief" card:
- Use `aria-disabled="true"` (NOT the HTML `disabled` attribute, which is for form elements).
- Apply visual dimming (e.g., `opacity-50` or reduced contrast via Tailwind).
- Add a badge ("Coming in Phase 7" or "Coming Soon").
- On click: show an inline message beneath the card ("Brief generation is not yet available") rather than navigating. This is discoverable and honest.
- The card remains focusable and visible to screen readers, which is correct — it exists and should be announced, just not interactable.

**Why `aria-disabled` over `pointer-events-none`:** `aria-disabled` is visible to assistive technology; `pointer-events-none` is purely visual and leaves keyboard interaction intact without communicating the disabled state to screen readers.

**Why not hidden:** The CONTEXT.md decision is explicit — "visible but disabled, with a badge, not hidden or faked." This matches the principle that stub features should be honest about their status.

**Implementation:** A `<div role="button" aria-disabled="true" onClick={handleStubClick}>` is appropriate since this is not a native button (it's a card). Alternatively `<button aria-disabled="true" onClick={...}>` with a custom click handler that shows the message and does nothing else.

**Confidence:** HIGH — from MDN aria-disabled docs and WCAG accessibility guidance.

---

## 7. Pitfalls & Gotchas

### Pitfall 1: Keeping `appPhase` and URL in sync manually

**What goes wrong:** `initGame` sets `state.phase = 'game'` AND the launch handler calls `navigate('/game')`. They must always agree. If one is forgotten, the UI desynchronises.

**How to avoid:** Remove `phase` from the store in Phase 4. Use `useNavigate` as the only navigation mechanism. Let the URL be truth. `setupMode` stays in store because it has no URL equivalent in this phase.

### Pitfall 2: textarea scroll desync with line-number gutter

**What goes wrong:** The line-number `<pre>` and the `<textarea>` scroll independently. Only the textarea has a user-visible scrollbar but both have scroll positions.

**How to avoid:** Attach `onScroll` to the textarea and set `gutterRef.current.scrollTop = e.currentTarget.scrollTop`. The gutter must also have `overflow: hidden` so its scrollbar is invisible. Both elements need identical `lineHeight` and `padding-top`.

### Pitfall 3: JSON editor state after store initialisation

**What goes wrong:** User launches Scenario 1 (store initialised, navigate to /game), then navigates back to /setup. The textarea shows the same JSON. User edits the JSON. The store's `gameConfig` still reflects the old launch. They launch Scenario 2 — if `initGame` reads from `store.configJson` it is fine; if it reads from a stale closure it is not.

**How to avoid:** `initGame` should always take the parsed config from the current textarea state at click time, not from store.configJson. The launch handler parses the current textarea content immediately (not from a debounced state) and calls `initGame(parsedConfig, scenarioIndex)`. The debounced state is for the live summary display only.

### Pitfall 4: React Strict Mode double-mount breaks useEffect debounce test

**What goes wrong:** In development, React 18 Strict Mode mounts, unmounts, and remounts every component. The `clearTimeout` cleanup fires immediately. This looks like debouncing "doesn't work" in dev.

**How to avoid:** This is expected and correct Strict Mode behaviour. The debounce will work normally in production. Do not disable Strict Mode to work around this.

### Pitfall 5: Navigate without `replace` creates forward/back weirdness

**What goes wrong:** If the game guard uses `<Navigate to="/setup">` without `replace`, the user can press Forward to get back to `/game` with null state, triggering infinite redirect loops or a blank screen flash.

**How to avoid:** Always use `<Navigate to="/setup" replace />` (with `replace`). Similarly, `useNavigate('/setup', { replace: true })` if navigating programmatically from game back to setup.

### Pitfall 6: `react-router-dom` vs `react-router` import confusion

**What goes wrong:** Existing blog posts, Stack Overflow answers, and older code use `react-router-dom`. In v7, the package is `react-router`. Importing from `react-router-dom` will fail unless that package is installed as a separate alias.

**How to avoid:** Install `react-router` only. All imports from `"react-router"`. Do not install `react-router-dom`. If TypeScript reports missing module errors, verify the correct package is installed.

---

## Standard Stack

### Core (install)
| Library | Version | Purpose |
|---------|---------|---------|
| `react-router` | ^7.14.x | Client-side routing, BrowserRouter, Routes, Navigate |

### No Additional Dependencies Required
| Capability | Approach |
|-----------|---------|
| JSON editor | Plain `<textarea>` + CSS line-number gutter |
| Debounce | `useEffect` + `setTimeout` (native React) |
| JSON parse error location | Native SyntaxError message parsing + `offsetToLineCol` util |
| Stub card | `aria-disabled` + Tailwind opacity |

### Contingency (add only if needed)
| Library | When to add | Size |
|---------|------------|------|
| `jsonc-parser` | If cross-browser JSON error location proves unreliable | ~7.5 KB gz |

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Client-side routing | Custom hash-based nav or appPhase-driven rendering | `react-router` |
| Route guard | Complex middleware or HOC factory | Inline `if (!gameState) return <Navigate>` |

**Key insight:** The `appPhase` store field is a hand-rolled router. Now that React Router is in the stack, eliminate the duplication.

---

## Architecture Patterns

### Recommended file structure additions

```
src/
├── main.tsx                    # BrowserRouter added here
├── App.tsx                     # Routes + GameGuard defined here
├── components/
│   ├── setup/
│   │   ├── SetupScreen.tsx     # Top-level setup container (renders home or load panel)
│   │   ├── HomeScreen.tsx      # Two-path landing cards
│   │   ├── LoadConfigPanel.tsx # JSON editor + summary + launch buttons
│   │   └── ScenarioSummary.tsx # Parsed summary read-only display
│   └── game/
│       └── GameScreen.tsx      # Phase 5 concern — stub only in Phase 4
```

`SetupScreen` reads `setupMode` from Zustand and renders `<HomeScreen>` or `<LoadConfigPanel>`. This keeps the router URL (`/setup`) stable while sub-navigation is handled by the store.

---

## Open Questions

1. **`phase` field removal timing** — The store's `phase: AppPhase` field is used by `initGame` and `resetGame`. Removing it in Phase 4 requires updating those actions to not set `state.phase`. Confirm no other current code reads `useGameStore(s => s.phase)` before removing it. (The codebase has no setup/game components yet, so this should be safe.)

2. **jsonc-parser bundle size** — Bundlephobia was unavailable during research. The ~7.5 KB gzipped figure comes from a secondary source. Verify before adding if needed.

3. **Line-number gutter scroll sync edge cases** — Very long JSON (5000+ lines) may have performance implications with a DOM-rendered gutter. The EDIP config is ~200-300 lines, so this is not a concern for Phase 4, but worth noting if the config grows.

---

## Sources

### Primary (HIGH confidence)
- React Router v7 official installation docs — https://reactrouter.com/start/declarative/installation
- React Router v7 routing docs — https://reactrouter.com/start/declarative/routing
- React Router v7 state management explanation — https://reactrouter.com/explanation/state-management
- React Router v6→v7 upgrade guide — https://reactrouter.com/upgrading/v6
- Vite shared options docs (appType) — https://vite.dev/config/shared-options.html
- MDN JSON.parse — https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse
- MDN aria-disabled — https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-disabled
- jsonc-parser GitHub (Microsoft) — https://github.com/microsoft/node-jsonc-parser

### Secondary (MEDIUM confidence)
- V8 JSON.parse error message format — inferred from MDN + community sources; "at line X column Y" format confirmed by multiple community references
- react-simple-code-editor performance limitation — GitHub project README (react-simple-code-editor/react-simple-code-editor)
- jsonc-parser bundle size (~7.5 KB gz) — from libraries.io / secondary source; bundlephobia was unavailable

### Tertiary (LOW confidence)
- TC39 proposal for structured SyntaxError properties — proposal discussion thread, status unclear

---

## Metadata

**Confidence breakdown:**
- React Router v7 integration: HIGH — official docs verified
- appPhase vs URL decision: HIGH — React Router state management docs clear; store examined directly
- JSON editor choice: MEDIUM — react-simple-code-editor bundle size unverified; plain textarea recommendation is safe regardless
- JSON error location: MEDIUM — V8 message format from community sources; offsetToLineCol approach is deterministic
- Debounce pattern: HIGH — standard React idiom, multiple sources agree
- Stub card UX: HIGH — MDN aria-disabled docs
- Pitfalls: HIGH — derived from verified patterns and direct store code examination

**Research date:** 2026-04-13
**Valid until:** 2026-05-13 (React Router stable; 30-day window)
