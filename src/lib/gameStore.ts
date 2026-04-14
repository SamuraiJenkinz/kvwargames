import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { current } from 'immer'
import type {
  SetupMode,
  GameConfig,
  GameState,
  StateUpdate,
  ChatMessage,
  PersonaId,
} from '@/types/game'
import type { HistoryEntry, PersonaResponse } from '@/types/llm'
import { EDIP_CONFIG } from '@/data/edipConfig'
import { buildSystemPrompt } from '@/lib/promptBuilder'
import { windowHistory, HISTORY_WINDOW_N } from '@/lib/contextWindow'
import { reportPromptBudget } from '@/lib/promptBudget'
import { callLLMProxy, LLM_FRONTEND_TIMEOUT_MS } from '@/lib/llmClient'
import { parsePersonaResponse } from '@/lib/responseParser'
import { applyStateUpdatePure, type ClampLog } from '@/lib/stateUpdater'

// ─── Store Interface ─────────────────────────────────────────────────────────

export interface PendingControlBanner {
  kind: 'advanceRound' | 'triggerDebrief'
  targetRound?: number
}

export interface GameStore {
  // Setup navigation (intra-/setup distinction; URL owns /setup vs /game)
  setupMode: SetupMode
  setSetupMode: (mode: SetupMode) => void

  // Configuration
  gameConfig: GameConfig | null
  configJson: string
  briefText: string
  /** Source of the current draft config. 'brief' = generated via GenerateBriefPanel, 'load' = user-entered/EDIP default, null = no draft yet. */
  draftSource: 'brief' | 'load' | null
  setGameConfig: (cfg: GameConfig) => void
  setConfigJson: (json: string) => void
  setBriefText: (text: string) => void
  setDraftSource: (source: 'brief' | 'load' | null) => void

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
  llmHistory: HistoryEntry[]
  appendHistory: (role: 'user' | 'assistant', content: string) => void

  // UI state
  loading: boolean
  setLoading: (loading: boolean) => void
  activeTab: 'cards' | 'actions' | 'guide'
  setActiveTab: (tab: 'cards' | 'actions' | 'guide') => void

  // ─── Phase 7 debrief export ──────────────────────────────────────────────
  /**
   * Round-boundary state snapshots for debrief export.
   * Key semantics: `stateSnapshots[N]` = state at the START of Round N.
   *   - Seeded at initGame for key 1.
   *   - Captured inside advanceRound under the key of the round being ENTERED
   *     (newRound), AFTER round-advance mutations are applied.
   * Contract: the exporter reads `stateSnapshots[n]` directly to render
   * "### State at start of Round N" — no off-by-one adjustment anywhere.
   */
  stateSnapshots: Record<number, GameState>
  setStateSnapshot: (round: number, state: GameState) => void

  /** Session-level flag set only by `End Game + Debrief` action. When true, the send button and round-advance are disabled. Reset to false on newGame/resetGame. NOT part of GameState (simulation state) — it is session UI state. */
  gameEnded: boolean
  setGameEnded: (ended: boolean) => void

  // ─── Phase 6 LLM wiring ──────────────────────────────────────────────────
  /** AbortController for the in-flight LLM call; null when idle. */
  currentAbortController: AbortController | null
  /** Canonical input string to replay on Retry (may include prefix for round/debrief triggers). */
  lastFacilitatorInput: string | null
  /** Non-blocking confirmation banner state, set by LLM `control` signals. */
  pendingControlBanner: PendingControlBanner | null

  // Actions
  initGame: (config: GameConfig, scenarioIndex: number) => void
  resetGame: () => void
  newGame: () => void

  // Game flow
  advanceRound: () => void
  triggerDebrief: () => void
  /** Final-debrief variant: sets gameEnded=true THEN fires the debrief LLM turn inline. Send button and round-advance disable after this. Does NOT delegate to triggerDebrief (which would bail on the gameEnded guard — see implementation comment). */
  endGame: () => void
  sendFacilitatorMessage: (text: string) => void
  retryLastMessage: () => void
  confirmControlBanner: () => void
  dismissControlBanner: () => void
  abortCurrentLLMCall: () => void
}

// ─── Initial State ────────────────────────────────────────────────────────────

const initialConfigJson = JSON.stringify(EDIP_CONFIG, null, 2)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(): string {
  return new Date().toISOString()
}

function buildPersonaMessage(r: PersonaResponse, revealDelay: number): ChatMessage {
  return {
    id: crypto.randomUUID(),
    type: 'persona',
    speaker: r.speaker as PersonaId,
    text: r.message,
    flag: r.flag,
    revealDelay,
    timestamp: formatTime(),
  }
}

interface ErrorMessageInit {
  code: string
  message: string
  retryInput: string
  rawResponse: string | undefined
}

function buildErrorMessage(init: ErrorMessageInit): ChatMessage {
  return {
    id: crypto.randomUUID(),
    type: 'error',
    text: init.message,
    errorCode: init.code,
    retryInput: init.retryInput,
    rawResponse: init.rawResponse,
    timestamp: formatTime(),
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useGameStore = create<GameStore>()(
  devtools(
    immer((set, get) => {
      /**
       * Core LLM turn orchestration. Runs as a non-awaited async so store
       * actions remain synchronous at the call site. Handles:
       *   - AbortController lifecycle + frontend timeout
       *   - system prompt + windowed history assembly
       *   - callLLMProxy → parsePersonaResponse → applyStateUpdatePure
       *   - single atomic set() on success (persona msgs, gameState, llmHistory, control banner, loading=false)
       *   - atomicity on failure: no gameState / llmHistory mutation; single red error bubble + retry affordance
       */
      async function runLLMTurn(input: string): Promise<void> {
        const { gameConfig, gameState, llmHistory } = get()
        if (!gameConfig || !gameState) {
          set((s) => {
            s.loading = false
          })
          return
        }

        const controller = new AbortController()
        set((s) => {
          s.currentAbortController = controller
        })

        // Client-side safety timeout on top of backend timeout.
        const timeoutId = setTimeout(() => controller.abort(), LLM_FRONTEND_TIMEOUT_MS)

        const systemPrompt = buildSystemPrompt(gameConfig, gameState)
        const windowedHistory = windowHistory(llmHistory)

        const llmResult = await callLLMProxy(
          systemPrompt,
          [...windowedHistory, { role: 'user', content: input }],
          { signal: controller.signal },
        )

        clearTimeout(timeoutId)

        // ABORTED: newGame or a later cancel path already reset store. Do nothing.
        if (!llmResult.ok && llmResult.errorCode === 'ABORTED') {
          // Another path (newGame) has already cleared controller/loading. Bail.
          return
        }

        if (!llmResult.ok) {
          set((state) => {
            state.messages.push(
              buildErrorMessage({
                code: llmResult.errorCode,
                message: llmResult.message,
                retryInput: input,
                rawResponse: undefined,
              }),
            )
            state.loading = false
            state.currentAbortController = null
          })
          return
        }

        const parseResult = parsePersonaResponse(llmResult.text)
        if (!parseResult.ok) {
          // Atomicity: successful network call but unparseable → NO llmHistory append,
          // NO gameState change. Single red error bubble only.
          set((state) => {
            state.messages.push(
              buildErrorMessage({
                code: parseResult.errorKind,
                message: parseResult.detail,
                retryInput: input,
                rawResponse: parseResult.raw,
              }),
            )
            state.loading = false
            state.currentAbortController = null
          })
          return
        }

        // Success — compute nextState + clampLog outside set() so we can warn in dev.
        const value = parseResult.value
        const { nextState, clampLog } = value.responses.reduce<{
          nextState: GameState
          clampLog: ClampLog[]
        }>(
          (acc, r) => {
            if (!r.stateUpdate) return acc
            const result = applyStateUpdatePure(acc.nextState, r.stateUpdate)
            return {
              nextState: result.nextState,
              clampLog: [...acc.clampLog, ...result.clampLog],
            }
          },
          { nextState: gameState, clampLog: [] },
        )

        if (clampLog.length && import.meta.env.DEV) {
          console.warn('[stateUpdater] clamped fields:', clampLog)
        }

        set((state) => {
          // Persona messages — single addMessages call with CSS revealDelay per
          // CONTEXT.md sticky-scroll pitfall #3 (stagger via CSS animation-delay,
          // not multiple setTimeout inserts).
          const personaMsgs = value.responses.map((r, i) =>
            buildPersonaMessage(r, i * 500),
          )
          state.messages.push(...personaMsgs)

          // State update — wholesale replace with the computed nextState.
          state.gameState = nextState

          // llmHistory append + bound length (CONTEXT.md invariant:
          // llmHistory.length <= 2 * HISTORY_WINDOW_N + 1; currently 5 at N=2
          // (reduced from 6 → 2 in Plan 06-08 after empirical budget measurement).
          state.llmHistory.push({ role: 'user', content: input })
          state.llmHistory.push({ role: 'assistant', content: llmResult.text })
          const maxHistoryEntries = 2 * HISTORY_WINDOW_N + 1
          if (state.llmHistory.length > maxHistoryEntries) {
            state.llmHistory = state.llmHistory.slice(-maxHistoryEntries)
          }

          // Control banner from LLM. Conflict resolution: triggerDebrief wins.
          if (value.control?.triggerDebrief) {
            state.pendingControlBanner = { kind: 'triggerDebrief' }
          } else if (value.control?.advanceRound) {
            state.pendingControlBanner = {
              kind: 'advanceRound',
              targetRound: gameState.round + 1,
            }
          }

          state.loading = false
          state.currentAbortController = null
        })
      }

      return {
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
        draftSource: null,
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
        setDraftSource: (source) =>
          set((s) => {
            s.draftSource = source
          }),

        // Game state
        gameState: null,
        setGameState: (gs) =>
          set((state) => {
            state.gameState = gs
          }),

        applyStateUpdate: (update) => {
          // Compute nextState outside of set() so structuredClone operates on a
          // plain GameState rather than an immer draft (drafts are proxies and
          // DataCloneError out of structuredClone).
          const liveState = get().gameState
          if (!liveState) return
          const { nextState, clampLog } = applyStateUpdatePure(liveState, update)
          set((state) => {
            state.gameState = nextState
          })
          if (clampLog.length && import.meta.env.DEV) {
            console.warn('[stateUpdater] clamped fields:', clampLog)
          }
        },

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

        // ─── Phase 7 debrief export state ───────────────────────────────────
        stateSnapshots: {},
        gameEnded: false,
        setStateSnapshot: (round, state) =>
          set((s) => {
            s.stateSnapshots[round] = state
          }),
        setGameEnded: (ended) =>
          set((s) => {
            s.gameEnded = ended
          }),

        // ─── Phase 6 LLM wiring state ────────────────────────────────────────
        currentAbortController: null,
        lastFacilitatorInput: null,
        pendingControlBanner: null,

        // ─── Game Actions ────────────────────────────────────────────────────

        initGame: (config, scenarioIndex) => {
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
            state.stateSnapshots = {}
            state.gameEnded = false
          })
          // Seed start-of-round-1 snapshot after the set() completes so we read a
          // plain (non-proxy) GameState via get() — immer.current() only accepts
          // drafts, and a freshly assigned plain object inside set() is not yet
          // re-proxied as a draft in Zustand/immer middleware.
          // structuredClone is safe here because get().gameState is a plain object.
          const freshState = get().gameState
          if (freshState) {
            set((s) => {
              s.stateSnapshots[1] = structuredClone(freshState)
            })
          }
          // CTX-03: surface prompt budget in DEV. `console.error` on over-budget
          // so a broken deployment context is impossible to miss in DevTools.
          if (import.meta.env.DEV) {
            const fresh = get().gameState
            if (fresh) {
              const budget = reportPromptBudget(config, fresh)
              if (budget.withinLimit) {
                // eslint-disable-next-line no-console
                console.info('[promptBudget]', budget)
              } else {
                // eslint-disable-next-line no-console
                console.error(
                  '[promptBudget] CTX-03 BUDGET EXCEEDED — reduce HISTORY_WINDOW_N or raise SAFE_CONTEXT_CEILING_TOKENS',
                  budget,
                )
              }
            }
          }
        },

        resetGame: () =>
          set((state) => {
            state.setupMode = 'home'
            state.gameConfig = null
            state.configJson = JSON.stringify(EDIP_CONFIG, null, 2)
            state.briefText = ''
            state.draftSource = null
            state.gameState = null
            state.messages = []
            state.llmHistory = []
            state.loading = false
            state.activeTab = 'cards'
            state.stateSnapshots = {}
            state.gameEnded = false
          }),

        /**
         * FLOW-05: full "New Game" reset, including safe cancellation of any
         * in-flight LLM call. Aborts the current controller (runLLMTurn sees
         * ABORTED and bails), then clears all Phase 6 transient slices + the
         * Phase 5 resetGame surface. A mid-turn click never strands `loading`
         * or leaves an orphaned AbortController.
         */
        newGame: () => {
          get().currentAbortController?.abort()
          set((state) => {
            // Phase 6 transient slices — clear BEFORE the reset-equivalent below.
            state.currentAbortController = null
            state.lastFacilitatorInput = null
            state.pendingControlBanner = null
            state.llmHistory = []
            // Phase 5 reset surface.
            state.setupMode = 'home'
            state.gameConfig = null
            state.configJson = JSON.stringify(EDIP_CONFIG, null, 2)
            state.briefText = ''
            state.draftSource = null
            state.gameState = null
            state.messages = []
            state.loading = false
            state.activeTab = 'cards'
            // Phase 7 debrief slices.
            state.stateSnapshots = {}
            state.gameEnded = false
          })
        },

        // ─── Game Flow (LLM-wired) ───────────────────────────────────────────

        /**
         * FLOW-02: Insert the round divider + increment round synchronously,
         * then fire an LLM turn with a `[ROUND_START Round N] {inject}` prefix.
         * Kent frames + Finch delivers the inject per routing rules.
         */
        advanceRound: () => {
          const state = get()
          if (!state.gameState || state.loading || state.gameEnded) return
          const currentRound = state.gameState.round
          const newRound = currentRound + 1
          const scenario = state.gameConfig?.scenarios[state.gameState.scenarioIndex]
          // Injects are 0-indexed; round N uses injects[N-1]. Guard for overflow.
          const injectIndex = newRound - 1
          const inject =
            scenario && injectIndex >= 0 && injectIndex < scenario.injects.length
              ? scenario.injects[injectIndex]
              : ''
          const prefixedInput = `[ROUND_START Round ${newRound}] ${inject}`.trim()

          set((s) => {
            if (!s.gameState) return
            s.gameState.round = newRound
            s.messages.push({
              id: crypto.randomUUID(),
              type: 'round_divider',
              label: `Round ${newRound}`,
              timestamp: formatTime(),
            })
            s.loading = true
            s.lastFacilitatorInput = prefixedInput
            // Capture the state the NEW round starts with, keyed by the round being
            // ENTERED. current() strips the Proxy wrapper so the snapshot is a plain
            // object — structuredClone would throw DataCloneError on an Immer draft.
            // Reading contract: stateSnapshots[N] = "state at start of Round N"
            // (see initGame for the N=1 seed).
            s.stateSnapshots[newRound] = current(s.gameState)
          })

          void runLLMTurn(prefixedInput)
        },

        /**
         * FLOW-03: Insert debrief divider + fire LLM debrief turn. All three
         * personas respond (Kent → Finch → Chen) per routing rules.
         */
        triggerDebrief: () => {
          if (get().loading || get().gameEnded) return
          const prefixedInput = '[DEBRIEF_TRIGGER] Facilitator-requested debrief.'
          set((s) => {
            s.messages.push({
              id: crypto.randomUUID(),
              type: 'debrief_divider',
              label: 'DEBRIEF',
              timestamp: formatTime(),
              isDebrief: true,
            })
            s.loading = true
            s.lastFacilitatorInput = prefixedInput
          })
          void runLLMTurn(prefixedInput)
        },

        /**
         * FLOW-04b: Final debrief path. Sets gameEnded=true and fires a debrief
         * LLM turn inline. Does NOT delegate to triggerDebrief() because once
         * gameEnded is set, triggerDebrief's guard would reject the call. The
         * divider-push + LLM-fire logic is intentionally duplicated from
         * triggerDebrief — keep in sync if triggerDebrief's body changes.
         */
        endGame: () => {
          // Bail if already loading or already ended (idempotent — second click is a no-op).
          if (get().loading || get().gameEnded) return

          const prefixedInput = '[END_GAME_DEBRIEF] Facilitator ended the game.'

          // Delegating to triggerDebrief() would bail on its gameEnded guard once we
          // flip the flag — inline the divider push + LLM kick-off here. Keep in sync
          // with triggerDebrief()'s divider-push block if that ever changes.
          set((s) => {
            s.gameEnded = true
            s.messages.push({
              id: crypto.randomUUID(),
              type: 'debrief_divider',
              label: 'DEBRIEF',
              timestamp: formatTime(),
              isDebrief: true,
            })
            s.loading = true
            s.lastFacilitatorInput = prefixedInput
          })
          void runLLMTurn(prefixedInput)
        },

        /**
         * FLOW-01: Push the facilitator's bubble synchronously, flip loading,
         * then fire the async LLM turn. The facilitator input IS `lastFacilitatorInput`
         * (no prefix for plain messages) so Retry replays the exact text.
         */
        sendFacilitatorMessage: (text: string) => {
          const trimmed = text.trim()
          if (trimmed === '' || get().loading || get().gameEnded) return
          set((state) => {
            state.messages.push({
              id: crypto.randomUUID(),
              type: 'facilitator',
              speaker: 'facilitator',
              text: trimmed,
              timestamp: formatTime(),
            })
            state.loading = true
            state.lastFacilitatorInput = trimmed
          })
          void runLLMTurn(trimmed)
        },

        /**
         * RESP-02: replays `lastFacilitatorInput` via the same LLM turn path
         * with a fresh AbortController (runLLMTurn always creates a new one).
         * No-op if there is no prior input or a call is already in flight.
         */
        retryLastMessage: () => {
          const input = get().lastFacilitatorInput
          if (!input || get().loading || get().gameEnded) return
          set((s) => {
            s.loading = true
          })
          void runLLMTurn(input)
        },

        /**
         * Banner-confirm path: clears the banner first (no re-trigger from
         * the next LLM response unless the LLM independently signals again),
         * then dispatches to advanceRound or triggerDebrief. No `isConfirmingControl`
         * flag needed — the banner is now null, so nothing re-enters this path.
         */
        confirmControlBanner: () => {
          const banner = get().pendingControlBanner
          if (!banner) return
          set((s) => {
            s.pendingControlBanner = null
          })
          if (banner.kind === 'advanceRound') {
            get().advanceRound()
          } else {
            get().triggerDebrief()
          }
        },

        dismissControlBanner: () =>
          set((s) => {
            s.pendingControlBanner = null
          }),

        abortCurrentLLMCall: () => {
          get().currentAbortController?.abort()
          set((s) => {
            s.currentAbortController = null
            s.loading = false
          })
        },
      }
    }),
    { name: 'GameStore', enabled: import.meta.env.DEV },
  ),
)
