---
phase: 06-llm-integration
plan: 09
type: execute
wave: 6
depends_on: ["06-08"]
files_modified:
  - src/components/game/StatePanel/StatePanel.tsx
  - src/components/game/StatePanel/StatePanel.test.tsx
  - src/components/game/StatePanel/TeamCard.tsx
  - src/components/game/StatePanel/TeamCard.test.tsx
  - src/index.css
autonomous: true

must_haves:
  truths:
    - "`StatePanel` tracks previous `gameState` via `useRef` and computes per-field deltas (`crisisSeverity`, `edipLegitimacy`, and per team: `pc`, `po`, `readiness`, `stock`, `crm`, `ic`) without triggering an extra render"
    - "`TrackBar` continues to animate width (existing behaviour) AND receives an optional `delta?: number` prop that renders a small ghost label (`+1` / `-2`) with a 2.5s CSS fade-out when delta != 0"
    - "`TeamCard` accepts a `deltas?: Partial<Record<'pc'|'po'|'readiness'|'stock'|'crm'|'ic', number>>` prop; each changed cell applies `animate-[cellPulse_800ms_ease-out_both]` AND renders a ghost label with `animate-[ghostFade_2500ms_ease-out_both]`"
    - "Favourability colouring: ghost label uses literal class string `'text-track-readiness'` (green, favourable) or `'text-crisis-security'` (red, unfavourable) — Tailwind v4 picks them up via static scanning; NEVER composed from template literals or dynamic key lookup"
    - "Two new @keyframes (`cellPulse`, `ghostFade`) are added to `src/index.css` alongside the existing `@keyframes messageIn`"
  artifacts:
    - path: "src/components/game/StatePanel/StatePanel.tsx"
      provides: "Delta-aware StatePanel that diffs gameState against previous render"
    - path: "src/components/game/StatePanel/TeamCard.tsx"
      provides: "TeamCard with cell pulse + ghost label on changed fields"
    - path: "src/index.css"
      provides: "@keyframes cellPulse, @keyframes ghostFade"
  key_links:
    - from: "src/components/game/StatePanel/StatePanel.tsx"
      to: "src/components/game/StatePanel/TeamCard.tsx"
      via: "deltas prop"
      pattern: "deltas\\?:"
---

<objective>
State-visibility polish: when the LLM updates `gameState`, the change must be legible in the facilitator's peripheral vision within ~500ms. Split out of 06-07 so it runs AFTER the 06-08 smoke test validates the core loop — if the smoke test uncovers a store bug, we are not ripping apart CSS animations to fix it.

Purpose: Satisfies CONTEXT.md state-visibility decisions + DASH-05 (TeamCard pulse). TrackBar already animates width; this plan adds delta ghost labels for top-level tracks and both pulse + ghost labels for team cells.
Output: StatePanel + TeamCard updated with delta diff logic; two new keyframes in index.css; tests covering initial-render (no deltas), post-update (deltas visible), favourability colouring, and ghost-label fade-out.
</objective>

<execution_context>
</execution_context>

<context>
@.planning/phases/06-llm-integration/06-CONTEXT.md
@.planning/phases/06-llm-integration/06-RESEARCH.md
@.planning/phases/06-llm-integration/06-07-SUMMARY.md
@.planning/phases/06-llm-integration/06-08-SUMMARY.md
@src/components/game/StatePanel/StatePanel.tsx
@src/components/game/StatePanel/TeamCard.tsx
@src/index.css
</context>

<tasks>

<task type="auto">
  <name>Task 1: StatePanel delta diff + TrackBar delta ghost + keyframes</name>
  <files>src/components/game/StatePanel/StatePanel.tsx, src/components/game/StatePanel/StatePanel.test.tsx, src/index.css</files>
  <action>
    **`StatePanel.tsx`** — track previous state for delta display:
    - Use `const prevStateRef = useRef<GameState | null>(null)` to hold previous gameState.
    - On each render, compute per-field delta (current - prev) for: `crisisSeverity`, `edipLegitimacy`, and per team: `pc`, `po`, `readiness`, `stock`, `crm`, `ic`.
    - On first render `prevStateRef.current` is `null` → all deltas are `undefined` (no ghost labels).
    - Pass per-team deltas to each `<TeamCard />` as a prop `deltas?: Partial<Record<'pc'|'po'|'readiness'|'stock'|'crm'|'ic', number>>`.
    - Pass top-level severity/legitimacy deltas to `TrackBar` (extend TrackBar inline or via a small wrapper) as an optional `delta?: number` prop. TrackBar renders a small `+1` / `-2` ghost label with a 2.5s CSS fade-out when `delta != null && delta !== 0`.
    - After render, update the ref with current state inside `useEffect(() => { prevStateRef.current = gameState })`.
    - Ghost label text format: prepend `+` for positive numbers, render `-` inherently for negatives (e.g. `+1`, `-2`).
    - Favourability map lives as a module constant:
      ```typescript
      const FAVORABILITY: Record<string, 'up' | 'down'> = {
        crisisSeverity: 'down',   // lower is better
        edipLegitimacy: 'up',
        pc: 'up', po: 'up', readiness: 'up',
        stock: 'up', crm: 'up', ic: 'up',
      }
      ```
    - Ghost colour class is pre-baked as a literal string ternary:
      ```typescript
      const isFavourable =
        (FAVORABILITY[field] === 'up' && delta > 0) ||
        (FAVORABILITY[field] === 'down' && delta < 0)
      const deltaColorClass = isFavourable ? 'text-track-readiness' : 'text-crisis-security'
      ```
      The string literals `'text-track-readiness'` and `'text-crisis-security'` MUST appear verbatim in the source file — never via template literal, variable interpolation, or dynamic key lookup. Tailwind v4 uses a static source scan; dynamic composition produces missing CSS at build time.

    **`src/index.css`** — add the two keyframes alongside the existing `@keyframes messageIn`:
    ```css
    @keyframes cellPulse {
      0%   { background-color: color-mix(in oklab, var(--color-persona-finch) 20%, transparent); }
      100% { background-color: transparent; }
    }
    @keyframes ghostFade {
      0%   { opacity: 1; transform: translateY(-4px); }
      80%  { opacity: 1; }
      100% { opacity: 0; transform: translateY(-10px); }
    }
    ```

    Tests — extend `src/components/game/StatePanel/StatePanel.test.tsx`:
    - Initial render (no prev) → no ghost labels rendered; assert `queryByText(/^[+-]\d+$/)` returns `null`.
    - After prop change simulating state update (increment crisisSeverity by 1) → ghost label `+1` renders within TrackBar.
    - Favourability for crisisSeverity: decrease (`-2`) → element has class `text-track-readiness` (green, favourable — lower is better); increase (`+2`) → element has class `text-crisis-security` (red, unfavourable).
    - Favourability for edipLegitimacy: decrease → `text-crisis-security`; increase → `text-track-readiness`.
    - Ghost labels disappear from DOM tree after 2500ms (use `vi.useFakeTimers()` + advance timers; or assert CSS animation ends via class-based check — simpler: assert the element still exists but opacity is 0 via computed-style spy, OR render with a key-based remount that clears after timeout).
  </action>
  <verify>
    - `pnpm test src/components/game/StatePanel/StatePanel.test.tsx` — all tests pass.
    - `pnpm typecheck` passes.
    - `grep -c "'text-track-readiness'" src/components/game/StatePanel/StatePanel.tsx` returns ≥ 1.
    - `grep -c "'text-crisis-security'" src/components/game/StatePanel/StatePanel.tsx` returns ≥ 1.
    - `grep -c "@keyframes cellPulse" src/index.css` returns 1.
    - `grep -c "@keyframes ghostFade" src/index.css` returns 1.
  </verify>
  <done>
    StatePanel diffs previous vs. current gameState per render; TrackBar shows `+N`/`-N` ghost labels that fade over 2.5s with favourability-coloured text; keyframes live in index.css.
  </done>
</task>

<task type="auto">
  <name>Task 2: TeamCard cell pulse + ghost label + Tailwind-scan verification</name>
  <files>src/components/game/StatePanel/TeamCard.tsx, src/components/game/StatePanel/TeamCard.test.tsx</files>
  <action>
    **`TeamCard.tsx`** — apply pulse to changed cells:
    - Accept new optional prop `deltas?: Partial<Record<'pc'|'po'|'readiness'|'stock'|'crm'|'ic', number>>`.
    - For each resource field, if `deltas[field]` is non-zero AND non-undefined, apply class `animate-[cellPulse_800ms_ease-out_both]` to the cell's outer wrapper AND render a ghost label near the value (`+N` / `-N`) with class `animate-[ghostFade_2500ms_ease-out_both]`.
    - Favourability colour — write the ternary with LITERAL class strings (same constraint as Task 1):
      ```typescript
      const deltaColorClass = isFavourable ? 'text-track-readiness' : 'text-crisis-security'
      ```
      Never compose via template literal or variable key lookup. Both class names MUST appear verbatim in this file.

    Tests — extend (or create) `src/components/game/StatePanel/TeamCard.test.tsx`:
    - No deltas prop → no pulse class applied; no ghost labels.
    - `deltas={{ pc: +2 }}` → the PC cell wrapper has `animate-[cellPulse` in its className; a ghost element with text `+2` and class `text-track-readiness` is in the DOM.
    - `deltas={{ readiness: -1 }}` → ghost `-1` with `text-crisis-security` (readiness favoured up → negative delta is unfavourable).
    - `deltas={{ pc: 0 }}` → NO pulse class, NO ghost label (zero is a no-op).

    **Static class-scan verification (belt-and-braces for Tailwind v4 purge):**
    Add these shell commands to the verify block:
    - `grep -c "'text-track-readiness'" src/components/game/StatePanel/TeamCard.tsx` → ≥ 1
    - `grep -c "'text-crisis-security'" src/components/game/StatePanel/TeamCard.tsx` → ≥ 1
    - After `pnpm build`, check the emitted CSS bundle for both class names. On this project the output is `dist/assets/*.css` (Vite default). Run:
      `for f in dist/assets/*.css; do grep -l "text-track-readiness" "$f" && grep -l "text-crisis-security" "$f"; done`
      Both greps must succeed. If either class is missing from the built CSS, a dynamic composition has slipped in — fix it to literal ternary form.
  </action>
  <verify>
    - `pnpm test src/components/game/StatePanel/TeamCard.test.tsx` — all pass.
    - `pnpm typecheck` passes.
    - `grep -c "'text-track-readiness'" src/components/game/StatePanel/TeamCard.tsx` returns ≥ 1.
    - `grep -c "'text-crisis-security'" src/components/game/StatePanel/TeamCard.tsx` returns ≥ 1.
    - `pnpm build` succeeds; both class names appear in the built CSS bundle (see static-class-scan commands above).
    - Visual spot-check via dev seed (Plan 05-01) after triggering a mock state update: cell tint briefly fades from finch-blue, ghost label floats up and fades out over ~2.5s.
  </verify>
  <done>
    TeamCard cells pulse tint on change; ghost labels render with favourability colour; Tailwind v4 static scan picks up both class names (verified by build-output grep).
  </done>
</task>

</tasks>

<verification>
- `pnpm test src/components/game/StatePanel` — all tests (existing + new) pass.
- `pnpm typecheck && pnpm build` — green; both favourability classes present in built CSS.
- Manual visual confirmation: trigger a mock state update via dev seed; both bar animation and cell pulse + ghost are visible without scrolling focus away from the chat feed.
</verification>

<success_criteria>
- StatePanel diffs `gameState` against previous render and surfaces per-field deltas.
- TrackBar shows `+N` / `-N` ghost labels that fade over 2.5s; favourability colouring correct.
- TeamCard cells pulse on change; ghost labels render with favourability colour.
- Tailwind v4 static class scan picks up both `text-track-readiness` and `text-crisis-security` (verified by build-output grep).
- No regressions in the Phase 6 core loop (validated by the already-passed 06-08 smoke test).
</success_criteria>

<output>
After completion, create `.planning/phases/06-llm-integration/06-09-SUMMARY.md` noting which state-visibility decisions from CONTEXT.md are now satisfied and whether any deferred items remain.
</output>
