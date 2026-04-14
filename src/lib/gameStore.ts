import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type {
  SetupMode,
  GameConfig,
  GameState,
  StateUpdate,
  ChatMessage,
} from '@/types/game'
import { EDIP_CONFIG } from '@/data/edipConfig'

// ─── Store Interface ─────────────────────────────────────────────────────────

export interface GameStore {
  // Setup navigation (intra-/setup distinction; URL owns /setup vs /game)
  setupMode: SetupMode
  setSetupMode: (mode: SetupMode) => void

  // Configuration
  gameConfig: GameConfig | null
  configJson: string
  briefText: string
  setGameConfig: (cfg: GameConfig) => void
  setConfigJson: (json: string) => void
  setBriefText: (text: string) => void

  // Game state
  gameState: GameState | null
  setGameState: (state: GameState) => void
  applyStateUpdate: (update: StateUpdate) => void

  // Chat
  messages: ChatMessage[]
  addMessage: (msg: ChatMessage) => void
  addMessages: (msgs: ChatMessage[]) => void
  clearMessages: () => void

  // LLM conversation history
  llmHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  appendHistory: (role: 'user' | 'assistant', content: string) => void

  // UI state
  loading: boolean
  setLoading: (loading: boolean) => void
  activeTab: 'cards' | 'actions' | 'guide'
  setActiveTab: (tab: 'cards' | 'actions' | 'guide') => void

  // Actions
  initGame: (config: GameConfig, scenarioIndex: number) => void
  resetGame: () => void

  // Game flow stubs (Phase 6 will replace with LLM wiring)
  advanceRound: () => void
  triggerDebrief: () => void
  sendFacilitatorMessage: (text: string) => void
}

// ─── Initial State ────────────────────────────────────────────────────────────

const initialConfigJson = JSON.stringify(EDIP_CONFIG, null, 2)

// ─── Store ────────────────────────────────────────────────────────────────────

export const useGameStore = create<GameStore>()(
  devtools(
    immer((set, get) => ({
      // Setup navigation (intra-/setup distinction; URL owns /setup vs /game)
      setupMode: 'home',
      setSetupMode: (mode) =>
        set((state) => {
          state.setupMode = mode
        }),

      // Configuration
      gameConfig: null,
      configJson: initialConfigJson,
      briefText: '',
      setGameConfig: (cfg) =>
        set((state) => {
          state.gameConfig = cfg
        }),
      setConfigJson: (json) =>
        set((state) => {
          state.configJson = json
        }),
      setBriefText: (text) =>
        set((state) => {
          state.briefText = text
        }),

      // Game state
      gameState: null,
      setGameState: (gs) =>
        set((state) => {
          state.gameState = gs
        }),

      applyStateUpdate: (update) =>
        set((state) => {
          if (!state.gameState) return

          const clamp = (v: number, min: number, max: number) =>
            Math.max(min, Math.min(max, v))

          if (update.crisisSeverity != null) {
            state.gameState.crisisSeverity = clamp(update.crisisSeverity, 0, 5)
          }
          if (update.crisisState != null) {
            state.gameState.crisisState = update.crisisState
          }
          if (update.edipLegitimacy != null) {
            state.gameState.edipLegitimacy = clamp(update.edipLegitimacy, -2, 2)
          }
          if (update.teamUpdates) {
            for (const tu of update.teamUpdates) {
              const team = state.gameState.teams.find((t) => t.id === tu.id)
              if (!team) continue

              if (tu.pc != null) team.pc = clamp(tu.pc, 0, 6)
              if (tu.po != null) team.po = clamp(tu.po, -2, 2)
              if (tu.readiness != null) team.readiness = clamp(tu.readiness, 0, 5)
              if (tu.stock != null) team.stock = clamp(tu.stock, 0, 99)
              if (tu.crm != null) team.crm = clamp(tu.crm, 0, 99)
              if (tu.ic != null) team.ic = clamp(tu.ic, 0, 99)
            }
          }
        }),

      // Chat
      messages: [],
      addMessage: (msg) =>
        set((state) => {
          state.messages.push(msg)
        }),
      addMessages: (msgs) =>
        set((state) => {
          state.messages.push(...msgs)
        }),
      clearMessages: () =>
        set((state) => {
          state.messages = []
        }),

      // LLM conversation history
      llmHistory: [],
      appendHistory: (role, content) =>
        set((state) => {
          state.llmHistory.push({ role, content })
        }),

      // UI state
      loading: false,
      setLoading: (loading) =>
        set((state) => {
          state.loading = loading
        }),
      activeTab: 'cards',
      setActiveTab: (tab) =>
        set((state) => {
          state.activeTab = tab
        }),

      // ─── Game Actions ────────────────────────────────────────────────────────

      initGame: (config, scenarioIndex) =>
        set((state) => {
          const scenario = config.scenarios[scenarioIndex]
          state.gameConfig = config
          state.gameState = {
            round: 1,
            scenarioIndex,
            crisisSeverity: scenario.startState.crisisSeverity,
            crisisState: scenario.startState.crisisState,
            edipLegitimacy: scenario.startState.edipLegitimacy,
            teams: config.teams.map((t) => ({
              id: t.id,
              name: t.name,
              pc: t.pc,
              po: t.po,
              readiness: t.readiness,
              stock: t.stock,
              crm: t.crm,
              ic: t.ic,
            })),
            cardsThisRound: [],
          }
          state.messages = []
          state.llmHistory = []
        }),

      resetGame: () =>
        set((state) => {
          state.setupMode = 'home'
          state.gameConfig = null
          state.configJson = JSON.stringify(EDIP_CONFIG, null, 2)
          state.briefText = ''
          state.gameState = null
          state.messages = []
          state.llmHistory = []
          state.loading = false
          state.activeTab = 'cards'
        }),

      // ─── Game Flow Stubs ─────────────────────────────────────────────────────
      // Phase 6 will replace these with real LLM wiring.

      advanceRound: () => {
        let newRound: number | null = null
        set((state) => {
          if (!state.gameState) return
          state.gameState.round += 1
          newRound = state.gameState.round
        })
        if (newRound === null) return
        const divider = {
          id: crypto.randomUUID(),
          type: 'round_divider' as const,
          label: `Round ${newRound}`,
          timestamp: new Date().toISOString(),
        }
        const stubKent = {
          id: crypto.randomUUID(),
          type: 'persona' as const,
          speaker: 'kent' as const,
          text: '[Round framing — placeholder until LLM wiring in Phase 6.]',
          timestamp: new Date().toISOString(),
        }
        get().addMessages([divider, stubKent])
      },

      triggerDebrief: () => {
        const divider = {
          id: crypto.randomUUID(),
          type: 'debrief_divider' as const,
          label: 'DEBRIEF',
          timestamp: new Date().toISOString(),
          isDebrief: true,
        }
        const stubFacilitator = {
          id: crypto.randomUUID(),
          type: 'facilitator' as const,
          speaker: 'facilitator' as const,
          text: '[Debrief placeholder — facilitator notes will appear here in Phase 7.]',
          timestamp: new Date().toISOString(),
        }
        get().addMessages([divider, stubFacilitator])
      },

      sendFacilitatorMessage: (text: string) => {
        const trimmed = text.trim()
        if (trimmed === '') return
        get().addMessage({
          id: crypto.randomUUID(),
          type: 'facilitator',
          speaker: 'facilitator',
          text: trimmed,
          timestamp: new Date().toISOString(),
        })
        get().setLoading(true)
      },
    })),
    { name: 'GameStore', enabled: import.meta.env.DEV },
  ),
)
