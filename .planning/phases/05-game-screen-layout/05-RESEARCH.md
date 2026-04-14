# Phase 5: Game Screen Layout - Research

**Researched:** 2026-04-13
**Domain:** React 19 + Tailwind v4 UI composition, chat feed patterns, complex layout
**Confidence:** HIGH (all findings based on direct source-file inspection of the live codebase)

---

## Summary

Phase 5 builds the full game screen against mock data. The existing codebase provides a rich foundation: the Zustand store already has all actions needed (no new store actions required for rendering), complete TypeScript types are locked, all design tokens are defined, and the EDIP game data is fully loaded. `src/mocks/` does not yet exist and must be created. The current `GameScreen.tsx` is a placeholder div that Phase 5 fully replaces.

The primary technical challenge is the three-column full-viewport layout with independent scroll regions: StatePanel scrolls vertically within its fixed-width left column, ChatFeed is the only scrollable center column with sticky-bottom auto-scroll + escape-hatch pill, and ReferencePanel scrolls independently in its fixed-width right column. The page itself must not scroll.

**Primary recommendation:** Use CSS Grid on the root game screen (`grid-rows-[auto_1fr_auto] grid-cols-[210px_1fr_252px]`) with each panel using `overflow-y-auto` in its own scroll container. Auto-scroll implemented with `useLayoutEffect` + a sentinel ref at the feed tail — the simplest pattern that survives React 19's concurrent mode batching.

---

## Research Focus 1: TypeScript Shapes (src/types/game.ts + src/types/llm.ts)

**Source:** Direct read of `C:\KVWarGame\src\types\game.ts` and `src\types\llm.ts` — HIGH confidence.

### MessageType and ChatMessage

```typescript
export type MessageType =
  | 'persona'
  | 'facilitator'
  | 'round_divider'
  | 'debrief_divider'
  | 'error'

export interface ChatMessage {
  id: string
  type: MessageType
  speaker?: PersonaId | 'facilitator'   // present on persona + facilitator messages
  text?: string                          // present on persona, facilitator, error
  flag?: string | null                   // facilitator note from LLM (persona messages)
  label?: string                         // present on round_divider, debrief_divider
  timestamp: string                      // ISO string on ALL messages
  isDebrief?: boolean                    // optional flag (debrief context)
}
```

**Critical observation:** There is NO `'loading'` MessageType in the locked types. CONTEXT.md describes a loading indicator as a "persona-attributed bubble at the feed bottom." Phase 5 must represent this as a transient UI state (not a stored `ChatMessage`), driven by the `loading: boolean` field already in the store. The loading bubble is rendered conditionally when `loading === true` — it is NOT appended to `messages[]`.

**Message type rendering map for the planner:**
| `type` | `speaker` | `text` | `label` | Notes |
|--------|-----------|--------|---------|-------|
| `'persona'` | `'kent'`/`'finch'`/`'chen'` | yes | — | Persona bubble + avatar |
| `'facilitator'` | `'facilitator'` | yes | — | Right-aligned, no avatar |
| `'round_divider'` | — | — | e.g. `"Round 2"` | Full-width divider |
| `'debrief_divider'` | — | — | e.g. `"DEBRIEF"` | Amber variant divider |
| `'error'` | — | yes | — | Red banner, not bubble-shaped |

### PersonaId

```typescript
export type PersonaId = 'kent' | 'finch' | 'chen'
```

### TeamState (live game fields)

```typescript
export interface TeamState {
  id: string        // "A" | "B" | "C" | "D"
  name: string      // e.g. "Team A: Frontline & High-Threat"
  pc: number        // Political Capital 0–6
  po: number        // Public Opinion -2 to +2
  readiness: number // 0–5
  stock: number     // Defence Stock (blue cubes)
  crm: number       // Critical Raw Materials (red discs)
  ic: number        // Industrial Capacity (grey cylinders)
}
```

**PC threshold logic (pure function the StatePanel will consume):**
- `pc === 0` → CRISIS (red badge, animate-blink)
- `pc === 1` → STRAINED (amber badge, static)
- `pc >= 2` → no badge

**Note:** The field name is `readiness` in `TeamState` (not `rdy`). The display label "RDY" in the requirements is just the abbreviated UI label. The resource grid labels map: PC, PO, RDY (=`readiness`), STK (=`stock`), CRM, IC.

### GameState

```typescript
export interface GameState {
  round: number
  scenarioIndex: number
  crisisSeverity: number   // 0–5
  crisisState: CrisisState // 'No Crisis' | 'Supply Crisis' | 'Security-Related Supply Crisis'
  edipLegitimacy: number   // -2 to +2
  teams: TeamState[]
  cardsThisRound: string[] // card IDs played this round
}
```

### CrisisState

```typescript
export type CrisisState = 'No Crisis' | 'Supply Crisis' | 'Security-Related Supply Crisis'
```

The GameHeader crisis state badge uses the `crisisState` string directly. Token colours: `text-crisis-none`, `text-crisis-supply`, `text-crisis-security`.

### GameCard (for ReferencePanel CARDS tab)

```typescript
export interface GameCard {
  id: string       // e.g. "CS-01"
  name: string     // e.g. "Activate Supply Crisis"
  cat: string      // Category string — see category colour map below
  timing: string   // e.g. "This Round"
  req: string      // Preconditions (multi-sentence)
  effect: string   // Effect text (multi-sentence)
}
```

**Total cards:** 11 (CS-01, CS-02, MP-01, MP-02, SP-01, SP-02, CP-01, PA-01, PA-02, PA-03, TR-01)

### NationalAction (for ReferencePanel ACTIONS tab)

```typescript
export interface NationalAction {
  id: string     // "NA-1" through "NA-4"
  name: string   // e.g. "Adjust National Stockpiles"
  summary: string // Multi-sentence description
  cost: string   // Cost/trade-off text
}
```

**Total national actions:** 4

**Unique Team Powers:** Live in `EDIP_CONFIG.teams[n].uniqueAction` (string, full rules text) and `EDIP_CONFIG.teams[n].id` ("A"/"B"/"C"/"D"). No separate TypeScript type — accessed via `gameConfig.teams[n].uniqueAction`.

### Guide Sections (for ReferencePanel GUIDE tab)

Six fields on `GameConfig`, accessed as `gameConfig.*`:
1. `objective` — Objective text
2. `redLines` — "Red Lines & PC Thresholds"
3. `pcThresholds` — PC Thresholds detail
4. `votingRule` — Voting Rule
5. `eoMechanic` — EO Response Mechanic
6. `resourceLogic` — Resource Tokens
7. `facilitation` — Facilitator Input Guide

**Note:** That's 7 fields in the data vs 6 guide sections mentioned in requirements (REF-04). The planner should decide how to group `redLines` + `pcThresholds` (they're closely related and EDIP_CONFIG confirms this — `pcThresholds` is a continuation of `redLines`). Recommended: group into one "Red Lines & PC Thresholds" section.

---

## Research Focus 2: Store Shape and Missing Actions

**Source:** Direct read of `C:\KVWarGame\src\lib\gameStore.ts` — HIGH confidence.

### Already-Existing Store State & Actions

| Field/Action | Type | Phase 5 Use |
|---|---|---|
| `gameState: GameState \| null` | state | StatePanel data source |
| `gameConfig: GameConfig \| null` | state | ReferencePanel data source |
| `messages: ChatMessage[]` | state | ChatFeed data source |
| `loading: boolean` | state | Input disable, loading bubble render |
| `activeTab: 'cards' \| 'actions' \| 'guide'` | state | ReferencePanel tab state |
| `addMessage(msg)` | action | Stub action buttons append messages |
| `addMessages(msgs)` | action | Append multiple (round start = divider + bubble) |
| `setLoading(bool)` | action | Disable state |
| `setActiveTab(tab)` | action | Tab switching |
| `resetGame()` | action | "New Game" button in GameHeader |
| `setGameState(gs)` | action | Mock injection uses this |
| `initGame(config, idx)` | action | Already wired in SetupScreen |

### Actions NOT in Store (Phase 5 Must Add)

**Stub actions needed for Phase 5 action buttons:**

1. **`advanceRound()`** — Increments `gameState.round`, appends a `round_divider` message with label `"Round N"` + a stub persona bubble (placeholder text). In Phase 5, this is a pure stub — no LLM call.

2. **`triggerDebrief()`** — Appends a `debrief_divider` message and a stub facilitator bubble. In Phase 5, a stub only.

3. **`sendFacilitatorMessage(text: string)`** — Appends a `facilitator` type `ChatMessage` to `messages[]` and sets `loading: true`. In Phase 5, loading immediately resolves (or stays true for visual testing). Phase 6 replaces with real LLM call.

**The store's `addMessage` + `setLoading` can compose these stubs.** Whether they become dedicated store actions or are handled inline in the component is Claude's discretion (inline composition is simpler for Phase 5 stubs). The planner should note that Phase 6 will need them as store actions — pre-creating them with stub implementations avoids churn.

**Recommendation:** Add `advanceRound()`, `triggerDebrief()`, and `sendFacilitatorMessage(text)` to the store now as stub actions. They use `addMessage`/`addMessages` internally and are easily replaced in Phase 6.

### Persona Indicators (Dot State)

There is NO field in `GameState` or the store for "which personas have responded this round." The CONTEXT.md decision is: dots lit when persona responded at least once in current round; resets when round advances.

**Resolution needed:** Phase 5 must either:
- (A) Derive from `messages[]` — scan for `type === 'persona'` messages after the last `round_divider` to know which `PersonaId`s have spoken. This is purely derived state, no store changes needed.
- (B) Add explicit store fields (overkill for Phase 5).

**Recommendation:** Option A — derive from `messages[]`. A pure function `getPersonasThisRound(messages: ChatMessage[], currentRound: number): Set<PersonaId>` computes this. Simple, no store changes.

---

## Research Focus 3: Data in src/data/ (edipConfig.ts)

**Source:** Direct read of `C:\KVWarGame\src\data\edipConfig.ts` — HIGH confidence.

All game data lives in one file: `EDIP_CONFIG as const satisfies GameConfig`. No separate persona metadata file exists. Key data points for Phase 5:

### Card Category Strings (cat field → Tailwind token)

| `cat` string | Tailwind token | Hex |
|---|---|---|
| `"Crisis State"` | `bg-category-crisis` | `#FF6B6B` |
| `"Monitoring"` | `bg-category-monitoring` | `#74B9FF` |
| `"Prioritisation (Soft)"` | `bg-category-prio-soft` | `#FDCB6E` |
| `"Prioritisation (Hard)"` | `bg-category-prio-hard` | `#E17055` |
| `"Demand Coordination"` | `bg-category-demand` | `#55EFC4` |
| `"Production Acceleration"` | `bg-category-production` | `#81ECEC` |
| `"Transfers"` | `bg-category-transfers` | `#A29BFE` |

The mapping from `cat` string to Tailwind class is a lookup object needed in the ReferencePanel. The planner should task creating this map.

### Persona Names and Colours

There is **no separate persona metadata object** in the codebase. The persona names "Kent", "Finch", "Chen" are implied by `PersonaId` (`'kent'` | `'finch'` | `'chen'`). The display names and titles come from `EDIP_CONFIG.teams[n].personas[]` — these are narrative description strings, not structured objects.

**For the StatePanel persona dots and chat avatars, Phase 5 must hard-code a persona metadata map:**

```typescript
// src/lib/personaConfig.ts (new file)
export const PERSONA_META: Record<PersonaId, {
  displayName: string
  initials: string  // see conflict resolution below
  colorClass: string
}> = {
  kent:  { displayName: 'Kent',  initials: 'KV', colorClass: 'bg-persona-kent'  },
  finch: { displayName: 'Finch', initials: 'AF', colorClass: 'bg-persona-finch' },
  chen:  { displayName: 'Chen',  initials: 'MC', colorClass: 'bg-persona-chen'  },
}
```

This file does not yet exist. It must be created in Phase 5.

### Unique Team Powers for ACTIONS Tab

`EDIP_CONFIG.teams` array, each entry has:
- `.id`: "A" | "B" | "C" | "D"
- `.uniqueAction`: Full rules text string

The ACTIONS tab "Unique Team Powers" section renders all 4 entries from `gameConfig.teams.map(t => ({ teamId: t.id, action: t.uniqueAction }))`.

---

## Research Focus 4: Design Token Inventory (src/styles/index.css)

**Source:** Direct read — HIGH confidence.

### Persona Colours

| Token | Tailwind Class | Hex | Usage |
|---|---|---|---|
| `--color-persona-kent` | `bg-persona-kent`, `text-persona-kent` | `#5B9BD5` | Avatar fill, bubble tint |
| `--color-persona-finch` | `bg-persona-finch`, `text-persona-finch` | `#DFA02A` | Avatar fill, bubble tint |
| `--color-persona-chen` | `bg-persona-chen`, `text-persona-chen` | `#2BC48A` | Avatar fill, bubble tint |

**Tinted bubble pattern (proven in TokenReference.tsx):**
```html
<div class="bg-persona-kent/8 border-l-2 border-persona-kent/50">
```
Opacity modifiers `/8`, `/20`, `/30`, `/50` work natively with custom @theme colours.

### Track Bar Colours

| Token | Tailwind Class | Hex | Track |
|---|---|---|---|
| `--color-track-severity` | `bg-track-severity` | `#FF6B6B` | Red, 0–5 |
| `--color-track-legitimacy` | `bg-track-legitimacy` | `#5B9BD5` | Blue, -2 to +2 |

**Track bar shell pattern (proven in TokenReference.tsx):**
```html
<div class="w-full h-1.5 bg-bg-surface rounded-sm overflow-hidden">
  <div class="h-full bg-track-severity rounded-sm" style="width: 60%">
```
Width is set via inline style (`style={{ width: `${(value/5)*100}%` }}`), not Tailwind dynamic classes.

**Legitimacy track:** Value range is -2 to +2 (total span 4). Zero-centred. Width formula: `((value + 2) / 4) * 100` percent. The fill starts from the left edge in current token design — the planner must decide if the legitimacy bar needs a centre-zero visual variant (two fills growing from centre). The current TokenReference shows a simple left-growing bar; whether to show a centre-zero bar is Claude's discretion.

### Crisis State Badge Colours

| Token | Tailwind Classes | Usage |
|---|---|---|
| `--color-crisis-none` | `bg-crisis-none/20 text-crisis-none border-crisis-none/30` | "No Crisis" |
| `--color-crisis-supply` | `bg-crisis-supply/20 text-crisis-supply border-crisis-supply/30` | "Supply Crisis" |
| `--color-crisis-security` | `bg-crisis-security/20 text-crisis-security border-crisis-security/30` | "Security Crisis" |

**Badge pattern (proven in TokenReference.tsx):**
```html
<span class="bg-crisis-none/20 text-crisis-none border border-crisis-none/30 rounded-sm px-2 py-0.5 font-mono text-xs uppercase">
```

### PC Warning Badge Colours (STRAINED/CRISIS)

No dedicated token exists. Use existing colours:
- STRAINED (pc=1): `bg-persona-finch/20 text-persona-finch` (amber = Finch colour `#DFA02A`)
- CRISIS (pc=0): `bg-crisis-security/20 text-crisis-security` with `animate-[blink]`

**Alternative:** Use `bg-category-prio-soft` (same amber `#FDCB6E`) for STRAINED. Either works since it's the same visual family. The planner should pick one and lock it.

### Animation Tokens

```css
--animate-blink: blink 1.4s ease-in-out infinite;

@keyframes blink {
  0%, 100% { opacity: 0.25; transform: scale(0.8); }
  50%       { opacity: 1;   transform: scale(1);   }
}
```

**Usage:** `animate-[blink]` in Tailwind v4 arbitrary animation syntax, or `style={{ animation: 'var(--animate-blink)' }}`. The TokenReference does not demonstrate this but the CSS is confirmed present. CRISIS badge uses this; STRAINED is static amber.

**Track bar smooth transition:** No CSS token defined. Use Tailwind: `transition-[width] duration-300 ease-out` on the fill div.

### Typography Tokens

| Token | Tailwind Class | Font |
|---|---|---|
| `--font-display` | `font-display` | Syne |
| `--font-body` | `font-body` (or default) | DM Sans |
| `--font-mono` | `font-mono` | IBM Plex Mono |

### Background Tokens

| Token | Class | Hex | Recommended Use |
|---|---|---|---|
| `--color-bg-base` | `bg-bg-base` | `#060810` | Page root |
| `--color-bg-panel` | `bg-bg-panel` | `#07090E` | Side panels |
| `--color-bg-surface` | `bg-bg-surface` | `#0A0D14` | Card/message surfaces |
| `--color-bg-elevated` | `bg-bg-elevated` | `#0D1017` | Hover states, input |

### Border Tokens

| Token | Class | Use |
|---|---|---|
| `--color-border-subtle` | `border-border-subtle` | Panel separators (very dark) |
| `--color-border-default` | `border-border-default` | Default borders |
| `--color-border-muted` | `border-border-muted` | Scrollbar thumb, mid-weight borders |
| `--color-border-dim` | `border-border-dim` | Slightly visible borders |

### Resource Colours (Team Card Values)

| Field | Token | Class | Hex |
|---|---|---|---|
| PC | `--color-resource-pc` | `text-resource-pc` | `#5B9BD5` (blue) |
| PO | `--color-resource-po` | `text-resource-po` | `#A29BFE` (purple) |
| RDY (readiness) | `--color-resource-readiness` | `text-resource-readiness` | `#2BC48A` (green) |
| STK (stock) | `--color-resource-stock` | `text-resource-stock` | `#74B9FF` (light blue) |
| CRM | `--color-resource-crm` | `text-resource-crm` | `#FF7675` (red) |
| IC | `--color-resource-ic` | `text-resource-ic` | `#FDCB6E` (amber) |

---

## Research Focus 5: App.tsx and Current GuardedGameScreen

**Source:** Direct read of `C:\KVWarGame\src\App.tsx` — HIGH confidence.

```typescript
function GuardedGameScreen() {
  const gameState = useGameStore((s) => s.gameState)
  if (gameState === null) {
    return <Navigate to="/setup" replace />
  }
  return <GameScreen />
}
```

`GameScreen.tsx` is currently a centered placeholder div in `src/components/game/GameScreen.tsx`. Phase 5 **replaces the contents of `GameScreen.tsx`** (or replaces the component wholesale) with the real three-column layout. `GuardedGameScreen` in `App.tsx` does NOT need to change — the mock injection bypasses the null-guard by seeding `gameState` before render.

**Mock injection hook:** Phase 5 must modify `GuardedGameScreen` (or the GameScreen mount) to call mock seeding when `gameState === null && import.meta.env.DEV`. One clean approach: change `GuardedGameScreen` to seed mock state and render instead of redirecting, gated on `DEV`. The alternative: call `useEffect(() => { if (!gameState && DEV) seedMock() }, [])` inside `GameScreen.tsx` itself before any redirect happens. Either is valid; the simpler approach is a dev-only shortcut in `GuardedGameScreen`.

---

## Research Focus 6: K/F/C vs KV/AF/MC Initials Conflict

**CONTEXT.md says:** "Coloured circles with a single initial (K / F / C)"

**Requirements CHAT-02 says:** "avatar (initials KV/AF/MC with persona colour)"

**Evidence check:** There is no persona metadata file in the codebase. The `PersonaId` values are `'kent'` | `'finch'` | `'chen'`. The EDIP_CONFIG personas array contains full character descriptions:
- Kent → not fully named in `PersonaId` (just `'kent'`)
- Characters in team descriptions: "Minister Jana Novak", "General Mikko Saarinen", etc. — these are TEAM personas, not the AI personas Kent/Finch/Chen.

**Resolution:** The AI personas are named Kent, Finch, Chen — these are single names (not first+last). "KV/AF/MC" in the requirements appears to refer to initials of full persona names that are **not yet defined in the codebase**. Looking at the CONTEXT.md's `#5B9BD5` Kent blue, Finch amber, Chen green — these are the three AI personas.

**Canonical answer:** The requirements specify "KV/AF/MC" as the two-letter initials. These likely stand for the personas' full names (Kent Vandermeer? Alicia Finch? Marcus Chen? — unverified from code). Since the requirements document is more specific than CONTEXT.md, **use KV/AF/MC** per REQUIREMENTS CHAT-02 as the authoritative spec.

**Action for planner:** Phase 5 must create a `src/lib/personaConfig.ts` file (or similar) that defines the full persona display names and two-letter initials. The exact full names should be confirmed with the user if not present in the codebase — they are NOT in `src/types/game.ts` or `src/data/edipConfig.ts`. This is a **blocking ambiguity** if the exact full names matter for display beyond initials. For Phase 5, hardcoding `{ kent: 'KV', finch: 'AF', chen: 'MC' }` is sufficient for the avatar circles.

---

## Research Focus 7: src/mocks/ Directory

**Status:** DOES NOT EXIST. Confirmed via filesystem check.

Phase 5 creates `src/mocks/` from scratch. Required file:

**`src/mocks/mockGameState.ts`** — A TypeScript module exporting a `MockGameState` object typed against `GameState` + `ChatMessage[]` + `GameConfig`. Must type-check cleanly.

**Required mock snapshot characteristics (from CONTEXT.md):**
- `round: 2`, `scenarioIndex: 0` (S1)
- `crisisSeverity: 3`, `edipLegitimacy: 1`
- `crisisState: 'Supply Crisis'` (matches severity 3 → supply crisis plausible)
- Teams: 4 teams; Team A: pc=1 (STRAINED), Team B: pc=0 (CRISIS), others normal
- `messages[]`: one of each type — `round_divider` (Round 1), persona messages (kent, finch, chen), facilitator message, `error` message, `debrief_divider` (or omit if too cluttered — CONTEXT.md allows this)
- `loading: true` at mount (shows loading bubble at tail). NOTE: `loading` is store state, not in `GameState` — the mock function must also call `setLoading(true)` or the mock snapshot object must include instructions to set it separately.
- Persona dots: two lit (kent, finch responded this round), chen dim. The mock messages must include at least one kent persona message and one finch persona message after the Round 2 divider, with no chen message after Round 2.

**Mock injection function:**
```typescript
// src/mocks/seedMockState.ts
import { useGameStore } from '@/lib/gameStore'
import { EDIP_CONFIG } from '@/data/edipConfig'
import { MOCK_GAME_STATE, MOCK_MESSAGES } from './mockGameState'

export function seedMockState() {
  const { setGameState, addMessages, setLoading, setGameConfig } = useGameStore.getState()
  setGameConfig(EDIP_CONFIG as GameConfig)
  setGameState(MOCK_GAME_STATE)
  addMessages(MOCK_MESSAGES)
  setLoading(true) // shows loading bubble at feed tail
}
```

---

## Research Focus 8: Sticky Layout Approach

**Recommendation: CSS Grid on root game screen container.** HIGH confidence in approach, MEDIUM confidence in exact Tailwind v4 syntax (confirmed working from TokenReference patterns).

### Layout Structure

```
┌─────────────────────────────────────────────┐
│ GameHeader (sticky top, spans full width)   │  row: auto
├──────────┬────────────────────┬─────────────┤
│StatePanel│     ChatFeed       │ReferencePanel│  row: 1fr
│ ~210px   │    flex center     │  ~252px     │
│overflow-y│  overflow-y-auto   │ overflow-y  │
│ -auto    │  (ONLY scroller)   │  -auto      │
├──────────┴────────────────────┴─────────────┤
│ FacilitatorInput (sticky bottom, full width)│  row: auto
└─────────────────────────────────────────────┘
```

### Implementation Pattern

```tsx
// GameScreen.tsx root
<div className="h-screen flex flex-col overflow-hidden bg-bg-base">
  <GameHeader />                    {/* flex-none */}
  <div className="flex flex-1 overflow-hidden min-h-0">
    <StatePanel />                  {/* w-[210px] flex-none overflow-y-auto */}
    <ChatFeed />                    {/* flex-1 overflow-y-auto */}
    <ReferencePanel />              {/* w-[252px] flex-none overflow-y-auto */}
  </div>
  <FacilitatorInput />              {/* flex-none */}
</div>
```

**Key detail:** `min-h-0` on the flex row prevents the row from growing past the viewport. Without it, the row ignores `overflow-hidden` on the parent and the page scrolls. This is the single most common CSS pitfall for this layout pattern.

**Alternative (CSS Grid):**
```tsx
<div className="h-screen grid grid-rows-[auto_1fr_auto] grid-cols-[210px_1fr_252px] overflow-hidden">
  <GameHeader className="col-span-3" />
  <StatePanel className="overflow-y-auto" />
  <ChatFeed className="overflow-y-auto" />
  <ReferencePanel className="overflow-y-auto" />
  <FacilitatorInput className="col-span-3" />
</div>
```

**Recommendation: Flex approach** (first option). More readable, easier to reason about in Tailwind, and the `min-h-0` trick is well-understood. Grid is equally valid but adds `col-span-3` boilerplate on header/footer.

### `position: sticky` vs `position: fixed`

Use **neither** for header/footer. Both header and footer are flex children of the root column — they are naturally "sticky" because the `flex-1 overflow-hidden` middle row contains all the scroll. Do not use `position: sticky` or `position: fixed`. They introduce stacking context issues and require explicit height calculations.

---

## Research Focus 9: Auto-Scroll Mechanism

**Recommendation: Sentinel ref + `useLayoutEffect` with conditional scroll.** HIGH confidence in pattern correctness.

### Pattern

```tsx
// Inside ChatFeed component
const feedRef = useRef<HTMLDivElement>(null)
const sentinelRef = useRef<HTMLDivElement>(null)
const [showScrollPill, setShowScrollPill] = useState(false)

// Check if user is "near bottom" before new message arrives
const isNearBottom = useCallback(() => {
  const el = feedRef.current
  if (!el) return true
  return el.scrollHeight - el.scrollTop - el.clientHeight < 100
}, [])

useLayoutEffect(() => {
  if (isNearBottom()) {
    sentinelRef.current?.scrollIntoView({ behavior: 'instant' })
    setShowScrollPill(false)
  } else {
    setShowScrollPill(true)
  }
}, [messages]) // fires synchronously after DOM update, before paint

// JSX
<div ref={feedRef} className="flex-1 overflow-y-auto" onScroll={handleScroll}>
  {/* rendered messages */}
  <div ref={sentinelRef} />  {/* zero-height sentinel at tail */}
</div>
{showScrollPill && (
  <button onClick={() => {
    sentinelRef.current?.scrollIntoView({ behavior: 'smooth' })
    setShowScrollPill(false)
  }}>
    ↓ New message
  </button>
)}
```

**Why `useLayoutEffect` over `useEffect`:** `useLayoutEffect` fires synchronously after DOM mutations but before paint. This prevents a frame where the old scroll position is visible before jumping — the "flash of wrong position" that `useEffect` causes.

**Why `scrollIntoView` over `scrollTop = scrollHeight`:** `scrollIntoView` on the sentinel handles both instant (on message add) and smooth (on pill click) correctly. No manual scroll math.

**`behavior: 'instant'` for new messages** (no animation flash). `behavior: 'smooth'` for the pill button click (satisfying UX).

**prefers-reduced-motion:**
```tsx
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
sentinelRef.current?.scrollIntoView({
  behavior: prefersReducedMotion ? 'instant' : 'smooth'
})
```

**`onScroll` handler to hide pill when user manually scrolls back to bottom:**
```tsx
const handleScroll = () => {
  if (isNearBottom()) setShowScrollPill(false)
}
```

**IntersectionObserver alternative:** An IntersectionObserver on the sentinel is more elegant for detecting "user at bottom" but adds complexity. The threshold-based scroll check (`< 100px`) is simpler, matches the Slack/Discord behaviour described in CONTEXT.md, and is sufficient for Phase 5. Skip IntersectionObserver.

### Message Entrance Animation

```css
@keyframes messageIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

This keyframe does not yet exist in `src/styles/index.css`. Phase 5 must add it to `@theme`. Tailwind class: `animate-[messageIn_180ms_ease-out_both]`.

**Reduced motion override:**
```tsx
<div className={cn(
  'animate-[messageIn_180ms_ease-out_both]',
  'motion-reduce:animate-none'
)}>
```

---

## Research Focus 10: Testing Approach

**Source:** Confirmed from `package.json` (Vitest 4.1.4, Testing Library 16.3.2, jsdom 29) and `vite.config.ts` (jsdom environment, globals: true) — HIGH confidence.

### What Vitest + Testing Library Can Verify

- Message rendering: render mock messages, assert correct elements appear by type
- Persona bubble: avatar initials render, correct colour class present
- Facilitator bubble: right-aligned, "FACILITATOR" label present
- Round divider: label text renders
- Error bubble: red classes applied
- Loading indicator: renders when `loading === true`, absent when `false`
- StatePanel: PC badge renders "STRAINED" when pc=1, "CRISIS" when pc=0, no badge when pc>=2
- Track bar: width style computed correctly for given severity/legitimacy values
- Persona dots: lit/dim state reflects which personas spoke this round
- ReferencePanel tabs: clicking tab renders correct content
- Card detail view: clicking card in list renders detail view, back button returns to list
- FacilitatorInput: Enter submits, Shift+Enter inserts newline (simulated with keyboard events)
- Disabled state: all inputs/buttons have `disabled` attribute when `loading === true`
- Empty input: send button click is no-op when input empty
- Action buttons: dispatching stub store actions appends expected messages

### What Requires Visual Check Only

- Exact column widths at 1280px (CSS layout — jsdom doesn't compute layout)
- Track bar fill animation (CSS transitions)
- CRISIS badge opacity pulse (CSS animation)
- Message entrance fade/translate animation
- Scroll behaviour (jsdom doesn't implement scroll)
- "↓ New message" pill positioning (CSS positioning)
- Font rendering (Google Fonts not loaded in jsdom)

### Test Strategy

- **Component unit tests:** One test file per major component (`ChatFeed.test.tsx`, `StatePanel.test.tsx`, `ReferencePanel.test.tsx`, `FacilitatorInput.test.tsx`)
- **Mock Zustand:** Tests use the existing `__mocks__/zustand.ts` auto-reset pattern (confirmed in `gameStore.test.ts` with `vi.mock('zustand')`)
- **No E2E tests** in Phase 5 — visual layout verification is a manual dev check at 1280px

---

## Architecture Patterns

### Recommended Component Structure

```
src/
├── mocks/
│   ├── mockGameState.ts      # Mock data (GameState + ChatMessage[])
│   └── seedMockState.ts      # Dev-only store seeder
├── lib/
│   ├── gameStore.ts          # Add advanceRound(), triggerDebrief(), sendFacilitatorMessage()
│   ├── personaConfig.ts      # NEW: persona display names, initials, colorClass
│   └── pcThresholds.ts       # NEW: pure functions getPcBadge(pc), getPersonasThisRound(messages)
├── components/
│   └── game/
│       ├── GameScreen.tsx    # Root layout (replaces placeholder)
│       ├── GameHeader.tsx    # Sticky top bar
│       ├── ChatFeed/
│       │   ├── ChatFeed.tsx           # Feed container + scroll logic
│       │   ├── PersonaMessage.tsx     # Persona bubble + avatar
│       │   ├── FacilitatorMessage.tsx # Right-aligned bubble
│       │   ├── RoundDivider.tsx       # Hr + label
│       │   ├── DebriefDivider.tsx     # Amber variant
│       │   ├── ErrorMessage.tsx       # Red banner
│       │   └── LoadingIndicator.tsx   # Animated dots (persona-attributed)
│       ├── StatePanel/
│       │   ├── StatePanel.tsx         # Left column container
│       │   ├── TrackBar.tsx           # Reusable severity/legitimacy bar
│       │   ├── TeamCard.tsx           # Team resource grid + PC badge
│       │   └── PersonaDots.tsx        # Three indicator dots
│       ├── ReferencePanel/
│       │   ├── ReferencePanel.tsx     # Right column + tab state
│       │   ├── CardsTab.tsx           # List + detail views
│       │   ├── ActionsTab.tsx         # National actions + team powers
│       │   └── GuideTab.tsx           # Six guide sections flat scroll
│       └── FacilitatorInput/
│           ├── FacilitatorInput.tsx   # Bottom bar container
│           ├── ActionToolbar.tsx      # Round Start, Trigger Debrief buttons
│           └── MessageInput.tsx       # Textarea + Send button
```

### Anti-Patterns to Avoid

- **`position: fixed` for header/footer:** Breaks the flex layout and requires `padding-top`/`padding-bottom` hacks on the middle panel.
- **Using Tailwind JIT dynamic classes for track width:** `w-[${value}%]` won't work — Tailwind v4 still requires literal classes in templates. Use `style={{ width: '60%' }}` inline.
- **Storing loading indicator as a ChatMessage:** The `MessageType` union does not include `'loading'`. Loading indicator is pure UI state from `store.loading`.
- **Appending debrief_divider to messages for mock without `label` field:** `ChatMessage.label` is the display text for dividers. Confirm the mock includes `label: "DEBRIEF"` on the debrief_divider.
- **Assuming `readiness` is named `rdy` in TypeScript:** The field is `readiness`. "RDY" is only the display label.
- **Using `useEffect` for auto-scroll:** Use `useLayoutEffect` to prevent the flash-of-wrong-position frame.
- **Grid column widths in Tailwind without arbitrary values:** `w-[210px]` and `w-[252px]` are arbitrary values — valid in Tailwind v4.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Scroll to bottom | Custom scroll manager class | `sentinelRef.scrollIntoView()` + `useLayoutEffect` | Simpler, browser-native, handles edge cases |
| Persona colour lookup | String switch/case | Record lookup object in `personaConfig.ts` | Type-safe, exhaustive with `PersonaId` key |
| Category colour lookup | String switch/case | `const CAT_COLORS: Record<string, string>` object | Maintainable, easy to extend |
| Track bar width | Dynamic Tailwind class | Inline `style={{ width }}` | Tailwind v4 purges dynamic strings |
| Reduced motion detection | Custom hook | `window.matchMedia('(prefers-reduced-motion: reduce)')` | One-liner, no library needed |
| Tab scroll preservation | Local state | Separate `scrollTop` per tab via `useRef` map | No library needed |

---

## Common Pitfalls

### Pitfall 1: Flex child height collapse
**What goes wrong:** The three-panel row collapses to content height and the page scrolls instead of the panels.
**Root cause:** Missing `min-h-0` on the flex row — flex children won't shrink below their content height by default.
**Prevention:** Always add `min-h-0` to the flex row containing the panels. Also ensure `overflow-hidden` on the row.

### Pitfall 2: Track bar width via Tailwind dynamic class
**What goes wrong:** `className={\`w-[\${pct}%]\`}` renders no width — Tailwind v4 purges classes not present as literal strings.
**Prevention:** Use `style={{ width: \`\${pct}%\` }}` for programmatic widths.

### Pitfall 3: Loading indicator as ChatMessage type
**What goes wrong:** Adding `type: 'loading'` to a ChatMessage fails TypeScript (`MessageType` doesn't include it).
**Prevention:** Render loading indicator as a conditional JSX element based on `store.loading`, not as a stored message.

### Pitfall 4: Auto-scroll race with React batching
**What goes wrong:** Scroll to bottom fires before the new message DOM node is rendered (because `useEffect` runs after paint).
**Prevention:** Use `useLayoutEffect` which fires synchronously after DOM update but before browser paint.

### Pitfall 5: Persona indicator state derivation
**What goes wrong:** Adding a dedicated `personasThisRound: Set<PersonaId>` to GameState and trying to keep it in sync with `round` advances — creates a second source of truth.
**Prevention:** Derive from `messages[]` in a pure function: find the last `round_divider` message, collect all `type === 'persona'` speakers after it.

### Pitfall 6: Tab scroll position lost on tab switch
**What goes wrong:** ReferencePanel scrollTop resets to 0 every time the user switches tabs.
**Prevention:** Store `scrollTop` per tab in a `useRef` map. On tab deactivate, save `el.scrollTop`; on tab activate, restore it via `el.scrollTop = savedValue` in `useLayoutEffect`.

### Pitfall 7: `animate-blink` vs Tailwind v4 arbitrary animation
**What goes wrong:** Using `animate-blink` (without brackets) — this is not a Tailwind utility; `--animate-blink` is a CSS custom property.
**Prevention:** Use `style={{ animation: 'var(--animate-blink)' }}` OR add a Tailwind plugin entry. The CSS variable approach is simpler.

---

## Open Questions / Blockers

### 1. Persona Full Names and Initials (MEDIUM priority blocker)
**What we know:** `PersonaId` is `'kent'` | `'finch'` | `'chen'`. Requirements say "KV/AF/MC" initials.
**What's unclear:** What are the full names? "Kent V...", "A. Finch", "M. Chen"?
**Recommendation:** The planner should ask the user for the full persona names, or assume:
- Kent → KV (Kent Vandermeer? or similar)
- Finch → AF (Alicia Finch? Angela Finch?)
- Chen → MC (Marcus Chen? Michael Chen?)

For Phase 5, hardcode `{ kent: 'KV', finch: 'AF', chen: 'MC' }` as initials with placeholder full names, and note that Phase 6 system prompts will need the actual names.

### 2. Debrief Divider in Mock (LOW priority)
**What we know:** CONTEXT.md says "OR omit the debrief divider from the default mock and include it in a second mock scenario file."
**Recommendation:** Include the debrief divider in the main mock (it exercises a required visual — REF-04 mentions it). Label it clearly in the mock comment as a preview/demo.

### 3. Legitimacy Track Bar Visual Direction (LOW priority, Claude's discretion)
**What we know:** The track goes −2 to +2 with zero centred. Current TokenReference shows a simple left-growing bar.
**Recommendation:** Use a centre-zero visual — the fill grows left (for negative) or right (for positive) from the centre point. This communicates the signed nature of the value. Implementation: two conditional fills or a CSS translate trick. The planner should task this as a specific sub-task.

### 4. GameHeader "New Game" Button Navigation
**What we know:** `resetGame()` exists in store. After reset, `gameState === null`, which triggers `GuardedGameScreen` to redirect to `/setup`.
**What's clear:** The "New Game" button should call `resetGame()` — the redirect is automatic. No additional navigation logic needed.

### 5. Guide Section Count (7 fields vs 6 sections)
**What we know:** EDIP_CONFIG has 7 guide text fields; REF-04 lists 6 sections.
**Recommendation:** Group `redLines` and `pcThresholds` into one section titled "Red Lines & PC Thresholds." The 7 fields become 6 display sections.

---

## Code Examples

### Persona Bubble (MessageType: 'persona')
```tsx
// PersonaMessage.tsx
function PersonaMessage({ message }: { message: ChatMessage }) {
  const meta = PERSONA_META[message.speaker as PersonaId]
  return (
    <div className="flex gap-3 items-start">
      <div className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center flex-none',
        meta.colorClass  // e.g. bg-persona-kent
      )}>
        <span className="text-white text-xs font-medium">{meta.initials}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex gap-2 items-baseline mb-1">
          <span className="text-xs font-medium" style={{ color: `var(--color-persona-${message.speaker})` }}>
            {meta.displayName}
          </span>
          <span className="text-xs text-text-muted font-mono">{message.timestamp}</span>
        </div>
        <div className={cn(
          'rounded-sm px-3 py-2 text-sm',
          `bg-persona-${message.speaker}/8 border-l-2 border-persona-${message.speaker}/50`
        )}>
          {message.text}
        </div>
      </div>
    </div>
  )
}
```

**Note:** The `bg-persona-kent/8` pattern works because Tailwind v4 reads the token from `@theme`. However `bg-persona-${dynamic}/8` dynamic class generation will be purged. Use a lookup:
```typescript
const BUBBLE_CLASSES: Record<PersonaId, string> = {
  kent:  'bg-persona-kent/8 border-persona-kent/50',
  finch: 'bg-persona-finch/8 border-persona-finch/50',
  chen:  'bg-persona-chen/8 border-persona-chen/50',
}
```

### TrackBar Component
```tsx
function TrackBar({ value, min, max, colorClass }: TrackBarProps) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="w-full h-1.5 bg-bg-surface rounded-sm overflow-hidden">
      <div
        className={cn('h-full rounded-sm transition-[width] duration-300 ease-out', colorClass)}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
```

### PC Badge
```tsx
function PcBadge({ pc }: { pc: number }) {
  if (pc === 0) return (
    <span
      className="text-xs font-mono px-1.5 py-0.5 rounded-sm bg-crisis-security/20 text-crisis-security"
      style={{ animation: 'var(--animate-blink)' }}
    >
      CRISIS
    </span>
  )
  if (pc === 1) return (
    <span className="text-xs font-mono px-1.5 py-0.5 rounded-sm bg-persona-finch/20 text-persona-finch">
      STRAINED
    </span>
  )
  return null
}
```

### Mock GameState Structure
```typescript
// src/mocks/mockGameState.ts
import type { GameState, ChatMessage } from '@/types/game'

export const MOCK_GAME_STATE: GameState = {
  round: 2,
  scenarioIndex: 0,
  crisisSeverity: 3,
  crisisState: 'Supply Crisis',
  edipLegitimacy: 1,
  cardsThisRound: [],
  teams: [
    { id: 'A', name: 'Team A: Frontline & High-Threat',  pc: 1, po: 0,  readiness: 3, stock: 2, crm: 2, ic: 2 }, // STRAINED
    { id: 'B', name: 'Team B: Industrial Powerhouses',   pc: 0, po: 1,  readiness: 3, stock: 3, crm: 2, ic: 5 }, // CRISIS
    { id: 'C', name: 'Team C: Rear Support & Logistics', pc: 3, po: 0,  readiness: 3, stock: 3, crm: 3, ic: 3 },
    { id: 'D', name: 'Team D: Balancing / Mixed-Interest', pc: 4, po: 1, readiness: 3, stock: 3, crm: 3, ic: 3 },
  ],
}

export const MOCK_MESSAGES: ChatMessage[] = [
  { id: 'm1', type: 'round_divider',   label: 'Round 1',       timestamp: '10:00' },
  { id: 'm2', type: 'persona',         speaker: 'kent',  text: '[Round 1 framing — CRM shortage identified...]', timestamp: '10:01' },
  { id: 'm3', type: 'persona',         speaker: 'finch', text: '[Round 1 economic analysis...]',                  timestamp: '10:02' },
  { id: 'm4', type: 'facilitator',     speaker: 'facilitator', text: 'Teams, please declare your national actions.', timestamp: '10:05' },
  { id: 'm5', type: 'error',           text: 'LLM timeout — response was not received. Please retry.',            timestamp: '10:06' },
  { id: 'm6', type: 'round_divider',   label: 'Round 2',       timestamp: '10:15' },
  { id: 'm7', type: 'persona',         speaker: 'kent',  text: '[Round 2 escalation response...]',                timestamp: '10:16' },
  { id: 'm8', type: 'persona',         speaker: 'finch', text: '[Round 2 industry position...]',                  timestamp: '10:17' },
  // chen has NOT spoken in Round 2 — dot will be dim
]
// Note: loading bubble (chen dot animating) is rendered via store.loading === true, not as a message
```

---

## Standard Stack Summary

No new packages required for Phase 5. All libraries already installed:

| Library | Version | Purpose |
|---|---|---|
| React | 19.2.5 | UI rendering |
| TypeScript | 6.0.2 | Type safety |
| Tailwind v4 | 4.2.2 | Styling via @tailwindcss/vite |
| Zustand + immer | 5.0.12 | Store (devtools + immer already configured) |
| react-router | 7.14.1 | Navigation |
| lucide-react | 1.8.0 | Icons (available for send button, back arrow, etc.) |
| Vitest | 4.1.4 | Tests |
| Testing Library | 16.3.2 | Component tests |

**lucide-react is already a dependency** — use it freely for:
- Send button: `<Send />` icon
- Back arrow in card detail: `<ArrowLeft />`
- New message pill: `<ChevronDown />`
- Error icon in error bubble: `<AlertCircle />` or `<XCircle />`

---

## Sources

### Primary (HIGH confidence — direct source inspection)
- `C:\KVWarGame\src\types\game.ts` — All TypeScript interfaces
- `C:\KVWarGame\src\types\llm.ts` — LLM response types
- `C:\KVWarGame\src\lib\gameStore.ts` — Complete store interface and implementations
- `C:\KVWarGame\src\data\edipConfig.ts` — All game data (cards, teams, actions, guide)
- `C:\KVWarGame\src\styles\index.css` — All @theme tokens
- `C:\KVWarGame\src\components\game\GameScreen.tsx` — Current placeholder
- `C:\KVWarGame\src\components\dev\TokenReference.tsx` — Proven Tailwind utility patterns
- `C:\KVWarGame\src\App.tsx` — GuardedGameScreen implementation
- `C:\KVWarGame\package.json` — Exact dependency versions
- `C:\KVWarGame\vite.config.ts` — Test configuration

### Secondary (MEDIUM confidence — well-established React patterns)
- `useLayoutEffect` for DOM-synchronous scroll: standard React pattern, no library verification needed
- `scrollIntoView` API: Web platform standard
- Flex `min-h-0` for nested scroll: CSS standard, widely documented

---

## Metadata

**Confidence breakdown:**
- TypeScript shapes: HIGH — read from source files directly
- Store state/actions: HIGH — read from source files directly
- Design tokens: HIGH — read from source files directly
- Data shapes: HIGH — read from source files directly
- Layout pattern: HIGH — standard CSS, confirmed with TokenReference patterns
- Auto-scroll mechanism: MEDIUM-HIGH — standard React pattern, not verified against specific React 19 docs
- Testing approach: HIGH — confirmed from vite.config.ts and existing test files

**Research date:** 2026-04-13
**Valid until:** Stable — this research reads locked source files; valid until Phase 5 implementation changes them
