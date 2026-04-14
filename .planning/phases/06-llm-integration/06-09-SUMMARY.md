---
phase: 06-llm-integration
plan: 09
subsystem: state-visibility
tags: [state-panel, team-card, track-bar, animations, tailwind-v4, ghost-labels, cell-pulse, delta-diff]

# Dependency graph
requires:
  - phase: 06-llm-integration
    provides: "06-07 (StatePanel + TeamCard + TrackBar wired to live gameState), 06-08 (smoke test validated core loop end-to-end)"
provides:
  - "src/components/game/StatePanel/StatePanel.tsx — delta-aware diff vs. previous render via prevStateRef + useEffect"
  - "src/components/game/StatePanel/TrackBar.tsx — optional delta + favourability props, ghost label with ghostFade animation"
  - "src/components/game/StatePanel/TeamCard.tsx — per-cell pulse + ghost label on changed resource fields"
  - "src/components/game/StatePanel/TeamCard.test.tsx — new file, 10 tests (no-op, favourability both directions, multi-delta independence, PO signed handling)"
  - "src/styles/index.css — @keyframes cellPulse + @keyframes ghostFade; new --color-track-readiness token (#2BC48A) for favourable green tint"
affects: [07-config-generation, 08-production-hardening]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Delta diff via prevStateRef pattern: useRef<GameState | null>(null) read during render, updated in useEffect after commit — first render prev is null → no ghosts"
    - "Tailwind v4 source-scan anchor pattern: literal strings 'text-track-readiness' and 'text-crisis-security' appear verbatim in every file that might emit them (StatePanel.tsx, TeamCard.tsx, TrackBar.tsx); never composed via template literal or dynamic key lookup"
    - "Favourability map as module constant: FAVORABILITY / FAVOURABILITY record per component, direction-of-favourable ('up' | 'down') keyed by field — crisisSeverity is the only 'down' field (lower is better)"
    - "Ghost label text format: prepend '+' for positive deltas, rely on natural '-' for negatives — matches humans' mental model of signed delta"
    - "Animation keyframes live in @theme (src/styles/index.css) alongside existing messageIn — keeps animation system discoverable in one place"

key-files:
  created:
    - src/components/game/StatePanel/TeamCard.test.tsx
    - .planning/phases/06-llm-integration/06-09-SUMMARY.md
  modified:
    - src/components/game/StatePanel/StatePanel.tsx
    - src/components/game/StatePanel/StatePanel.test.tsx
    - src/components/game/StatePanel/TrackBar.tsx
    - src/components/game/StatePanel/TeamCard.tsx
    - src/styles/index.css
    - src/components/game/GameHeader.tsx (Rule 3 unblock — pre-existing title/name typo)
    - src/lib/responseParser.test.ts (Rule 3 unblock — stateUpdate test-data shape cast)

key-decisions:
  - "prevStateRef updated INSIDE useEffect (not during render) so the current render pass can still read the previous value — updating during render would overwrite prev with current and always yield zero deltas"
  - "First render prevStateRef.current === null is treated as 'no deltas' across the board — no ghost labels flash on mount, satisfying CONTEXT.md 'state changes must be legible' without noisy load-time flashing"
  - "Zero delta is an explicit no-op (hasDelta = delta != null && delta !== 0) — re-rendering the same gameState object causes every field's diff to be 0 and produces no visual noise"
  - "Ghost label colour via literal ternary ('text-track-readiness' : 'text-crisis-security') — Tailwind v4 static source scanner drops dynamically composed class names, so literal strings appear in every source file that could emit them"
  - "Added --color-track-readiness token (#2BC48A, matches resource-readiness and crisis-none) — plan mandated the class name 'text-track-readiness' but no corresponding @theme token existed; matching the canonical favourable-green keeps semantic consistency"
  - "Ghost label stable key on TrackBar uses label-delta-value combination — forces animation restart when delta flips but avoids spurious resets on unrelated props"
  - "Favourability: crisisSeverity is 'down' (lower is better); all other tracked fields (edipLegitimacy, pc, po, readiness, stock, crm, ic) are 'up' — codified as module-level FAVORABILITY / FAVOURABILITY records"
  - "Rule 3 deviation: pre-existing pnpm build failures (GameHeader.tsx referencing gameConfig.title, responseParser.test.ts stateUpdate shape) blocked the plan's verify step. Fixed inline: GameHeader now uses .name per the 05-03 decision; responseParser test casts test-data through unknown. Both are minimal surgical fixes with no behaviour change"
  - "Plan referenced src/index.css but actual path is src/styles/index.css — updated actual file; reading the codebase beats trusting the path in the plan"

patterns-established:
  - "Tailwind v4 class-scan guardrail: whenever a component conditionally applies a themed class based on state, the class literals must appear verbatim in the file (ternary, not template-literal composition); add explicit 'anchor' constants if the class is only emitted by a child component"
  - "Delta-diff components: useRef<T | null>(null) + useEffect(() => { ref.current = value }, [value]) for side-effect-free per-render diff against previous value; no state, no extra render cycle"
  - "Keyframe co-location: new @keyframes go inside @theme alongside their --animate-* token (or free-standing if used via animate-[...] arbitrary-value syntax); keeps the animation system centralised"
  - "Rule 3 build-unblock: pre-existing typecheck errors discovered during plan verify get fixed inline and documented as deviations, not left as 'known issues' that undermine the verify gate"

# Metrics
duration: ~8m
completed: 2026-04-14
---

# Phase 6 Plan 9: State Visibility Summary

**StatePanel now diffs gameState vs previous render and surfaces per-field deltas as ghost labels with favourability colouring; TeamCard cells pulse on change; Tailwind v4 static scan picks up both favourability classes in the emitted CSS bundle; 406/406 tests passing (+18 over the 388 baseline).**

## Performance

- **Duration:** ~8 minutes (Task 1 + Task 2 both auto)
- **Completed:** 2026-04-14
- **Tasks:** 2 (both `type="auto"`)
- **Files modified:** 5 primary + 2 Rule 3 unblock fixes + 1 test file created

## Accomplishments

- **StatePanel delta diff wired.** `prevStateRef = useRef<GameState | null>(null)` reads the previous gameState during render and is updated in `useEffect` after commit. Per-field deltas computed for `crisisSeverity`, `edipLegitimacy`, and each team's six resource fields (`pc`, `po`, `readiness`, `stock`, `crm`, `ic`). First render produces `null` prev → zero ghost labels.
- **TrackBar ghost labels.** Added optional `delta?: number` and `favourability?: 'up' | 'down'` props; when `delta != null && delta !== 0`, renders a small absolutely-positioned `+N` / `-N` label above the bar header with `animate-[ghostFade_2500ms_ease-out_both]`. Colour via literal ternary between `'text-track-readiness'` (favourable, green) and `'text-crisis-security'` (unfavourable, red).
- **TeamCard cell pulse + ghost labels.** Each resource cell wrapper applies `animate-[cellPulse_800ms_ease-out_both]` when its delta is non-zero; ghost label `+N`/`-N` renders above the cell with the same favourability colouring rules. Zero delta is a no-op (no pulse, no ghost).
- **Two new keyframes added to `src/styles/index.css`.** `cellPulse` (0%: 20% finch-gold tint via `color-mix(in oklab, ...)`, 100%: transparent) over 800ms. `ghostFade` (0%: opacity 1, translateY -4px; 80%: opacity 1; 100%: opacity 0, translateY -10px) over 2500ms. Both live inside `@theme` alongside the existing `messageIn` keyframe.
- **New `--color-track-readiness` theme token.** Set to `#2BC48A` (matches `--color-resource-readiness` and `--color-crisis-none`); the plan mandated the class name `text-track-readiness` but no corresponding token existed, so Tailwind was silently dropping the class. Adding the token made it appear in the emitted CSS bundle.
- **Tailwind v4 static scan verified.** Both `text-track-readiness` and `text-crisis-security` appear in `dist/assets/*.css` after `pnpm build`. Literal strings appear in `StatePanel.tsx`, `TrackBar.tsx`, and `TeamCard.tsx` — never composed dynamically.
- **18 new tests (8 StatePanel + 10 TeamCard).** Coverage: initial render (no ghosts), post-update deltas, favourability colour for all four edge cases (severity up/down, legitimacy up/down, PC/readiness positive/negative, PO signed), zero-delta no-op, multi-delta independence, animation class presence.

## CONTEXT.md State-Visibility Decisions — Status

From `06-CONTEXT.md` section "State update visibility":

| Decision | Status | Notes |
|----------|--------|-------|
| Animated track bar transitions (400ms ease-out, number ticks) | **Already satisfied pre-09** | TrackBar's existing `transition-[width] duration-300 ease-out` (06-07) covers the width animation. Number readout is instant-swap — "ticks through intermediate integers" is DEFERRED (not in plan 06-09 scope; no test, no keyframe work). |
| Delta ghost-text +1 / -2, hold ~2.5s, fade out | **DONE** | TrackBar + TeamCard both render ghost labels with `animate-[ghostFade_2500ms_ease-out_both]`. |
| Green favourable / red unfavourable colour semantic | **DONE** | Literal ternary between `'text-track-readiness'` and `'text-crisis-security'`; favourability map codifies direction per field (severity is the only "down is favourable"). |
| Favourable direction lives in stateUpdater metadata, not LLM response | **DONE** | `FAVORABILITY` record in `StatePanel.tsx` + `FAVOURABILITY` in `TeamCard.tsx` — UI-side, not LLM-side. |
| Pulse/flash changed cell ~800ms | **DONE** | `@keyframes cellPulse` 0→100% over 800ms, tinting cell background from 20% finch-gold to transparent. |
| PC warning badges flash on threshold crossing | **Already satisfied pre-09** | PcBadge's existing `var(--animate-blink)` inline style (from plan 03-02) handles the CRISIS flash. Plan 06-09 did not touch threshold-crossing detection — re-evaluation happens naturally on re-render. |
| Persona indicator dots update each round | **Already satisfied pre-09** | PersonaDots (plan 05-02) already renders `data-lit` per round participation. |
| No undo UI | **Intentionally deferred** | Captured in CONTEXT.md as deferred. |

## Deferred / Out of Scope

- **Number-tick interpolation on track readouts** — the track bar value text swaps instantly instead of counting up/down through intermediate integers. Plan 06-09 did not include this (no test criteria, no keyframe). Low-value polish; can be added in Phase 8 if facilitator feedback requests it.
- **Manual visual spot-check via dev seed** — deferred to a follow-up human verification session. Plan verify block's last bullet ("Visual spot-check via dev seed (Plan 05-01) after triggering a mock state update") is not executed in an auto-only task; a screenshot session is recommended before Phase 7 kicks off.
- **Staggered ghost-label reveal between TrackBar and TeamCard** — currently all ghost labels start their fade simultaneously on a state update. Could be staggered (track bars first, then team cells) if peripheral-vision readability suffers in practice.

## Verification Evidence

- `pnpm test --run src/components/game/StatePanel` → 39 tests passing (29 StatePanel + 10 TeamCard).
- `pnpm test --run` → **406 / 406 tests passing** across 18 test files (+18 over the 388 baseline at the start of 06-09).
- `pnpm typecheck` → clean (tsc --noEmit, zero errors).
- `pnpm build` → succeeds; `dist/assets/index-*.css` contains both `text-track-readiness` (1 occurrence) and `text-crisis-security` (1 occurrence).
- `grep -c "'text-track-readiness'" src/components/game/StatePanel/StatePanel.tsx` → 2 (anchor constant + export).
- `grep -c "'text-crisis-security'" src/components/game/StatePanel/StatePanel.tsx` → 2.
- `grep -c "'text-track-readiness'" src/components/game/StatePanel/TeamCard.tsx` → 3 (anchor + ternary + export-style binding).
- `grep -c "'text-crisis-security'" src/components/game/StatePanel/TeamCard.tsx` → 3.
- `grep -c "@keyframes cellPulse" src/styles/index.css` → 1.
- `grep -c "@keyframes ghostFade" src/styles/index.css` → 1.

## Deviations from Plan

### Auto-fixed issues (Rule 3 — unblock build)

**1. [Rule 3 — Blocking] `GameHeader.tsx` referenced `gameConfig.title`, which does not exist on `GameConfig`**

- **Found during:** `pnpm build` verify step at end of Task 2.
- **Issue:** Pre-existing typecheck error — `GameConfig` has `.name`, not `.title`. Per STATE.md decision 05-03: "`gameConfig.name` used as game title (not `.title`)". Somewhere between 05-03 and now, a `.title` regression was introduced.
- **Fix:** Replaced `gameConfig?.title ?? gameConfig?.name ?? 'Untitled Game'` with `gameConfig?.name ?? 'Untitled Game'`.
- **Files modified:** `src/components/game/GameHeader.tsx` (1 line).
- **Commit:** `48b8812` (included in Task 2 commit since that's where the build unblock was needed).

**2. [Rule 3 — Blocking] `responseParser.test.ts` `stateUpdate` test-data shape incompatible with `StateUpdate` type**

- **Found during:** Same `pnpm build` run.
- **Issue:** The "preserves stateUpdate object payload" test uses `{ teams: { team1: { po: { legitimacy: 2 } } } }` — not a valid `StateUpdate` shape (which has `teamUpdates?: Partial<TeamState>[]`, not `teams`). The parser does not validate the inner shape of `stateUpdate` beyond "non-null object", so the test value is deliberately arbitrary — but TypeScript was rejecting it.
- **Fix:** Cast through `unknown as PersonaResponse['stateUpdate']` with an inline comment explaining the parser's lenience.
- **Files modified:** `src/lib/responseParser.test.ts` (3 lines including comment).
- **Commit:** `bc3cda3` (tests commit).

**3. [Rule 3 — Path correction] Plan referenced `src/index.css`; actual file is `src/styles/index.css`**

- **Found during:** First file read attempt at plan load.
- **Issue:** Plan frontmatter and action block said `src/index.css`. No such file exists.
- **Fix:** Used `src/styles/index.css` (confirmed via Glob). Updated that file; no other change needed.
- **Files modified:** None extra (just directed the edits to the correct path).
- **Commit:** Task 1 commit (`78ac275`).

### Design additions not in plan (Rule 2 — critical missing functionality)

**4. [Rule 2 — Missing critical] `--color-track-readiness` theme token did not exist**

- **Found during:** First `pnpm build` → `grep` in built CSS showed `text-crisis-security` present but `text-track-readiness` absent.
- **Issue:** The plan mandated the class name `text-track-readiness` but `src/styles/index.css` only defined `--color-track-severity` and `--color-track-legitimacy`. Tailwind v4 was silently dropping the class because there was no matching theme variable to resolve it.
- **Fix:** Added `--color-track-readiness: #2BC48A;` to `@theme` (matches `--color-resource-readiness` and `--color-crisis-none` — the canonical "favourable green" in the palette).
- **Files modified:** `src/styles/index.css` (1 new token + 6-line explanatory comment).
- **Commit:** `48b8812` (Task 2 commit since the missing class was only discovered during Task 2 verify).

## Commits

| Hash | Message |
|------|---------|
| `78ac275` | feat(06-09): StatePanel delta diff + TrackBar ghost labels + cellPulse/ghostFade keyframes |
| `48b8812` | feat(06-09): TeamCard cell pulse + ghost label with favourability colour |
| `bc3cda3` | test(06-09): StatePanel and TeamCard delta + favourability tests |

## Ready for Next Plan

Phase 6 is effectively complete after 06-09. Plans 06-01 through 06-08 cover the end-to-end LLM integration loop; 06-09 adds the state-visibility polish layer. 406/406 tests passing, typecheck clean, build succeeds, favourability classes confirmed in CSS bundle. Phase 7 (config generation) can begin.
