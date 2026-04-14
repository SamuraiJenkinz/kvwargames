// ─── Crisis States ───────────────────────────────────────────────────────────

export type CrisisState =
  | 'No Crisis'
  | 'Supply Crisis'
  | 'Security-Related Supply Crisis'

export type PersonaId = 'kent' | 'finch' | 'chen'

// ─── Game Configuration ──────────────────────────────────────────────────────

export interface TeamConfig {
  id: string // "A" | "B" | "C" | "D"
  name: string // e.g. "Team A: Frontline & High-Threat"
  description: string
  personas: string[] // Character sheet summaries (2 personas per team)
  uniqueAction: string // Full rules text for unique team power
  // Starting resource values
  pc: number // Political Capital (0–6)
  po: number // Public Opinion (-2 to +2)
  readiness: number // Readiness / Resilience (0–5)
  stock: number // Defence Stock (blue cubes)
  crm: number // Critical Raw Materials (red discs)
  ic: number // Industrial Capacity (grey cylinders)
}

export interface ScenarioStartState {
  crisisSeverity: number // 0–5
  crisisState: CrisisState
  edipLegitimacy: number // -2 to +2
}

export interface Scenario {
  id: string
  name: string
  description: string
  rounds: number
  startState: ScenarioStartState
  injects: string[] // One per round
}

export interface NationalAction {
  id: string
  name: string
  summary: string
  cost: string
}

export interface GameCard {
  id: string
  name: string
  cat: string // Category (used for colour coding)
  timing: string
  req: string // Preconditions
  effect: string
}

export interface GameConfig {
  name: string
  domain: string
  description: string
  scenarios: Scenario[]
  teams: TeamConfig[]
  nationalActions: NationalAction[]
  cards: GameCard[]
  objective: string
  redLines: string
  pcThresholds: string
  votingRule: string
  eoMechanic: string
  resourceLogic: string
  facilitation: string
}

// ─── Live Game State ─────────────────────────────────────────────────────────

export interface TeamState {
  id: string
  name: string
  pc: number
  po: number
  readiness: number
  stock: number
  crm: number
  ic: number
}

export interface GameState {
  round: number
  scenarioIndex: number
  crisisSeverity: number
  crisisState: CrisisState
  edipLegitimacy: number
  teams: TeamState[]
  cardsThisRound: string[]
}

// State update payload from LLM
export interface StateUpdate {
  crisisSeverity?: number
  crisisState?: CrisisState
  edipLegitimacy?: number
  teamUpdates?: Partial<TeamState & { id: string }>[]
}

// ─── Messages ────────────────────────────────────────────────────────────────

export type MessageType =
  | 'persona'
  | 'facilitator'
  | 'round_divider'
  | 'debrief_divider'
  | 'error'

export interface ChatMessage {
  id: string
  type: MessageType
  speaker?: PersonaId | 'facilitator'
  text?: string
  flag?: string | null // Facilitator note from LLM

  // ─── Phase 6 additions ─────────────────────────────────────────────────────
  /** Raw LLM response text — populated on error bubbles for the "Show raw response" disclosure. */
  rawResponse?: string
  /** Machine-readable error code (e.g. 'PARSE_FAILURE', 'LLM_TIMEOUT', 'LLM_UPSTREAM_ERROR'). */
  errorCode?: string
  /** Facilitator input to replay when the Retry button is clicked on this error bubble. */
  retryInput?: string
  /** ms delay for staggered reveal animation (set on persona messages). Applied via CSS animation-delay. */
  revealDelay?: number

  label?: string // For dividers
  timestamp: string
  isDebrief?: boolean
}

// ─── App Phase ───────────────────────────────────────────────────────────────

export type AppPhase = 'setup' | 'game' | 'debrief'
export type SetupMode = 'home' | 'load' | 'brief' | 'review'
