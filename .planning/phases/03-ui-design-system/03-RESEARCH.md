# Phase 3: UI Design System - Research

**Researched:** 2026-04-13
**Domain:** Tailwind v4 CSS tokens, Google Fonts (Vite/React), dark ops-console aesthetic, component reference patterns
**Confidence:** HIGH

---

## Summary

Phase 3 defines the visual language for the war game console — a dark, ops/command-center aesthetic with Tailwind v4 CSS-first tokens, three Google Fonts, and a rendered component reference page. The spec token file (`index.css`) is already seeded with partial tokens from Phase 1. This phase completes it and validates every token in a reference page.

The project uses React + Vite + Tailwind v4 (CSS-first, `@tailwindcss/vite` plugin) — NOT Next.js. The spec doc references Next.js font loading patterns that do not apply here. Google Fonts must be loaded via `@import url()` at the top of `index.css`, or via `<link>` tags in `index.html` (preferred for Vite).

The existing `@theme {}` block already covers background, border, text, persona, and resource colours plus the three font family definitions. What is missing: card category colours, crisis badge colours, track/severity colours, spacing/radius tokens, animation keyframes, and the global scrollbar CSS. The component reference page does not yet exist.

**Primary recommendation:** Load Google Fonts via `<link preconnect>` in `index.html` (not CSS `@import`), complete the `@theme {}` block in `index.css` with all missing tokens, write global scrollbar and base styles in `@layer base`, then build a single `TokenReference.tsx` route that renders every token group as a visual swatch grid.

---

## Standard Stack

The stack is established from Phase 1. Nothing new is introduced in Phase 3.

### Core (already installed)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| tailwindcss | ^4.2.2 | Utility CSS + `@theme` tokens | CSS-first, no config file |
| @tailwindcss/vite | ^4.2.2 | Vite plugin integration | Replaces PostCSS setup |
| react | ^19.2.5 | Component rendering | For reference page |

### Supporting (already installed)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| lucide-react | ^1.8.0 | Icons in reference page | Optional for Phase 3 |

### External (network)
| Resource | URL | Notes |
|---------|-----|-------|
| Google Fonts — Syne | fonts.googleapis.com | weights 600, 700, 800 |
| Google Fonts — DM Sans | fonts.googleapis.com | weights 400, 500, 600 |
| Google Fonts — IBM Plex Mono | fonts.googleapis.com | weights 400, 500 |

**No new npm packages needed for Phase 3.**

**Font loading installation (index.html):**
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
```

---

## Architecture Patterns

### Tailwind v4 CSS-First Token Pattern

All design tokens live in `src/styles/index.css` inside `@theme {}`. The project already uses this pattern correctly. The naming convention maps directly to utility class names:

- `--color-persona-kent` → `bg-persona-kent`, `text-persona-kent`, `border-persona-kent`
- `--color-category-crisis` → `bg-category-crisis`, `text-category-crisis`
- `--font-display` → `font-display`
- `--font-body` → `font-body`
- `--font-mono` → `font-mono`

**Token hierarchy to complete:**

```
@theme {
  /* Already defined: bg, border, text, persona, resource, font families */

  /* Missing - add these: */
  --color-category-crisis: ...
  --color-category-monitoring: ...
  --color-category-prio-soft: ...
  --color-category-prio-hard: ...
  --color-category-demand: ...
  --color-category-production: ...
  --color-category-transfers: ...

  --color-crisis-none: ...
  --color-crisis-supply: ...
  --color-crisis-security: ...

  --color-track-severity: ...
  --color-track-legitimacy: ...

  /* Optional but useful: spacing overrides, radius tokens */
  --radius-sm: 2px;
  --radius-md: 4px;
  --radius-lg: 6px;
}
```

### Global Base Styles Pattern (Tailwind v4)

Scrollbars and body defaults go in `@layer base`, after `@theme {}`:

```css
@layer base {
  ::-webkit-scrollbar { width: 3px; height: 3px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--color-border-muted); border-radius: 2px; }

  * { scrollbar-width: thin; scrollbar-color: var(--color-border-muted) transparent; }

  body {
    background-color: var(--color-bg-base);
    color: var(--color-text-primary);
    font-family: var(--font-body);
  }
}
```

The `scrollbar-width: thin` + `scrollbar-color` pair handles Firefox; `::-webkit-scrollbar` handles Chrome/Edge/Safari. Both together cover all modern browsers without a plugin. **Do not use a scrollbar npm plugin** — raw CSS handles this with 6 lines.

### Animation Keyframes Pattern (Tailwind v4)

Keyframes that generate animation utilities live inside `@theme {}`:

```css
@theme {
  --animate-blink: blink 1.4s ease-in-out infinite;
  --animate-track-pulse: track-pulse 2s ease-in-out infinite;

  @keyframes blink {
    0%, 100% { opacity: 0.25; transform: scale(0.8); }
    50%       { opacity: 1;   transform: scale(1);   }
  }
}
```

This generates `animate-blink` and `animate-track-pulse` utility classes.

### Component Reference Page Pattern

A single route component at `src/components/dev/TokenReference.tsx` (or rendered at `/token-ref` via a dev-only route) that renders:

1. **Colour swatch grid** — each token group (background, border, text, persona, category, crisis, resource) as coloured divs with token name labels
2. **Typography specimens** — `font-display`, `font-body`, `font-mono` at multiple sizes/weights with sample text
3. **StatusBadge primitives** — all three crisis states using token colours
4. **Card category chips** — all seven categories using token colours
5. **Persona colour chips** — Kent/Finch/Chen with tint backgrounds

Each swatch renders its `var(--color-*)` name beneath it. This approach proves tokens resolve at render time without hardcoded hex values.

### Recommended Token File Structure

```
src/styles/index.css
├── @import url(...) Google Fonts     ← ONLY if not using index.html link tags
├── @import "tailwindcss"
├── @theme { ... }                    ← All design tokens
└── @layer base { ... }               ← Global element defaults + scrollbars
```

### Recommended Component Structure (Phase 3 only)

```
src/components/
└── dev/
    └── TokenReference.tsx            ← Reference page (dev-only, not wired to app nav)

src/styles/
└── index.css                        ← Completed @theme + @layer base
```

### Anti-Patterns to Avoid

- **`@import url()` in CSS after `@import "tailwindcss"`** — Browser spec requires `@import` before any other rules. If using CSS imports for fonts, they MUST be the very first line of `index.css`. The `index.html` `<link>` approach sidesteps this ordering problem entirely and is better for performance.
- **Hardcoded hex values in components** — All colour values must come from Tailwind token classes (`bg-persona-kent`) or `var(--color-*)`, not inline `style={{ color: '#5B9BD5' }}`.
- **Using `:root {}` instead of `@theme {}`** — Variables in `:root` are regular CSS variables and do not generate Tailwind utility classes.
- **Separate `tailwind.config.ts`** — The spec originally references one (the spec was written for Next.js + Tailwind v3). The actual project uses Tailwind v4 CSS-first; no config file exists or should be created.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cross-browser scrollbar styling | Custom plugin / npm package | Raw CSS `::-webkit-scrollbar` + `scrollbar-width: thin` | 6 lines covers all browsers; no dep needed |
| Font loading in Vite | `next/font/google` API | `<link rel="preconnect">` in `index.html` + `@theme` | next/font is Next.js-only; `<link>` is the correct Vite pattern |
| Token documentation | Storybook, chromatic | Single `TokenReference.tsx` component | Phase only needs a rendered visual reference, not a full component library |
| Scrollbar npm plugin | `tailwind-scrollbar` package | Raw CSS in `@layer base` | Overkill; 3px thin scrollbar needs no abstraction |

**Key insight:** This phase is entirely CSS and one React reference page. No new dependencies are needed. The complexity is in correctly structuring the token file, not in the tooling.

---

## Complete Token Values (from spec)

All values are sourced directly from `WARGAME_ENGINE_DEV_SPEC.md` section 12. These are authoritative — do not deviate.

### Already in index.css (verified correct)
- Background colours: `#060810`, `#07090E`, `#0A0D14`, `#0D1017`
- Border colours: `#0F1520`, `#141920`, `#1A2030`, `#1E2838`
- Text colours: `#BCC8D8`, `#6A7A90`, `#3A4A5A`
- Persona: Kent `#5B9BD5`, Finch `#DFA02A`, Chen `#2BC48A`
- Resource: PC `#5B9BD5`, PO `#A29BFE`, Readiness `#2BC48A`, Stock `#74B9FF`, CRM `#FF7675`, IC `#FDCB6E`
- Fonts: `--font-display`, `--font-body`, `--font-mono` (family strings defined)

### Missing from index.css — must add

**Card category colours** (from spec `CARD_CAT_COLORS`):
| Token name | Hex | Label |
|-----------|-----|-------|
| `--color-category-crisis` | `#FF6B6B` | Crisis State |
| `--color-category-monitoring` | `#74B9FF` | Monitoring |
| `--color-category-prio-soft` | `#FDCB6E` | Prioritisation (Soft) |
| `--color-category-prio-hard` | `#E17055` | Prioritisation (Hard) |
| `--color-category-demand` | `#55EFC4` | Demand Coordination |
| `--color-category-production` | `#81ECEC` | Production Acceleration |
| `--color-category-transfers` | `#A29BFE` | Transfers |

**Crisis badge colours** (derived from spec crisis state logic):
| Token name | Hex | Label |
|-----------|-----|-------|
| `--color-crisis-none` | `#2BC48A` | No Crisis (green — same as Chen/readiness) |
| `--color-crisis-supply` | `#FDCB6E` | Supply Crisis (amber) |
| `--color-crisis-security` | `#FF6B6B` | Security-Related (red — same as category-crisis) |

**Track colours** (from spec `track` section):
| Token name | Hex | Notes |
|-----------|-----|-------|
| `--color-track-severity` | `#FF6B6B` | Severity bar fill |
| `--color-track-legitimacy` | `#5B9BD5` | Legitimacy bar fill |

**Animations** (from spec animations section):
```css
--animate-blink: blink 1.4s ease-in-out infinite;
```

---

## Common Pitfalls

### Pitfall 1: Font import order in CSS
**What goes wrong:** `@import url(...)` placed after `@import "tailwindcss"` breaks font loading silently.
**Why it happens:** Browser spec: `@import` must precede all other rules in a CSS file.
**How to avoid:** Load fonts via `<link>` in `index.html` instead — this sidesteps CSS ordering entirely.
**Warning signs:** Fonts rendering as fallback sans-serif despite being in `@theme`.

### Pitfall 2: Token names not matching expected utility classes
**What goes wrong:** `--color-category-crisis-state` generates `bg-category-crisis-state` not `bg-category-crisis`.
**Why it happens:** The suffix after the namespace becomes the utility name verbatim.
**How to avoid:** Use short, hyphenated names: `--color-category-crisis`, `--color-crisis-none`. Verify class names in the reference page.
**Warning signs:** Tailwind class not applying; browser inspector shows unknown utility.

### Pitfall 3: Using `:root` for tokens instead of `@theme`
**What goes wrong:** Variables defined in `:root {}` don't generate utility classes. `bg-persona-kent` won't exist.
**Why it happens:** Forgetting the distinction between CSS custom properties (`--var` anywhere) vs Tailwind theme tokens (`@theme {}`).
**How to avoid:** All design tokens go in `@theme {}`. Only non-utility variables (e.g. runtime overrides) go in `:root`.
**Warning signs:** `var(--color-*)` works in raw CSS but `bg-*` / `text-*` utilities are missing.

### Pitfall 4: spec references tailwind.config.ts — this project doesn't use one
**What goes wrong:** Following the spec's TypeScript color object literally creates a `tailwind.config.ts` that conflicts with the v4 CSS-first setup.
**Why it happens:** Spec was authored for Next.js + Tailwind v3; actual project is Vite + Tailwind v4.
**How to avoid:** Translate all spec color values into `@theme {}` CSS variables. The token values are correct; the format shown in the spec is not applicable.
**Warning signs:** `tailwind.config.ts` alongside `@tailwindcss/vite` — the plugin ignores the config file in v4.

### Pitfall 5: Persona colour contrast on very dark backgrounds
**What goes wrong:** Kent blue (#5B9BD5) on bg-base (#060810) has a contrast ratio of ~5.4:1 — acceptable for text. But #DFA02A amber on the same background is ~6.2:1. Chen green (#2BC48A) is ~5.1:1. However, using these colours as background fills (tinted message bubbles) with primary text on top requires recalculating.
**Why it happens:** The persona colours are mid-tone; when used as backgrounds, text must be dark.
**How to avoid:** For persona tinted panels, use `opacity-10` or `opacity-15` variants of the persona colour as background, with primary text colour on top. Do NOT render primary text directly on a solid persona-coloured background.
**Warning signs:** Text unreadable in chat bubbles at full persona colour saturation.

---

## Code Examples

### Complete index.css pattern (verified against official docs)

```css
/* Source: Tailwind v4 font-family docs + theme docs */
/* IMPORTANT: font @imports must come before @import "tailwindcss" */
/* PREFERRED: use <link> tags in index.html instead (avoids ordering issues) */

@import "tailwindcss";

@theme {
  /* ── Backgrounds ──────────────────────────── */
  --color-bg-base:     #060810;
  --color-bg-panel:    #07090E;
  --color-bg-surface:  #0A0D14;
  --color-bg-elevated: #0D1017;

  /* ── Borders ──────────────────────────────── */
  --color-border-subtle:  #0F1520;
  --color-border-default: #141920;
  --color-border-muted:   #1A2030;
  --color-border-dim:     #1E2838;

  /* ── Text ─────────────────────────────────── */
  --color-text-primary:   #BCC8D8;
  --color-text-secondary: #6A7A90;
  --color-text-muted:     #3A4A5A;

  /* ── Persona ──────────────────────────────── */
  --color-persona-kent:  #5B9BD5;
  --color-persona-finch: #DFA02A;
  --color-persona-chen:  #2BC48A;

  /* ── Resources ────────────────────────────── */
  --color-resource-pc:        #5B9BD5;
  --color-resource-po:        #A29BFE;
  --color-resource-readiness: #2BC48A;
  --color-resource-stock:     #74B9FF;
  --color-resource-crm:       #FF7675;
  --color-resource-ic:        #FDCB6E;

  /* ── Card Categories ──────────────────────── */
  --color-category-crisis:     #FF6B6B;
  --color-category-monitoring: #74B9FF;
  --color-category-prio-soft:  #FDCB6E;
  --color-category-prio-hard:  #E17055;
  --color-category-demand:     #55EFC4;
  --color-category-production: #81ECEC;
  --color-category-transfers:  #A29BFE;

  /* ── Crisis States ────────────────────────── */
  --color-crisis-none:     #2BC48A;
  --color-crisis-supply:   #FDCB6E;
  --color-crisis-security: #FF6B6B;

  /* ── Track Bars ───────────────────────────── */
  --color-track-severity:   #FF6B6B;
  --color-track-legitimacy: #5B9BD5;

  /* ── Typography ───────────────────────────── */
  --font-display: 'Syne', sans-serif;
  --font-body:    'DM Sans', sans-serif;
  --font-mono:    'IBM Plex Mono', monospace;

  /* ── Border Radius ────────────────────────── */
  --radius-sm: 2px;
  --radius-md: 4px;
  --radius-lg: 6px;

  /* ── Animations ───────────────────────────── */
  --animate-blink: blink 1.4s ease-in-out infinite;

  @keyframes blink {
    0%, 100% { opacity: 0.25; transform: scale(0.8); }
    50%       { opacity: 1;   transform: scale(1);   }
  }
}

@layer base {
  /* Scrollbars — cross-browser thin/subtle */
  ::-webkit-scrollbar       { width: 3px; height: 3px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--color-border-muted); border-radius: 2px; }
  *                          { scrollbar-width: thin; scrollbar-color: var(--color-border-muted) transparent; }

  /* Body defaults */
  body {
    background-color: var(--color-bg-base);
    color: var(--color-text-primary);
    font-family: var(--font-body);
    -webkit-font-smoothing: antialiased;
  }
}
```

### Font loading in index.html (preferred pattern for Vite)

```html
<!-- Source: Tailwind v4 font docs + Vite best practice -->
<head>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
</head>
```

### StatusBadge component (token-driven, Phase 3 primitive)

```tsx
// Uses only Tailwind token classes — no hardcoded hex values
const CRISIS_STYLES = {
  'No Crisis':                    'bg-crisis-none/15 text-crisis-none border-crisis-none/30',
  'Supply Crisis':                'bg-crisis-supply/15 text-crisis-supply border-crisis-supply/30',
  'Security-Related Supply Crisis':'bg-crisis-security/15 text-crisis-security border-crisis-security/30',
} as const;

export function StatusBadge({ state }: { state: CrisisState }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-mono border rounded-sm ${CRISIS_STYLES[state]}`}>
      {state}
    </span>
  );
}
```

### Category chip pattern

```tsx
// Source: spec CARD_CAT_COLORS map translated to Tailwind tokens
const CATEGORY_TOKEN: Record<string, string> = {
  'Crisis State':             'category-crisis',
  'Monitoring':               'category-monitoring',
  'Prioritisation (Soft)':   'category-prio-soft',
  'Prioritisation (Hard)':   'category-prio-hard',
  'Demand Coordination':     'category-demand',
  'Production Acceleration': 'category-production',
  'Transfers':               'category-transfers',
};

export function CategoryChip({ category }: { category: string }) {
  const token = CATEGORY_TOKEN[category] ?? 'text-secondary';
  return (
    <span
      className="inline-block px-2 py-0.5 text-xs font-mono rounded-sm border"
      style={{
        color: `var(--color-${token})`,
        borderColor: `var(--color-${token})`,
        backgroundColor: `color-mix(in srgb, var(--color-${token}) 12%, transparent)`,
      }}
    >
      {category}
    </span>
  );
}
```

**Note on category chips:** Tailwind v4 arbitrary opacity modifiers (`bg-category-crisis/15`) require the token to be in `@theme`. This works if using class-based approach. The `color-mix()` inline style approach is an alternative that avoids generating many opacity variant classes but is slightly less portable. Either pattern is acceptable; class-based is more idiomatic.

### Persona tint pattern (ops/command-center treatment)

```tsx
// Subtle tint on dark bg — readable, not garish
// Kent message bubble example
<div className="bg-persona-kent/8 border-l-2 border-persona-kent/60 px-3 py-2">
  <span className="text-persona-kent text-xs font-mono uppercase tracking-widest">Kent</span>
  <p className="text-text-primary text-sm mt-1">{message}</p>
</div>
```

Opacity modifier values: `/8` for background tint, `/60` for border accent, solid `text-persona-kent` for label. This gives the ops-console feel without heavy saturation.

---

## Design Discretion Recommendations

These are Claude's recommendations for the decisions delegated in CONTEXT.md.

### Typography Hierarchy

| Element | Font | Weight | Size | Notes |
|---------|------|--------|------|-------|
| Screen titles, scenario names | `font-display` (Syne) | 700 | `text-xl` / `text-2xl` | Display use only — not body text |
| Section headers, panel labels | `font-mono` (IBM Plex Mono) | 500 | `text-xs` uppercase tracking-wide | Gives ops-console data-readout feel |
| Body text, messages, descriptions | `font-body` (DM Sans) | 400 | `text-sm` | Readable at density |
| Numbers, resource values, timestamps | `font-mono` (IBM Plex Mono) | 400 | `text-xs` / `text-sm` | Monospaced numbers align in columns |
| Button labels, nav items | `font-body` (DM Sans) | 500 | `text-sm` | Medium weight for UI chrome |

Rationale: IBM Plex Mono as section header treatment (uppercase, tracked) is unconventional but directly serves the military-briefing-room aesthetic. Syne reserved only for display-level titles prevents typeface fatigue.

### Persona Colour Treatment

Recommendation: **Subtle tinted border + muted background, vivid label text.**
- Message bubbles: `bg-persona-*/8` background tint, `border-l-2 border-persona-*/50` left accent
- Persona label (name tag): solid `text-persona-*` at full saturation
- Persona avatar/chip: `bg-persona-*/20` circle with solid `text-persona-*` initial

Rationale: At `/8` opacity on bg-base (`#060810`), the tint is barely perceptible — enough to differentiate persona lanes in the chat feed without colour fatigue across a long session. Bold border-left is the primary differentiator.

### Component Density and Style

Recommendation: **Flat/outlined with sharp corners (`rounded-sm`, 2px radius), no glassmorphism.**

Rationale for rejecting glassmorphism: The background is near-black (`#060810`). Glassmorphism requires a visible background layer beneath frosted surfaces to create the depth illusion. On near-black, `backdrop-blur` produces a nearly invisible effect and adds GPU overhead for no visual payoff. Flat outlined components with subtle border colours (`border-border-default`) are more readable at this background luminance level and reinforce the austere ops-console aesthetic over the consumer-SaaS frosted-glass look.

Badge shape: `rounded-sm` (2px). Sharp but not fully square.
Card shape: `rounded-md` (4px) for content cards.
Panel borders: `border border-border-subtle` or `border-border-default`.

### Crisis Badge Colour Intensity

Recommendation: Tinted background at 15% opacity with solid text and 30% opacity border. Full-saturation fill badges are too aggressive for a constant header element — they should draw attention when the state is critical without being permanently jarring.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tailwind.config.ts` colors object | `@theme {}` CSS variables | Tailwind v4 (2025) | No JS config file needed |
| `next/font/google` for font loading | `<link rel="preconnect">` + CSS `@import` | n/a — project is Vite not Next.js | Font loading stays in HTML |
| Separate PostCSS config | `@tailwindcss/vite` plugin | Tailwind v4 (2025) | No postcss.config.js |
| `theme.extend` for custom tokens | Direct `@theme {}` declaration | Tailwind v4 (2025) | All tokens in one CSS block |

---

## Open Questions

1. **Google Stitch session (plan step 03-01)** — The phase plan includes a Google Stitch design session to produce layout reference screens. Google Stitch is a generative design tool. Research cannot determine the current capability or access method without user confirmation. The output of that session (exported images/layout directions) feeds into the token validation, but it is not a technical prerequisite for the token CSS work. The token values are fully defined in the spec. The Stitch session is directional, not blocking.
   - What we know: Token values are complete in the spec; Stitch produces visual reference
   - What's unclear: Whether Stitch is accessible in this environment
   - Recommendation: Plan the Stitch step as best-effort directional input; treat token work as independently executable

2. **`@theme inline` vs `@theme` for font variables** — Official docs show `@theme inline` used when referencing runtime CSS variables (`var(--some-var)`) inside `@theme`. For the font families defined as string literals, plain `@theme` is correct. Confidence: HIGH.

3. **`color-mix()` browser support for category chip tints** — `color-mix(in srgb, ...)` has baseline support in Chrome 111+, Firefox 113+, Safari 16.2+. For a corporate facilitator tool running on modern browsers, this is safe. If Firefox < 113 is a concern, use Tailwind opacity modifier classes instead.

---

## Sources

### Primary (HIGH confidence)
- Tailwind CSS official docs — `https://tailwindcss.com/docs/theme` — @theme directive, naming conventions, CSS variable output
- Tailwind CSS official docs — `https://tailwindcss.com/docs/font-family` — font family theme variables, @import ordering
- Tailwind CSS official docs — `https://tailwindcss.com/docs/adding-custom-styles` — @layer base, global styles
- `WARGAME_ENGINE_DEV_SPEC.md` — Section 12 — all colour hex values, font weights, animation CSS, scrollbar CSS
- `src/styles/index.css` — existing tokens (read directly)
- `package.json` — Tailwind v4.2.2 + @tailwindcss/vite confirmed
- `vite.config.ts` — CSS-first setup confirmed, `@/` alias confirmed

### Secondary (MEDIUM confidence)
- Harrison Broadbent blog — `https://harrisonbroadbent.com/blog/tailwind-custom-fonts/` — Google Fonts @import ordering in Tailwind v4, verified against official docs
- Hatchet blog — `https://hatchet.com.au/blog/how-to-use-google-fonts-in-tailwind-css/` — HTML `<link>` vs CSS `@import` for Vite, verified against Tailwind docs

### Tertiary (LOW confidence)
- WebSearch results on glassmorphism and ops-console UI — directional aesthetic guidance only; design decisions are Claude's discretion per CONTEXT.md

---

## Metadata

**Confidence breakdown:**
- Token values (hex colours): HIGH — sourced directly from spec
- Tailwind v4 @theme syntax: HIGH — verified against official docs
- Font loading pattern for Vite: HIGH — `<link>` in index.html is well-established
- Scrollbar CSS: HIGH — native CSS, no library dependency
- Component reference page structure: HIGH — standard React pattern
- Design discretion recommendations (typography hierarchy, persona treatment): MEDIUM — judgment-based, informed by ops/command-center aesthetic principles

**Research date:** 2026-04-13
**Valid until:** 2026-07-13 (Tailwind v4 stable; 90-day validity)
