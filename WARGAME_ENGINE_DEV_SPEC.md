# War Game Engine — Claude Code Development Specification
**Document version:** 1.0  
**Date:** April 2026  
**Purpose:** Complete implementation specification for Claude Code. Read this document in full before writing any code.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Goals and Non-Goals](#2-goals-and-non-goals)
3. [Tech Stack](#3-tech-stack)
4. [Project Structure](#4-project-structure)
5. [Environment Configuration](#5-environment-configuration)
6. [Data Models](#6-data-models)
7. [Game Configuration Data](#7-game-configuration-data)
8. [State Management](#8-state-management)
9. [Corporate LLM Integration](#9-corporate-llm-integration)
10. [Persona System and Routing Logic](#10-persona-system-and-routing-logic)
11. [Component Specifications](#11-component-specifications)
12. [UI Design System](#12-ui-design-system)
13. [Page and Routing Architecture](#13-page-and-routing-architecture)
14. [Implementation Phases](#14-implementation-phases)
15. [Testing Requirements](#15-testing-requirements)
16. [Deployment Notes](#16-deployment-notes)

---

## 1. Project Overview

The **War Game Engine** is a three-persona AI-powered facilitation assistant for structured policy tabletop exercises. It operates **alongside** a human facilitation team running a live game — it is not a standalone simulation.

The application embodies three expert AI personas that respond in character to events described by the human facilitator:

| Persona | Role | Voice |
|---|---|---|
| **Kent Valentina** | Facilitator (Oliver Wyman) | Structured, inclusive, question-led |
| **Dr. Alistair Finch** | Scenario Engine & Analytics | Precise, data-driven, consequential |
| **Dr. Michael Chen** | Technical Oracle & Mechanism Specialist | Grounding, procedurally rigorous, challenging |

The initial game supported is the **EDIP Security of Supply Wargame** — a European Defence Industrial Policy simulation with two scenarios. The architecture is fully **reusable**: any game can be loaded via JSON configuration or generated from a plain-text brief.

The application must run against a **configurable corporate LLM endpoint** — not Anthropic's public API. The LLM endpoint, API key, model name, and any corporate-specific headers must be configurable via environment variables.

---

## 2. Goals and Non-Goals

### Goals
- Production-quality web application deployable on corporate infrastructure
- Configurable LLM backend (corporate API endpoint, not hardcoded to Anthropic)
- Server-side API proxying so LLM credentials never reach the browser
- Reusable game engine: load any JSON config or generate one from a text brief
- Three visually distinct persona voices in a real-time chat interface
- Live game state dashboard (tracks, team resources)
- In-session card reference, national actions, and unique team power reference
- Session export: downloadable debrief report
- Responsive layout (1280px+ primary target; tablet-usable)
- TypeScript throughout

### Non-Goals
- Multi-user real-time collaboration (single-facilitator use)
- Authentication / user accounts (handled by corporate SSO layer if needed)
- Mobile-first design (it is a facilitation tool used on a laptop at a table)
- Persistent game history across sessions (session-only state)
- Full game automation (it assists humans; it does not replace them)

---

## 3. Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | **Next.js 14+ (App Router)** | Server-side API proxy for LLM credentials; easy corporate deployment |
| Language | **TypeScript 5+** | Type safety for complex game state |
| Styling | **Tailwind CSS** with custom design tokens | Utility-first; consistent with design system below |
| State | **Zustand** | Simple, non-verbose, no boilerplate; fine for single-session state |
| Icons | **Lucide React** | Lightweight, consistent |
| Package manager | **pnpm** (or npm — facilitator's preference) | |
| Node | **18+** | |

### Key architectural decision: Next.js API route as LLM proxy

All LLM calls **must** go through a Next.js API route (`/api/llm`). The browser never holds or sends API keys. The API route reads credentials from environment variables and forwards the request to the corporate LLM endpoint. This is non-negotiable for corporate deployment.

---

## 4. Project Structure

```
war-game-engine/
├── .env.local                     # Local env vars (never committed)
├── .env.example                   # Template — commit this
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
│
├── src/
│   ├── app/
│   │   ├── layout.tsx             # Root layout, fonts, global styles
│   │   ├── page.tsx               # Entry: redirects to /setup
│   │   ├── setup/
│   │   │   └── page.tsx           # Setup screen
│   │   ├── game/
│   │   │   └── page.tsx           # Game screen
│   │   └── api/
│   │       ├── llm/
│   │       │   └── route.ts       # LLM proxy — all AI calls go here
│   │       └── generate-config/
│   │           └── route.ts       # Game config generation from brief
│   │
│   ├── components/
│   │   ├── setup/
│   │   │   ├── SetupScreen.tsx
│   │   │   ├── LoadConfigPanel.tsx
│   │   │   └── GenerateBriefPanel.tsx
│   │   ├── game/
│   │   │   ├── GameScreen.tsx     # Top-level game layout
│   │   │   ├── GameHeader.tsx     # Round, crisis state, controls
│   │   │   ├── StatePanel.tsx     # Left panel: tracks + team resources
│   │   │   ├── ChatFeed.tsx       # Center: persona messages
│   │   │   ├── PersonaMessage.tsx # Individual message bubble
│   │   │   ├── RoundDivider.tsx   # Visual round separator
│   │   │   ├── FacilitatorInput.tsx # Bottom input bar + action buttons
│   │   │   └── ReferencePanel.tsx # Right panel: cards/actions/guide
│   │   └── shared/
│   │       ├── TrackBar.tsx       # Animated progress bar
│   │       ├── StatusBadge.tsx    # Crisis state badge
│   │       └── LoadingDots.tsx    # Thinking indicator
│   │
│   ├── lib/
│   │   ├── gameStore.ts           # Zustand store
│   │   ├── llmClient.ts           # Client-side fetch to /api/llm
│   │   ├── promptBuilder.ts       # Builds system prompt from game state
│   │   ├── stateUpdater.ts        # Applies LLM state deltas to game state
│   │   └── debriefExporter.ts     # Generates downloadable debrief report
│   │
│   ├── data/
│   │   └── edipConfig.ts          # The canonical EDIP game configuration
│   │
│   └── types/
│       ├── game.ts                # All TypeScript interfaces
│       └── llm.ts                 # LLM request/response types
│
└── public/
    └── favicon.ico
```

---

## 5. Environment Configuration

### `.env.example` (commit this file)

```bash
# ─── Corporate LLM Configuration ───────────────────────────────────────────
# The base URL of your corporate LLM API (OpenAI-compatible or custom)
LLM_API_BASE_URL=https://your-corporate-llm.example.com/v1

# Your corporate API key or bearer token
LLM_API_KEY=your-api-key-here

# The model identifier as expected by your corporate LLM
LLM_MODEL=gpt-4o

# Optional: additional headers required by your corporate LLM (JSON string)
# Example: {"X-Corporate-Header":"value","X-Team":"edip-wargame"}
LLM_EXTRA_HEADERS={}

# Max tokens for game responses (1000 recommended for 2–4 sentence persona responses)
LLM_MAX_TOKENS=1000

# Max tokens for config generation (2000 recommended)
LLM_CONFIG_GEN_MAX_TOKENS=2000

# ─── App Configuration ──────────────────────────────────────────────────────
NEXT_PUBLIC_APP_TITLE=EDIP War Game Engine
```

### LLM API Compatibility

The LLM proxy (`/api/llm/route.ts`) should be written to support **OpenAI-compatible Chat Completions format** as the default. This covers most corporate LLM deployments (Azure OpenAI, AWS Bedrock via proxy, internal OpenAI-compatible endpoints).

If your corporate LLM uses a different format, the proxy route is the single place to adapt it — the rest of the application is format-agnostic.

The proxy accepts this internal format (from the frontend):

```typescript
{
  systemPrompt: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  maxTokens?: number;
}
```

And it sends to the corporate LLM in OpenAI format:

```typescript
{
  model: process.env.LLM_MODEL,
  max_tokens: maxTokens || 1000,
  messages: [
    { role: "system", content: systemPrompt },
    ...messages
  ]
}
```

---

## 6. Data Models

### `src/types/game.ts`

```typescript
// ─── Crisis States ───────────────────────────────────────────────────────────

export type CrisisState =
  | "No Crisis"
  | "Supply Crisis"
  | "Security-Related Supply Crisis";

export type PersonaId = "kent" | "finch" | "chen";

// ─── Game Configuration ──────────────────────────────────────────────────────

export interface TeamConfig {
  id: string;               // "A" | "B" | "C" | "D"
  name: string;             // e.g. "Team A: Frontline & High-Threat"
  description: string;
  personas: string[];       // Character sheet summaries (2 personas per team)
  uniqueAction: string;     // Full rules text for unique team power
  // Starting resource values
  pc: number;               // Political Capital (0–6)
  po: number;               // Public Opinion (-2 to +2)
  readiness: number;        // Readiness / Resilience (0–5)
  stock: number;            // Defence Stock (blue cubes)
  crm: number;              // Critical Raw Materials (red discs)
  ic: number;               // Industrial Capacity (grey cylinders)
}

export interface ScenarioStartState {
  crisisSeverity: number;   // 0–5
  crisisState: CrisisState;
  edipLegitimacy: number;   // -2 to +2
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  rounds: number;
  startState: ScenarioStartState;
  injects: string[];        // One per round
}

export interface NationalAction {
  id: string;
  name: string;
  summary: string;
  cost: string;
}

export interface GameCard {
  id: string;
  name: string;
  cat: string;              // Category (used for colour coding)
  timing: string;
  req: string;              // Preconditions
  effect: string;
}

export interface GameConfig {
  name: string;
  domain: string;
  description: string;
  scenarios: Scenario[];
  teams: TeamConfig[];
  nationalActions: NationalAction[];
  cards: GameCard[];
  objective: string;
  redLines: string;
  pcThresholds: string;
  votingRule: string;
  eoMechanic: string;
  resourceLogic: string;
  facilitation: string;
}

// ─── Live Game State ─────────────────────────────────────────────────────────

export interface TeamState {
  id: string;
  name: string;
  pc: number;
  po: number;
  readiness: number;
  stock: number;
  crm: number;
  ic: number;
}

export interface GameState {
  round: number;
  scenarioIndex: number;
  crisisSeverity: number;
  crisisState: CrisisState;
  edipLegitimacy: number;
  teams: TeamState[];
  cardsThisRound: string[];
}

// State update payload from LLM
export interface StateUpdate {
  crisisSeverity?: number;
  crisisState?: CrisisState;
  edipLegitimacy?: number;
  teamUpdates?: Partial<TeamState & { id: string }>[];
}

// ─── Messages ────────────────────────────────────────────────────────────────

export type MessageType =
  | "persona"
  | "facilitator"
  | "round_divider"
  | "debrief_divider"
  | "error";

export interface ChatMessage {
  id: string;
  type: MessageType;
  speaker?: PersonaId | "facilitator";
  text?: string;
  flag?: string | null;    // Facilitator note from LLM
  label?: string;          // For dividers
  timestamp: string;
  isDebrief?: boolean;
}

// ─── App Phase ───────────────────────────────────────────────────────────────

export type AppPhase = "setup" | "game" | "debrief";
export type SetupMode = "home" | "load" | "brief" | "review";
```

### `src/types/llm.ts`

```typescript
export interface LLMRequest {
  systemPrompt: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  maxTokens?: number;
}

export interface LLMResponse {
  text: string;
  error?: string;
}

// The structured JSON the LLM returns (parsed from text)
export interface PersonaResponse {
  speaker: "kent" | "finch" | "chen";
  message: string;
  stateUpdate: import("./game").StateUpdate | null;
  flag: string | null;
}

export interface LLMStructuredResponse {
  responses: PersonaResponse[];
}
```

---

## 7. Game Configuration Data

### `src/data/edipConfig.ts`

This file contains the authoritative EDIP game configuration. Implement it as an exported TypeScript constant of type `GameConfig`.

```typescript
import type { GameConfig } from "@/types/game";

export const EDIP_CONFIG: GameConfig = {
  name: "EDIP Security of Supply Wargame",
  domain: "European Defence Technological and Industrial Base (EDTIB)",
  description: "Stress-test EDIP Security of Supply mechanisms under two crisis scenarios. Explore when EDIP tools enable effective collective action and where they create bottlenecks. Generate concrete observations and recommendations. NOT a legal interpretation exercise, exact military simulation, or forecasting model.",

  scenarios: [
    {
      id: "S1",
      name: "Scenario 1: Germanium / CRM Supply Crisis",
      description: "Escalating tensions with China culminate in a Germanium export cut-off. EU depends on imports for infrared optics, thermal imaging, UAV payloads and space sensors. Up to 20% of EU UAV production at risk. Stress-test EDIP supply crisis activation, information-gathering, prioritisation and coordinated procurement under a non-military but defence-relevant market disruption.",
      rounds: 4,
      startState: { crisisSeverity: 0, crisisState: "No Crisis", edipLegitimacy: 0 },
      injects: [
        "ROUND 1 — SHOCK & DISCOVERY: China announces a significant restriction of Germanium exports to Western countries. Markets react; prices spike sharply. Crisis Severity rises to 1. No EDIP crisis state yet. Hidden CRM distribution is uneven — some teams have multi-year stockpiles, others are acutely exposed. KEY TENSION: do teams lean into early EDIP monitoring tools, or rely on national and industry channels until the crisis worsens?",
        "ROUND 2 — SUPPLY CRISIS THRESHOLD?: Additional suppliers hint at aligning with Chinese restrictions; risk of broader global CRM tightening. Some Member States are exploring aggressive national stockpiling. Crisis Severity moving toward 2–3 depending on prior actions; EU faces risk of divergent national measures. KEY TENSION: whether EDIP can prevent fragmented national responses and align allocation of scarce CRM and production capacity.",
        "ROUND 3 — DIVERGENCE OR COORDINATION: Deeper analysis reveals up to 20% of EU UAV production is at risk. Several states face acute CRM shortages while others have ample stock. Crisis Severity rises to 2; arguments emerge about whether EDIP supply crisis activation threshold is now met. KEY TENSION: whether to activate formal supply crisis and accept EDIP obligations vs continue with national emergency measures and bilateral deals.",
        "ROUND 4 — STABILISE OR FRAGMENT: Trajectory reflects earlier choices — either partial stabilisation via EDIP coordination, or deepening fragmentation with national export controls and hoarding. Crisis Severity may stabilise or remain high. KEY TENSION: willingness to accept longer-term EDIP constraints and production acceleration in exchange for greater EDTIB resilience."
      ]
    },
    {
      id: "S2",
      name: "Scenario 2: Eastern Flank — Hybrid to Hot War",
      description: "Escalating Russian hybrid actions against EU's eastern flank evolve into a hot war with an attack on Baltic states. NATO and EU must reinforce and sustain high-intensity operations under severe supply and industrial pressures. Stress-test security-related supply crisis, mandatory prioritisation, intra-EU transfers, continuity of production and mutual recognition.",
      rounds: 5,
      startState: { crisisSeverity: 0, crisisState: "No Crisis", edipLegitimacy: 0 },
      injects: [
        "ROUND 1 — HYBRID PRESSURE: Increased Russian hybrid activities — cyber attacks on infrastructure, disinformation campaigns, airspace violations, small border incidents. Crisis Severity rises to 1. EDIP Crisis State remains No Crisis. KEY TENSION: whether to use EDIP monitoring tools early or rely primarily on NATO and national channels at this stage.",
        "ROUND 2 — ESCALATING INCIDENTS: A serious incident — artillery strike in a border area, major cyber disruption to rail and logistics; limited kinetic engagements begin. Crisis Severity rises to 2. Questions arise about activating EDIP supply crisis for key munitions and systems. KEY TENSION: when is a supply crisis label justified, and which states support or oppose early activation?",
        "ROUND 3 — ATTACK ON BALTIC STATES: Russia launches a large-scale attack on one or more Baltic states; heavy kinetic operations and mobilisations begin; NATO and EU invoke high-level responses. Crisis Severity jumps to 3–4; defence stocks in frontline states begin to deplete rapidly. KEY TENSION: willingness to accept far-reaching EDIP powers under existential threat vs concerns about sovereignty and industrial disruption.",
        "ROUND 4 — SUSTAINED HIGH-INTENSITY CONFLICT: Weeks of intense operations; attrition of munitions, air defence interceptors and ISR assets; industrial bottlenecks are now binding. Crisis Severity remains high; Security-related supply crisis state is active. KEY TENSION: whether EDIP production acceleration tools can prevent supply collapse and how repeated mandatory orders affect EDIP legitimacy and domestic politics.",
        "ROUND 5 — STABILISATION, ESCALATION OR STALEMATE: Several possible trajectories — stabilised front, risk of escalation, or ceasefire proposals. EDIP Crisis State may remain Security-related or begin to wind down. KEY TENSION: which EDIP tools are seen as structurally valuable for future resilience vs too intrusive for normal times?"
      ]
    }
  ],

  teams: [
    {
      id: "A",
      name: "Team A: Frontline & High-Threat",
      description: "High security exposure, limited industrial depth, strong case for EDIP support. High political urgency and legitimacy claims; sensitive domestic opinion.",
      personas: [
        "Minister Jana Novak — Defence Minister. Wants early crisis activation, rapid resupply, mandatory prioritisation if voluntary fails. Will not accept plans risking frontline capability gaps. Strongly favours CS-01/CS-02 activation. Impatient with legal delays.",
        "General Mikko Saarinen — Chief of Defence. Sceptical of process; focused on operational results. Will not tolerate diversion of supplies already committed to frontline units. Neutral on information requests; impatient with slow voluntary measures."
      ],
      uniqueAction: "ESCALATE SECURITY NARRATIVE (once per round): If Readiness ≤ 3 OR crisis inject clearly justifies it, may increase Crisis Severity +1 (max 5). Makes stronger EDIP tools more plausible. Cost: PC -1. If ≥ 2 other teams declare escalation premature: EDIP Legitimacy -1 (perceived alarmism).",
      pc: 3, po: 0, readiness: 3, stock: 2, crm: 2, ic: 2
    },
    {
      id: "B",
      name: "Team B: Industrial Powerhouses",
      description: "Large defence industrial bases, critical stocks and capacity. Key actors in prioritisation and production ramp-up. Sensitive to EDIP obligations and long-term competitiveness impact.",
      personas: [
        "Minister Clara Moreau — Industry & Defence Economy. Protects long-term competitiveness; resists intrusive information requests; accepts mandatory prioritisation only as last resort with fair compensation. Wants EU support for capacity ramp-up.",
        "PM Luca Rossi — Council Representative. Manages coalition stability; wants safeguards on all mandatory orders; shapes Council outcomes to avoid bloc polarisation. Wants to appear solidary without bearing disproportionate burden."
      ],
      uniqueAction: "SHAPE INDUSTRIAL RESPONSE (once per round — choose Mode): Mode A SURGE: gain +1 temporary Industrial Capacity (IC) this round only; PO -1 (domestic overtime/environmental backlash). Mode B SHIELD: designate one IC token that cannot be targeted by Mandatory Prioritisation Order (SP-02) this round; PC -1. IMPORTANT: If Team B also receives EDIP help this round while using Shield, flag EDIP Legitimacy -1 in debrief (perceived free-riding asymmetry).",
      pc: 4, po: 1, readiness: 3, stock: 3, crm: 2, ic: 5
    },
    {
      id: "C",
      name: "Team C: Rear Support & Logistics",
      description: "Crucial for logistics corridors, basing and niche production. Controls the timing of support flows. Must manage domestic opinion around support roles and perceived militarisation.",
      personas: [
        "Minister Elena Petrova — Foreign Affairs. Wants recognition and compensation for rear-area role; will not be treated as mere transit corridor; cautious about being drawn deeper into conflict. Uses logistics leverage to bargain for investment.",
        "General Markus Lindgren — Logistics & Infrastructure Commander. Focused on corridor feasibility; demands investment and regulatory waivers; will not overload single corridors without redundancy. Positive on fast-track transfers if corridors are funded."
      ],
      uniqueAction: "REAR SUPPORT LEVERAGE (once per round): After EDIP decisions but BEFORE final token moves are applied, select one agreed transfer or allocation. BOOST FLOW: that transfer arrives this round instead of next (no automatic cost; seen positively as facilitation). CONSTRAIN FLOW: that transfer is delayed by +1 round; Team C PC +1; the recipient team PO -1 (domestic frustration at allied delay).",
      pc: 3, po: 0, readiness: 3, stock: 3, crm: 3, ic: 3
    },
    {
      id: "D",
      name: "Team D: Balancing / Mixed-Interest",
      description: "Politically influential, diverse interests, often pivotal in building Council compromises. Strong voice on legal and procedural aspects; swing influence in EDIP decisions.",
      personas: [
        "Minister Sofia Weber — Justice/EU Affairs. Demands proportionality and clear legal basis; will not support EDIP measures without documented trigger justification; positive on voluntary measures, hostile to mandatory without safeguards.",
        "Minister Tomasz Kowalski — Finance. Limits unplanned fiscal exposure; resists open-ended commitments without cost caps; positive on coordinated procurement for economies of scale; wants burden-sharing mechanisms in place before agreeing mandatory orders."
      ],
      uniqueAction: "PROCEDURAL CHALLENGE (once per round): Select one EDIP proposal on the agenda. Option A RAISE THRESHOLD: that proposal now requires Support from all 4 teams to pass this round (instead of the standard Support ≥ 3). Option B DELAY: remove proposal from this round's agenda; place at top of next round. Cost: PC -1. Team D must briefly state a rule-of-law or proportionality concern. If used in two consecutive rounds: EDIP Legitimacy -1 (system perceived as gridlocked by procedure).",
      pc: 4, po: 1, readiness: 3, stock: 3, crm: 3, ic: 3
    }
  ],

  nationalActions: [
    {
      id: "NA-1",
      name: "Adjust National Stockpiles",
      summary: "Move any stock/CRM tokens into a 'Committed this round' area. Only committed tokens can be used to raise Readiness or offered in voluntary transfers/EDIP measures this round. Tokens consumed only when actually spent, transferred, or required by EDIP card. Mandatory EDIP measures can still target uncommitted stock.",
      cost: "No direct track cost. Over-committing exposes more stock to requests; under-committing limits your own readiness gains and credibility."
    },
    {
      id: "NA-2",
      name: "National Emergency Measure",
      summary: "Declare a national control on one stock type for this round. Cannot voluntarily transfer/commit that stock type to others (except via mandatory EDIP tools). Your Readiness/Resilience will not drop this round purely due to that stock type.",
      cost: "PC -1. If at least one other team publicly objects: EDIP Legitimacy -1. Seen as undermining coordination."
    },
    {
      id: "NA-3",
      name: "Bilateral / Minilateral Deal",
      summary: "Negotiate a deal with one or more teams (all parties must consent). May trade: stock/CRM tokens, IC tokens (this or next round), up to ±1 PC per party, explicit future support for a named EDIP measure. Token moves take effect according to agreed timing.",
      cost: "Uses one action slot + whatever tokens/PC you give up. No hidden extra penalties."
    },
    {
      id: "NA-4",
      name: "Public Narrative Management",
      summary: "Option A 'Sell EDIP at home': PO +1; EDIP Legitimacy +1 if you visibly backed at least one strong EDIP card this round (CS-01/02, SP-02, PA-01/02, TR-01); PC -1. Option B 'Blame Brussels': PO +1; EDIP Legitimacy -1; you cannot request new strong EDIP measures next round (you've told domestic audiences they're a problem).",
      cost: "A: PC -1. B: no PC cost but lose ability to request strong EDIP next round."
    }
  ],

  cards: [
    {
      id: "CS-01", name: "Activate Supply Crisis", cat: "Crisis State",
      timing: "This Round",
      req: "Crisis Severity ≥ 2. Evidence of serious disruptions or imminent risk in supply of crisis-relevant products. Evidence of potential divergent national measures.",
      effect: "Move EDIP Crisis State marker to Supply Crisis. Unlocks standard crisis tools: information requests, voluntary and mandatory prioritisation, coordinated procurement. All teams PC -1. EDIP Legitimacy +1 if activation is timely and widely supported; -1 if perceived premature or divisive."
    },
    {
      id: "CS-02", name: "Activate Security-Related Supply Crisis", cat: "Crisis State",
      timing: "This Round",
      req: "Crisis Severity ≥ 3. Defence product shortages clearly linked to security threats (e.g. high-intensity conflict on EU territory). Risk of divergent national measures.",
      effect: "Move EDIP Crisis State to Security-Related Supply Crisis. Unlocks extended tools: intra-EU transfer fast-track, permit/continuity measures, mutual recognition, working-time flexibility. Crisis Severity cannot fall below 2 while this state is active. All teams PC -1. EDIP Legitimacy +1 if clearly overdue; -1 if perceived as overreach."
    },
    {
      id: "MP-01", name: "Targeted Information Requests (EOs)", cat: "Monitoring",
      timing: "This Round",
      req: "Supply crisis active or imminent (Crisis Severity ≥ 2). Commission must consult Member States of relevant economic operators before sending requests.",
      effect: "Reveal selected hidden stock/capacity information for 1–2 targeted teams to the requester and/or all teams. Clarifies CRM dependencies, bottlenecks, spare production capacity. Each targeted team PO -1 and Sovereignty Sensitivity +1 (domestic backlash about intrusive EU data demands). Draw EO Response Card."
    },
    {
      id: "MP-02", name: "General Information Mapping Initiative", cat: "Monitoring",
      timing: "This Round",
      req: "Crisis Severity ≥ 2, any crisis state. Broad political recognition that a systemic view of EDTIB vulnerabilities is needed.",
      effect: "EDIP Engine presents a high-level dependency map: who depends on which suppliers, where key bottlenecks lie. All teams receive 1 Insight token to ask one precise factual question later. EDIP Legitimacy +1 (seen as responsible governance). In the next round, no more than 2 EDIP measures on the agenda."
    },
    {
      id: "SP-01", name: "Voluntary Prioritisation Request", cat: "Prioritisation (Soft)",
      timing: "This Round",
      req: "Supply crisis active. Commission must consult the Member State of the economic operator before sending the voluntary request.",
      effect: "Providing team voluntarily shifts 1 IC token to produce for the beneficiary this round or next. Beneficiary gains additional Defence Stock or Resilience effect. Provider loses PC -1 OR PO -1 (their choice, reflects domestic trade-off). If provider refuses or offers partial cooperation, it sets narrative justification for SP-02."
    },
    {
      id: "SP-02", name: "Mandatory Prioritisation Order", cat: "Prioritisation (Hard)",
      timing: "This Round",
      req: "Supply OR Security-related crisis active. Voluntary measures have failed or proven insufficient. Commission must consult BOTH the Member State of the production site AND the headquarters of the economic operator.",
      effect: "Provider must shift 2 IC tokens to priority production for the beneficiary this round or next. Provider PC -2 and PO -1. EDIP Legitimacy -1 if passed over strong objections; +1 from beneficiary perspective if it prevents readiness collapse. Provider may invoke internal security interests ONCE per scenario to halve effect (1 IC instead of 2). Draw EO Response Card."
    },
    {
      id: "CP-01", name: "Coordinated Procurement / Add-On Orders", cat: "Demand Coordination",
      timing: "Next Round",
      req: "Supply OR Security-related crisis active. Two or more MS teams seek similar products (e.g. ammo, UAVs, sensors).",
      effect: "Teams pool demand under EDIP-coordinated procurement. Industrial team benefits from more predictable long-term contracts; production planned at scale. Possible +1 efficiency bonus (e.g. 3 IC → 4 units Defence Stock). Participating teams accept EU-level influence over delivery sequencing and priority. Non-participating states may perceive bias if excluded."
    },
    {
      id: "PA-01", name: "Permit Fast-Track & Continuity of Production", cat: "Production Acceleration",
      timing: "Ongoing from Next Round",
      req: "Security-related crisis OR supply crisis with high severity and clear production constraints. A Member State requests accelerated permits and continuity measures for critical facilities.",
      effect: "Selected industrial or support team gains +1 IC token per round from next round onward (dedicated to crisis-relevant products). PO -1 and Sovereignty Sensitivity +1 (domestic backlash over overriding ecological or planning constraints). Repeated use on same team may trigger a 'legal challenge' narrative event in later rounds."
    },
    {
      id: "PA-02", name: "Mutual Recognition & Fast-Track Certification", cat: "Production Acceleration",
      timing: "This Round",
      req: "Security-related supply crisis active. Member States agree to mutually recognise certificates and allow fast-track certification for specific defence products.",
      effect: "For one selected product line, time-to-field is reduced by one round (product becomes available one round earlier). EDIP Legitimacy +1 if perceived as pragmatic and well-targeted. Overuse risk: facilitator may introduce a minor 'quality concern' narrative event."
    },
    {
      id: "PA-03", name: "Working-Time Flexibility & Innovation Support", cat: "Production Acceleration",
      timing: "This Round (Optional)",
      req: "Security-related supply crisis active.",
      effect: "Target team gains +1 temporary IC this round only. PO -1 (domestic workforce concerns about overtime and safety). This is an optional card — facilitator discretion on whether to include given pace and scenario focus."
    },
    {
      id: "TR-01", name: "Intra-EU Transfer Fast-Track & Export Ban Constraint", cat: "Transfers",
      timing: "This Round (Ongoing Effect)",
      req: "Security-related supply crisis active. Internal transfer bottlenecks and/or threats of national export bans for security-related products are emerging.",
      effect: "For the rest of the scenario, intra-EU transfers are processed on a fast-track basis (same-round delivery instead of default next-round). Member States cannot impose effective export bans on security-related products without incurring significant political costs. All teams Sovereignty Sensitivity +1. Any attempt to reimpose export ban: PC -2 and EDIP Legitimacy penalty."
    }
  ],

  objective: "Keep Europe's defence response viable — ensuring the most exposed states do not run out of critical capabilities — by deciding when and how to use EDIP tools and national actions, without breaking domestic politics and industrial interests. Maintain frontline Readiness above collapse. Manage Political Capital, Public Opinion and EDIP Legitimacy so the system stays politically sustainable. There is no winner. Success = quality of insights about EDIP's functioning.",

  redLines: "EDIP Legitimacy at -2 = political crisis for the entire mechanism. PC = 0: team cannot propose new strong EDIP measures. PC = 1 (STRAINED): only 1 national action per round, limited EDIP requests. Readiness = 0: team has failed its core function — a debrief-critical failure state that must be explicitly noted.",

  pcThresholds: "PC 3–6: Normal — full range of actions available. PC 2: Caution — review exposure. PC 1: Strained — only 1 national action per round, limited EDIP requests. PC 0: Crisis — no new strong EDIP proposals possible.",

  votingRule: "For each EDIP proposal: Support ≥ 3 AND Objections ≤ 1 → measure passes and the EDIP card effect is applied. Teams may spend 1 PC to gain 1 extra Support or Objection token for that round. If Political Capital falls too low, teams face penalties (only 1 national action, no strong EDIP proposals).",

  eoMechanic: "When an EDIP measure directly affects Economic Operators (information requests, prioritisation orders), draw an EO Response Card. Responses include: Full Compliance, Partial Compliance, Resistance or Delay. Partial compliance or resistance may trigger enforcement decisions (penalties) and can affect EDIP Legitimacy and team Political Capital.",

  resourceLogic: "Blue cubes = Defence Stock (usable defence products). Red discs = CRM/critical components (needed to fully exploit IC — effective capacity = min(IC tokens, CRM discs)). Grey cylinders = Industrial Capacity (each slot can produce 1 blue cube OR cancel a -1 Readiness drop per round). Tokens move between teams only via SP-01, SP-02, PA-01/PA-03, or Bilateral Deals.",

  facilitation: "Four roles: Lead Facilitator (narrates injects, chairs Council phase), Note-Taker/Observer (captures decisions and EDIP tensions for debrief), EDIP/EDTIB SME (answers legal and technical questions), Logistics Support. Micro-debrief after each round: 2–3 minutes, 1–2 prompts. Final plenary debrief: activation thresholds, information powers, prioritisation, production, transfers, cross-cutting EDIP legitimacy and sovereignty themes."
};
```

---

## 8. State Management

### `src/lib/gameStore.ts`

Use **Zustand**. The store manages all session state. No persistence to localStorage — sessions are ephemeral.

```typescript
import { create } from "zustand";
import type {
  AppPhase, SetupMode, GameConfig, GameState,
  ChatMessage, CrisisState
} from "@/types/game";

interface GameStore {
  // App phase
  phase: AppPhase;
  setupMode: SetupMode;
  setPhase: (phase: AppPhase) => void;
  setSetupMode: (mode: SetupMode) => void;

  // Configuration
  gameConfig: GameConfig | null;
  configJson: string;
  briefText: string;
  setGameConfig: (cfg: GameConfig) => void;
  setConfigJson: (json: string) => void;
  setBriefText: (text: string) => void;

  // Game state
  gameState: GameState | null;
  setGameState: (state: GameState) => void;
  applyStateUpdate: (update: import("@/types/game").StateUpdate) => void;

  // Chat
  messages: ChatMessage[];
  addMessage: (msg: ChatMessage) => void;
  addMessages: (msgs: ChatMessage[]) => void;
  clearMessages: () => void;

  // LLM conversation history
  llmHistory: Array<{ role: "user" | "assistant"; content: string }>;
  appendHistory: (role: "user" | "assistant", content: string) => void;

  // UI state
  loading: boolean;
  setLoading: (loading: boolean) => void;
  activeTab: "cards" | "actions" | "guide";
  setActiveTab: (tab: "cards" | "actions" | "guide") => void;

  // Actions
  initGame: (config: GameConfig, scenarioIndex: number) => void;
  resetGame: () => void;
}
```

Implement `applyStateUpdate` to safely clamp values:

- `crisisSeverity`: clamp to [0, 5]
- `edipLegitimacy`: clamp to [-2, 2]
- `pc`: clamp to [0, 6]
- `po`: clamp to [-2, 2]
- `readiness`: clamp to [0, 5]
- `stock`, `crm`, `ic`: clamp to [0, 99]

Implement `initGame` to:
1. Set `gameState` from `config.scenarios[scenarioIndex].startState` + team starting values
2. Set `phase` to `"game"`
3. Clear `messages` and `llmHistory`
4. Set `round` to 1

---

## 9. Corporate LLM Integration

### `src/app/api/llm/route.ts` — The LLM Proxy

This is the **critical security boundary**. All LLM calls from the browser go through this route. It reads credentials from environment variables server-side.

```typescript
import { NextRequest, NextResponse } from "next/server";
import type { LLMRequest } from "@/types/llm";

export async function POST(req: NextRequest) {
  const body: LLMRequest = await req.json();

  const baseUrl  = process.env.LLM_API_BASE_URL!;
  const apiKey   = process.env.LLM_API_KEY!;
  const model    = process.env.LLM_MODEL!;
  const maxTok   = body.maxTokens ?? Number(process.env.LLM_MAX_TOKENS) ?? 1000;

  // Parse any extra headers (optional corporate-specific headers)
  let extraHeaders: Record<string, string> = {};
  try {
    extraHeaders = JSON.parse(process.env.LLM_EXTRA_HEADERS || "{}");
  } catch { /* ignore */ }

  // Build the OpenAI-compatible messages array
  const messages = [
    { role: "system", content: body.systemPrompt },
    ...body.messages,
  ];

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        ...extraHeaders,
      },
      body: JSON.stringify({ model, max_tokens: maxTok, messages }),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: err }, { status: response.status });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content ?? "";
    return NextResponse.json({ text });

  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
```

> **Note:** If your corporate LLM does not use the OpenAI Chat Completions format, adapt only this file. The rest of the application is format-agnostic.

### `src/app/api/generate-config/route.ts` — Config Generation Proxy

Same pattern, but uses `LLM_CONFIG_GEN_MAX_TOKENS` and a fixed system prompt for JSON config generation. The system prompt is the same one used in the client-side brief generation flow (see Section 10 below).

### `src/lib/llmClient.ts` — Client-Side Caller

```typescript
import type { LLMRequest, LLMStructuredResponse } from "@/types/llm";

export async function callLLM(req: LLMRequest): Promise<LLMStructuredResponse> {
  const res = await fetch("/api/llm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  if (!res.ok) throw new Error(`LLM proxy error: ${res.status}`);

  const { text, error } = await res.json();
  if (error) throw new Error(error);

  // Strip any markdown code fences if the model wraps JSON in them
  const clean = text.replace(/```json\n?|```\n?/g, "").trim();
  return JSON.parse(clean) as LLMStructuredResponse;
}

export async function generateConfig(brief: string): Promise<unknown> {
  const res = await fetch("/api/generate-config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ brief }),
  });

  if (!res.ok) throw new Error("Config generation failed");

  const { text, error } = await res.json();
  if (error) throw new Error(error);

  const clean = text.replace(/```json\n?|```\n?/g, "").trim();
  return JSON.parse(clean);
}
```

---

## 10. Persona System and Routing Logic

### `src/lib/promptBuilder.ts`

This is the brain of the system. The function `buildSystemPrompt(config, gameState)` returns the full system prompt string injected into every LLM call.

The prompt must include:

1. **Game context block** — name, scenario, domain, description
2. **Live game state block** — round, crisis severity, crisis state, legitimacy, team resources (formatted as compact key=value)
3. **Team identities block** — all four teams with persona names, unique action rules
4. **National actions block** — all four national actions with mechanics and costs
5. **EDIP cards block** — all cards with id, category, timing, requirements, and effect
6. **Key mechanics block** — voting rule, PC thresholds, resource logic, EO mechanic
7. **Three persona definitions** — Kent, Finch, Chen with explicit role, voice, and what they must NOT do
8. **Routing rules** — explicit decision tree for which persona speaks in which context
9. **Strict JSON format instruction** — the exact JSON schema the LLM must return
10. **Absolute rules** — 2-4 sentences per message, never break character, JSON only

#### The JSON response schema the LLM must return:

```json
{
  "responses": [
    {
      "speaker": "kent" | "finch" | "chen",
      "message": "2–4 sentences in persona voice. No bullets or headers.",
      "stateUpdate": null,
      "flag": null
    }
  ]
}
```

Where `stateUpdate` (when not null) is:

```json
{
  "crisisSeverity": 3,
  "crisisState": "Supply Crisis",
  "edipLegitimacy": -1,
  "teamUpdates": [
    { "id": "A", "pc": 2, "readiness": 2 }
  ]
}
```

**Only include fields that actually change in `stateUpdate`.** Do not include unchanged fields. Return `null` for `stateUpdate` if nothing changes.

#### Routing rules to encode in the prompt:

| Trigger | Kent | Finch | Chen |
|---|---|---|---|
| Round start | ✅ Frame round + key tension | ✅ Deliver inject | — |
| EDIP card announced | ✅ Invite vote when ready | ✅ Model consequences | ✅ Validate preconditions first |
| National action declared | — | ✅ Track consequences if any | ✅ Note interactions |
| Unique team action invoked | — | ✅ Model effects | ✅ Validate eligibility |
| EO response scenario | — | ✅ Model each outcome path | ✅ Present choice + mechanism implications |
| Deliberation friction / dispute | ✅ Facilitate | — | — |
| Track threshold warning | — | ✅ Flag with urgency and numbers | — |
| Debrief | ✅ Open + close + recommendations | ✅ Data and analytics narrative | ✅ Mechanism audit and gaps |

### `src/lib/stateUpdater.ts`

Helper function that takes a `StateUpdate` and the current `GameState` and returns an updated `GameState` with all clamping applied.

---

## 11. Component Specifications

### `GameHeader`

Sticky top bar, height 50px. Shows:
- App wordmark (small, muted)
- Separator
- Game name (muted)
- Scenario name (very muted)
- Right side: round counter (monospace), crisis state badge, new game button

Crisis state badge colours:
- No Crisis → green tint
- Supply Crisis → amber tint
- Security-Related Supply Crisis → red tint

### `StatePanel` (left, width 210px)

Scrollable. Sections:

**GAME STATE header** (small caps, monospace)

**Track bars** — two tracks:
- SEVERITY: 0–5 bar, red, shows `N/5`
- LEGITIMACY: -2 to +2 bar (display as 0–4 range internally for bar calc), blue, shows `+N` or `-N`

**CLUSTERS section**

For each team, a card showing team name (short version after colon) and a 3×2 grid of resource tokens:

| PC | PO | RDY |
|---|---|---|
| STK | CRM | IC |

Each value in its own mini tile with label above and coloured number below. Colours:
- PC → blue (#5B9BD5)
- PO → purple (#A29BFE)
- RDY → green (#2BC48A)
- STK → light blue (#74B9FF)
- CRM → red/coral (#FF7675)
- IC → amber (#FDCB6E)

**PC WARNING** — if any team PC ≤ 1, show a small amber warning badge under their card: "STRAINED" (PC=1) or "CRISIS" (PC=0).

**PERSONAS section** — three coloured dots with persona names.

### `ChatFeed` (center, flex 1)

Scrollable vertically. Renders `ChatMessage[]` in order. Auto-scrolls to bottom on new messages.

Message types:

**`round_divider`** — full-width horizontal rule with round label in a badge, centred.

**`debrief_divider`** — same but with amber colour.

**`facilitator`** — right-aligned, dark bubble, small "FACILITATOR · HH:MM" label above in muted monospace.

**`persona`** — left-aligned. Contains:
- Avatar square (36×36px, rounded corners): initials (KV / AF / MC), coloured border and tinted background
- Header row: persona name (coloured), title (muted), timestamp (far right, very muted)
- Message bubble: tinted background, coloured border, text in readable size
- Optional flag row (if `flag` not null): amber-tinted banner "⚑ {flag}"

**`error`** — red-tinted bubble.

**Loading indicator** — three animated dots when `loading === true`.

### `FacilitatorInput` (bottom bar)

Two rows:
1. Text input + Send button
2. Action buttons: `▶ Advance to Round N` / `▶ End Game + Debrief` | `⬦ Request Debrief Now`

Text input: full width, placeholder: `"Describe what's happening — announce a card play, flag a dispute, invoke a team action…"`

Send on Enter (not Shift+Enter).

Disable Send and action buttons when `loading`.

### `ReferencePanel` (right, width 252px)

Three tabs: CARDS | ACTIONS | GUIDE

**CARDS tab:**
- List view: card id (coloured by category), card name, timing (right-aligned, very muted)
- Click → detail view: card id, category badge, name, timing, requirements, effect
- Back button

**ACTIONS tab:**
- Section: NATIONAL ACTIONS (all teams) — four cards with name, summary, cost
- Section: UNIQUE TEAM POWERS — four entries with team letter, unique action rules text

**GUIDE tab:**
- Sections: Objective, Red Lines & PC Thresholds, Voting Rule, Resource Tokens, EO Response Mechanic, Facilitator Input Guide

---

## 12. UI Design System

### Colour Tokens (add to `tailwind.config.ts`)

```typescript
colors: {
  bg: {
    base:    "#060810",    // App background
    panel:   "#07090E",    // Side panels
    surface: "#0A0D14",    // Cards, input areas
    elevated:"#0D1017",    // Elevated surfaces
  },
  border: {
    subtle:  "#0F1520",
    default: "#141920",
    muted:   "#1A2030",
    dim:     "#1E2838",
  },
  text: {
    primary:   "#BCC8D8",
    secondary: "#6A7A90",
    muted:     "#3A4A5A",
    dim:       "#1E2838",
  },
  persona: {
    kent:  "#5B9BD5",   // Blue
    finch: "#DFA02A",   // Amber
    chen:  "#2BC48A",   // Green
  },
  track: {
    severity:   "#FF6B6B",
    legitimacy: "#5B9BD5",
    crisis:     "#FF6B6B",
    supply:     "#FDCB6E",
    security:   "#FF6B6B",
  },
  resource: {
    pc:       "#5B9BD5",
    po:       "#A29BFE",
    readiness:"#2BC48A",
    stock:    "#74B9FF",
    crm:      "#FF7675",
    ic:       "#FDCB6E",
  },
}
```

### Typography

Load via `next/font/google`:
- **Display / Headers**: `Syne` weights 600, 700, 800 — used for setup screen H1, scenario names
- **Body / UI**: `DM Sans` weights 400, 500, 600 — all interface text
- **Monospace / Data**: `IBM Plex Mono` weights 400, 500 — track labels, resource values, timestamps, section headers, code

### Animations

```css
/* Loading dots */
@keyframes blink {
  0%, 100% { opacity: 0.25; transform: scale(0.8); }
  50%       { opacity: 1;    transform: scale(1);   }
}

/* Track bar transitions */
.track-bar-fill {
  transition: width 0.5s ease;
}
```

### Scrollbars

```css
::-webkit-scrollbar { width: 3px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #1A2030; border-radius: 2px; }
```

### Category Colour Map

```typescript
export const CARD_CAT_COLORS: Record<string, string> = {
  "Crisis State":            "#FF6B6B",
  "Monitoring":              "#74B9FF",
  "Prioritisation (Soft)":   "#FDCB6E",
  "Prioritisation (Hard)":   "#E17055",
  "Demand Coordination":     "#55EFC4",
  "Production Acceleration": "#81ECEC",
  "Transfers":               "#A29BFE",
};
```

---

## 13. Page and Routing Architecture

### Routes

| Route | Component | Purpose |
|---|---|---|
| `/` | Redirect → `/setup` | Entry |
| `/setup` | `SetupScreen` | Load config or generate from brief |
| `/game` | `GameScreen` | Main game interface |

Game state is held in Zustand (in-memory). Navigating to `/setup` from `/game` (via New Game button) triggers `resetGame()` in the store.

### Setup Screen Flow

```
SetupScreen
  ├─ Home (setupMode = "home")
  │     ├─ Button: "Load Config / EDIP Default" → setupMode = "load"
  │     └─ Button: "Generate from Brief"        → setupMode = "brief"
  │
  ├─ Load (setupMode = "load")
  │     ├─ Textarea: editable JSON (pre-loaded with EDIP_CONFIG)
  │     └─ If valid JSON: show parsed summary + "Launch Scenario N" buttons
  │
  ├─ Brief (setupMode = "brief")
  │     ├─ Textarea: free-text description
  │     ├─ Button: "Generate Configuration" → calls /api/generate-config
  │     └─ On success: sets configJson → setupMode = "review"
  │
  └─ Review (setupMode = "review")
        ├─ Same as Load panel but pre-populated with generated config
        └─ User can edit JSON before launching
```

### Config Generation Prompt

When the user submits a text brief, call `/api/generate-config` with this system prompt:

```
Generate a complete war game configuration JSON from the user's brief description.
Return ONLY valid JSON with no markdown fences, no explanation, no preamble.

The JSON must match this TypeScript interface exactly:
{
  name: string,
  domain: string,
  description: string,
  scenarios: Array<{
    id: string,
    name: string,
    description: string,
    rounds: number (3–5),
    startState: { crisisSeverity: 0–2, crisisState: "No Crisis", edipLegitimacy: 0 },
    injects: string[] (one per round, include round label and KEY TENSION framing)
  }>,
  teams: Array<{
    id: "A"|"B"|"C"|"D",
    name: string,
    description: string,
    personas: string[],
    uniqueAction: string,
    pc: 3–4, po: 0–1, readiness: 3, stock: 2–3, crm: 2–3, ic: 2–5
  }>,
  nationalActions: Array<{ id: string, name: string, summary: string, cost: string }>,
  cards: Array<{ id: string, name: string, cat: string, timing: string, req: string, effect: string }>,
  objective: string,
  redLines: string,
  pcThresholds: string,
  votingRule: string,
  eoMechanic: string,
  resourceLogic: string,
  facilitation: string
}

Generate at minimum 8 cards, 4 national actions, 4 teams, and 1–2 scenarios.
Make injects specific and narratively compelling.
```

### Debrief Export

`src/lib/debriefExporter.ts` collects all `isDebrief: true` messages from the chat and formats them as a plain markdown string, then triggers a browser download as `wargame-debrief-{date}.md`.

---

## 14. Implementation Phases

Implement in this order. Each phase should be independently functional before proceeding.

### Phase 1 — Foundation (no LLM calls yet)
- [ ] Project scaffold: Next.js + TypeScript + Tailwind + Zustand + Lucide
- [ ] Environment config files (`.env.example`)
- [ ] All TypeScript interfaces in `src/types/`
- [ ] EDIP game config constant in `src/data/edipConfig.ts`
- [ ] Zustand store in `src/lib/gameStore.ts` with all state and actions
- [ ] Font setup in `app/layout.tsx`
- [ ] Tailwind design tokens

### Phase 2 — Setup Screen
- [ ] `/setup` page with all three modes (home, load, brief, review)
- [ ] JSON textarea with parse validation
- [ ] "Launch Scenario" buttons that call `initGame()` and navigate to `/game`
- [ ] Persona preview cards on home screen
- [ ] Generate-from-brief UI (stub the API call with a mock response)

### Phase 3 — Game Screen Layout (static, no LLM)
- [ ] `/game` page with three-column layout
- [ ] `GameHeader` — round counter, crisis state badge, new game button
- [ ] `StatePanel` — track bars, team resource grids, persona legend
- [ ] `ChatFeed` — renders messages from store, auto-scrolls, all message types
- [ ] `PersonaMessage` — distinct visual identity for all three personas
- [ ] `ReferencePanel` — all three tabs with real data from game config
- [ ] `FacilitatorInput` — input + buttons (no API calls yet)

### Phase 4 — LLM Integration
- [ ] `/api/llm/route.ts` proxy — OpenAI-compatible
- [ ] `/api/generate-config/route.ts` proxy
- [ ] `src/lib/llmClient.ts`
- [ ] `src/lib/promptBuilder.ts` — full system prompt
- [ ] `src/lib/stateUpdater.ts`
- [ ] Wire up round start on game navigation (auto-call LLM when game starts)
- [ ] Wire up facilitator input send
- [ ] Wire up "Advance Round" button
- [ ] Wire up "Request Debrief" button
- [ ] Apply `stateUpdate` responses to store

### Phase 5 — Config Generation and Polish
- [ ] Wire up generate-from-brief to real `/api/generate-config`
- [ ] Debrief export download (`src/lib/debriefExporter.ts`)
- [ ] PC warning badges on team resource cards
- [ ] Error states (LLM errors displayed gracefully in chat)
- [ ] Loading states on all async operations
- [ ] Keyboard shortcut: Enter to send, Escape to clear input

### Phase 6 — QA
- [ ] Test with EDIP Scenario 1 (full 4-round run)
- [ ] Test with EDIP Scenario 2 (full 5-round run)
- [ ] Test generate-from-brief with 2–3 different domain briefs
- [ ] Verify all track values clamp correctly
- [ ] Verify LLM credentials never appear in browser network tab
- [ ] Test error recovery when LLM returns malformed JSON

---

## 15. Testing Requirements

### Unit Tests (Vitest)

| File | What to test |
|---|---|
| `stateUpdater.ts` | All clamping logic; all field updates; null stateUpdate is no-op |
| `promptBuilder.ts` | Prompt contains game state values; prompt contains all card IDs; format instruction present |
| `gameStore.ts` | `initGame` correctly sets all fields; `applyStateUpdate` applies deltas correctly |

### Integration Tests

- LLM proxy route: mock fetch, verify credentials are not forwarded, verify OpenAI format
- Config generation: mock fetch, verify JSON parse and error handling

### Manual Smoke Tests (required before delivery)

1. Load default EDIP config → launch Scenario 1 → receive round 1 inject from Kent and Finch
2. Type "Team A is invoking Escalate Security Narrative" → receive Chen validation + Finch track update
3. Type "Team B wants to play SP-02 against Team A" → receive Chen precondition check
4. Advance all 4 rounds → click End Game → receive full three-persona debrief
5. Export debrief → verify markdown file downloads correctly
6. Generate config from brief "a NATO logistics exercise…" → review JSON → launch game
7. Confirm zero LLM credentials in browser DevTools > Network

---

## 16. Deployment Notes

### Corporate Deployment Checklist

- All LLM credentials **only** in server environment variables (`.env.local` or equivalent secrets manager)
- Never commit `.env.local`
- The `/api/llm` and `/api/generate-config` routes are the **only** points of egress to the LLM
- Consider adding a corporate SSO middleware to `next.config.ts` if authentication is required
- Build command: `pnpm build` → `pnpm start`
- Consider adding `NEXT_PUBLIC_APP_TITLE` to customise the app title for other game domains

### Docker (optional)

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN npm install -g pnpm && pnpm install && pnpm build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

Enable standalone output in `next.config.ts`:

```typescript
const nextConfig = {
  output: "standalone",
};
```

---

## Appendix A: Persona Voice Reference

Quick reference for Claude Code to verify the system prompt captures each persona correctly.

**Kent Valentina:**
> "Before we put this to a vote, has Team D had a chance to state their proportionality concern? We should hear that before the tokens go down."

**Dr. Alistair Finch:**
> "EDIP Legitimacy is now at -1. Team B's Shield play combined with receiving SP-01 benefits this round — if that asymmetry goes unaddressed in debrief, we're looking at a credibility problem that will follow us into Scenario 2."

**Dr. Michael Chen:**
> "SP-02 has two consultation requirements: the Member State of the production site, and the headquarters of the economic operator. Neither has been documented this round. That's not a formality — under EDIP, it's a proportionality exposure that makes the order challengeable."

---

## Appendix B: System Prompt Structure Summary

The `buildSystemPrompt` function should produce a prompt with these clearly labelled sections, in this order:

```
━━━ GAME ━━━
[name, scenario, domain, description]

━━━ LIVE STATE ━━━  
[round, severity, crisis state, legitimacy, team resources as key=value]

━━━ TEAM IDENTITIES & UNIQUE POWERS ━━━
[all four teams with personas and unique action text]

━━━ NATIONAL ACTIONS ━━━
[all four, with mechanics and costs]

━━━ EDIP CARDS IN PLAY ━━━
[all cards: id, category, name, requires, effect]

━━━ KEY MECHANICS ━━━
[voting, PC thresholds, resources, EO responses, objectives, red lines]

━━━ THE THREE PERSONAS ━━━
[kent, finch, chen: role, voice, explicit constraints]

━━━ ROUTING RULES ━━━
[decision tree for which persona speaks when]

━━━ STRICT JSON FORMAT ━━━
[exact schema with examples, ABSOLUTE RULES]
```

Total estimated prompt length: ~3,000–4,000 tokens. This is acceptable and necessary given the richness of game state required.

---

*End of specification. Implement phases 1–6 in order. Do not skip phases. Each phase must render correctly before proceeding to the next.*
