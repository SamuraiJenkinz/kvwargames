import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { waitFor } from '@testing-library/react'
import { useGameStore } from './gameStore'
import { EDIP_CONFIG } from '@/data/edipConfig'
import type { GameConfig, ChatMessage } from '@/types/game'
import type { LLMCallResult, ParseResult } from '@/types/llm'
import { HISTORY_WINDOW_N } from '@/lib/contextWindow'

// ─── Module mocks (Phase 6) ────────────────────────────────────────────────────
//
// We mock the four external Phase 6 modules so gameStore tests stay fully
// deterministic without hitting network or real parsing. Each test case sets
// a controlled return value on the mock fn.
//
// IMPORTANT: these mocks must be hoisted-safe — vi.mock runs before module
// evaluation. We use `vi.fn()` factories that can be reassigned per test.

vi.mock('@/lib/promptBuilder', () => ({
  buildSystemPrompt: vi.fn(() => 'SYSTEM PROMPT'),
}))

vi.mock('@/lib/contextWindow', () => ({
  HISTORY_WINDOW_N: 6,
  windowHistory: vi.fn((h) => h),
}))

vi.mock('@/lib/llmClient', () => ({
  LLM_FRONTEND_TIMEOUT_MS: 45000,
  callLLMProxy: vi.fn(),
}))

vi.mock('@/lib/responseParser', () => ({
  parsePersonaResponse: vi.fn(),
}))

// NOTE: applyStateUpdatePure is intentionally NOT mocked — we keep the real
// clamp behaviour so the clamp-log invariant test exercises genuine logic.

import { callLLMProxy } from '@/lib/llmClient'
import { parsePersonaResponse } from '@/lib/responseParser'

// Ensure Vitest uses the __mocks__/zustand.ts mock for automatic store reset between tests
vi.mock('zustand')

// Use the EDIP config as test config (most tests use it directly)
const config = EDIP_CONFIG as GameConfig

// Helper to get a fresh store state reference
const getState = () => useGameStore.getState()

// Convenience: run initGame with S1 (scenario 0)
const initS1 = () => getState().initGame(config, 0)
// Convenience: run initGame with S2 (scenario 1)
const initS2 = () => getState().initGame(config, 1)

// Typed mock refs for easy per-test overrides.
const mockedCallLLMProxy = vi.mocked(callLLMProxy)
const mockedParsePersonaResponse = vi.mocked(parsePersonaResponse)

// Canonical successful LLM response used in happy-path tests.
const OK_RESPONSE_TEXT = '{"responses":[{"speaker":"kent","message":"hi","stateUpdate":null,"flag":null}]}'
const okLLMResult = (): LLMCallResult => ({ ok: true, text: OK_RESPONSE_TEXT })
const okParseResult = (): ParseResult => ({
  ok: true,
  value: {
    responses: [
      { speaker: 'kent', message: 'Kent speaks.', stateUpdate: null, flag: null },
      { speaker: 'finch', message: 'Finch speaks.', stateUpdate: { crisisSeverity: 2 }, flag: null },
    ],
  },
})

beforeEach(() => {
  // Default mocks: happy path that resolves immediately.
  mockedCallLLMProxy.mockReset()
  mockedParsePersonaResponse.mockReset()
  mockedCallLLMProxy.mockResolvedValue(okLLMResult())
  mockedParsePersonaResponse.mockReturnValue(okParseResult())
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('gameStore', () => {
  // ─── Initial State ──────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('setupMode is home', () => {
      expect(getState().setupMode).toBe('home')
    })

    it('gameConfig is null', () => {
      expect(getState().gameConfig).toBeNull()
    })

    it('gameState is null', () => {
      expect(getState().gameState).toBeNull()
    })

    it('messages is empty array', () => {
      expect(getState().messages).toEqual([])
    })

    it('llmHistory is empty array', () => {
      expect(getState().llmHistory).toEqual([])
    })

    it('loading is false', () => {
      expect(getState().loading).toBe(false)
    })

    it('activeTab is cards', () => {
      expect(getState().activeTab).toBe('cards')
    })

    it('configJson is a valid JSON string that parses to an object with name "EDIP Security of Supply Wargame"', () => {
      const parsed = JSON.parse(getState().configJson)
      expect(parsed.name).toBe('EDIP Security of Supply Wargame')
    })

    it('currentAbortController is null', () => {
      expect(getState().currentAbortController).toBeNull()
    })

    it('lastFacilitatorInput is null', () => {
      expect(getState().lastFacilitatorInput).toBeNull()
    })

    it('pendingControlBanner is null', () => {
      expect(getState().pendingControlBanner).toBeNull()
    })
  })

  // ─── initGame ───────────────────────────────────────────────────────────────

  describe('initGame', () => {
    beforeEach(() => {
      initS1()
    })

    it('sets gameConfig to the provided config', () => {
      expect(getState().gameConfig).toBe(config)
    })

    it('creates gameState with round 1', () => {
      expect(getState().gameState?.round).toBe(1)
    })

    it('creates gameState with correct scenarioIndex 0 for S1', () => {
      expect(getState().gameState?.scenarioIndex).toBe(0)
    })

    it('initializes crisisSeverity from scenario startState (S1: 0)', () => {
      expect(getState().gameState?.crisisSeverity).toBe(0)
    })

    it('initializes crisisState from scenario startState (S1: No Crisis)', () => {
      expect(getState().gameState?.crisisState).toBe('No Crisis')
    })

    it('initializes edipLegitimacy from scenario startState (S1: 0)', () => {
      expect(getState().gameState?.edipLegitimacy).toBe(0)
    })

    it('creates teams array with 4 teams matching config team count', () => {
      expect(getState().gameState?.teams).toHaveLength(4)
    })

    it('Team A has correct starting resources (pc=3, po=0, readiness=3, stock=2, crm=2, ic=2)', () => {
      const teamA = getState().gameState?.teams.find((t) => t.id === 'A')
      expect(teamA).toMatchObject({ pc: 3, po: 0, readiness: 3, stock: 2, crm: 2, ic: 2 })
    })

    it('cardsThisRound is empty array', () => {
      expect(getState().gameState?.cardsThisRound).toEqual([])
    })

    it('messages is cleared (empty array)', () => {
      // First add a message, then re-init
      getState().addMessage({
        id: 'msg1', type: 'facilitator', text: 'test', timestamp: '2026-01-01T00:00:00Z',
      } as ChatMessage)
      initS1()
      expect(getState().messages).toEqual([])
    })

    it('llmHistory is cleared (empty array)', () => {
      getState().appendHistory('user', 'hello')
      initS1()
      expect(getState().llmHistory).toEqual([])
    })

    it('idempotent re-init: calling initGame with S2 after S1 produces fresh S2 state with no S1 residue', () => {
      // Currently S1 is active (from beforeEach)
      // Add some messages/history to prove they get cleared
      getState().addMessage({
        id: 'msg2', type: 'persona', text: 'from S1', timestamp: '2026-01-01T00:00:00Z',
      } as ChatMessage)
      getState().appendHistory('assistant', 'S1 response')

      // Now init S2
      initS2()

      const state = getState()
      expect(state.gameState?.round).toBe(1)
      expect(state.gameState?.scenarioIndex).toBe(1)
      expect(state.gameState?.crisisSeverity).toBe(0)
      expect(state.gameState?.crisisState).toBe('No Crisis')
      expect(state.messages).toEqual([])
      expect(state.llmHistory).toEqual([])
      // Teams should match config (same config, but re-initialized)
      expect(state.gameState?.teams).toHaveLength(4)
    })
  })

  // ─── resetGame ─────────────────────────────────────────────────────────────

  describe('resetGame', () => {
    beforeEach(() => {
      initS1()
      // Mutate some state before resetting
      getState().addMessage({
        id: 'r1', type: 'facilitator', text: 'hello', timestamp: '2026-01-01T00:00:00Z',
      } as ChatMessage)
      getState().appendHistory('user', 'round msg')
      getState().setLoading(true)
      getState().setActiveTab('actions')
      getState().resetGame()
    })

    it('gameConfig is null after reset', () => {
      expect(getState().gameConfig).toBeNull()
    })

    it('gameState is null after reset', () => {
      expect(getState().gameState).toBeNull()
    })

    it('messages is empty after reset', () => {
      expect(getState().messages).toEqual([])
    })

    it('llmHistory is empty after reset', () => {
      expect(getState().llmHistory).toEqual([])
    })

    it('loading is false after reset', () => {
      expect(getState().loading).toBe(false)
    })

    it('activeTab is cards after reset', () => {
      expect(getState().activeTab).toBe('cards')
    })

    it('configJson is re-populated with EDIP config JSON after reset', () => {
      const parsed = JSON.parse(getState().configJson)
      expect(parsed.name).toBe('EDIP Security of Supply Wargame')
    })
  })

  // ─── applyStateUpdate ───────────────────────────────────────────────────────

  describe('applyStateUpdate', () => {
    it('no-ops when gameState is null (does not throw)', () => {
      expect(() => {
        getState().applyStateUpdate({ crisisSeverity: 3 })
      }).not.toThrow()
      expect(getState().gameState).toBeNull()
    })

    describe('with gameState active', () => {
      beforeEach(() => {
        initS1()
      })

      it('updates crisisSeverity when provided', () => {
        getState().applyStateUpdate({ crisisSeverity: 3 })
        expect(getState().gameState?.crisisSeverity).toBe(3)
      })

      it('clamps crisisSeverity to max 5 (input: 6 -> stored: 5)', () => {
        getState().applyStateUpdate({ crisisSeverity: 6 })
        expect(getState().gameState?.crisisSeverity).toBe(5)
      })

      it('clamps crisisSeverity to min 0 (input: -1 -> stored: 0)', () => {
        getState().applyStateUpdate({ crisisSeverity: -1 })
        expect(getState().gameState?.crisisSeverity).toBe(0)
      })

      it('updates crisisState when provided', () => {
        getState().applyStateUpdate({ crisisState: 'Supply Crisis' })
        expect(getState().gameState?.crisisState).toBe('Supply Crisis')
      })

      it('updates edipLegitimacy when provided', () => {
        getState().applyStateUpdate({ edipLegitimacy: 1 })
        expect(getState().gameState?.edipLegitimacy).toBe(1)
      })

      it('clamps edipLegitimacy to max 2 (input: 3 -> stored: 2)', () => {
        getState().applyStateUpdate({ edipLegitimacy: 3 })
        expect(getState().gameState?.edipLegitimacy).toBe(2)
      })

      it('clamps edipLegitimacy to min -2 (input: -3 -> stored: -2)', () => {
        getState().applyStateUpdate({ edipLegitimacy: -3 })
        expect(getState().gameState?.edipLegitimacy).toBe(-2)
      })

      it('updates team pc by id (not index)', () => {
        getState().applyStateUpdate({ teamUpdates: [{ id: 'A', pc: 5 }] })
        const teamA = getState().gameState?.teams.find((t) => t.id === 'A')
        expect(teamA?.pc).toBe(5)
      })

      it('clamps team pc to max 6 (input: 7 -> stored: 6)', () => {
        getState().applyStateUpdate({ teamUpdates: [{ id: 'A', pc: 7 }] })
        const teamA = getState().gameState?.teams.find((t) => t.id === 'A')
        expect(teamA?.pc).toBe(6)
      })

      it('clamps team pc to min 0 (input: -1 -> stored: 0)', () => {
        getState().applyStateUpdate({ teamUpdates: [{ id: 'A', pc: -1 }] })
        const teamA = getState().gameState?.teams.find((t) => t.id === 'A')
        expect(teamA?.pc).toBe(0)
      })

      it('clamps team po to max 2 (input: 3 -> stored: 2)', () => {
        getState().applyStateUpdate({ teamUpdates: [{ id: 'A', po: 3 }] })
        const teamA = getState().gameState?.teams.find((t) => t.id === 'A')
        expect(teamA?.po).toBe(2)
      })

      it('clamps team po to min -2 (input: -3 -> stored: -2)', () => {
        getState().applyStateUpdate({ teamUpdates: [{ id: 'A', po: -3 }] })
        const teamA = getState().gameState?.teams.find((t) => t.id === 'A')
        expect(teamA?.po).toBe(-2)
      })

      it('clamps team readiness to max 5 (input: 6 -> stored: 5)', () => {
        getState().applyStateUpdate({ teamUpdates: [{ id: 'A', readiness: 6 }] })
        const teamA = getState().gameState?.teams.find((t) => t.id === 'A')
        expect(teamA?.readiness).toBe(5)
      })

      it('clamps team readiness to min 0 (input: -1 -> stored: 0)', () => {
        getState().applyStateUpdate({ teamUpdates: [{ id: 'A', readiness: -1 }] })
        const teamA = getState().gameState?.teams.find((t) => t.id === 'A')
        expect(teamA?.readiness).toBe(0)
      })

      it('clamps team stock to max 99 (input: 100 -> stored: 99)', () => {
        getState().applyStateUpdate({ teamUpdates: [{ id: 'A', stock: 100 }] })
        const teamA = getState().gameState?.teams.find((t) => t.id === 'A')
        expect(teamA?.stock).toBe(99)
      })

      it('clamps team stock to min 0 (input: -1 -> stored: 0)', () => {
        getState().applyStateUpdate({ teamUpdates: [{ id: 'A', stock: -1 }] })
        const teamA = getState().gameState?.teams.find((t) => t.id === 'A')
        expect(teamA?.stock).toBe(0)
      })

      it('clamps team crm to max 99 (input: 100 -> stored: 99)', () => {
        getState().applyStateUpdate({ teamUpdates: [{ id: 'A', crm: 100 }] })
        const teamA = getState().gameState?.teams.find((t) => t.id === 'A')
        expect(teamA?.crm).toBe(99)
      })

      it('clamps team crm to min 0 (input: -1 -> stored: 0)', () => {
        getState().applyStateUpdate({ teamUpdates: [{ id: 'A', crm: -1 }] })
        const teamA = getState().gameState?.teams.find((t) => t.id === 'A')
        expect(teamA?.crm).toBe(0)
      })

      it('clamps team ic to max 99 (input: 100 -> stored: 99)', () => {
        getState().applyStateUpdate({ teamUpdates: [{ id: 'A', ic: 100 }] })
        const teamA = getState().gameState?.teams.find((t) => t.id === 'A')
        expect(teamA?.ic).toBe(99)
      })

      it('clamps team ic to min 0 (input: -1 -> stored: 0)', () => {
        getState().applyStateUpdate({ teamUpdates: [{ id: 'A', ic: -1 }] })
        const teamA = getState().gameState?.teams.find((t) => t.id === 'A')
        expect(teamA?.ic).toBe(0)
      })

      it('silently drops unknown team ID (no error, other updates still apply)', () => {
        // Apply a mix of known and unknown IDs
        expect(() => {
          getState().applyStateUpdate({
            teamUpdates: [
              { id: 'UNKNOWN', pc: 5 },
              { id: 'A', pc: 4 },
            ],
          })
        }).not.toThrow()
        const teamA = getState().gameState?.teams.find((t) => t.id === 'A')
        expect(teamA?.pc).toBe(4)
      })

      it('null/undefined fields are no-ops (only provided fields update)', () => {
        const beforeState = getState().gameState
        const prevCrisisState = beforeState?.crisisState
        const prevEdipLeg = beforeState?.edipLegitimacy

        // Only update crisisSeverity, leave others untouched
        getState().applyStateUpdate({ crisisSeverity: 2 })
        expect(getState().gameState?.crisisState).toBe(prevCrisisState)
        expect(getState().gameState?.edipLegitimacy).toBe(prevEdipLeg)
      })

      it('partial team update: only specified fields change, others remain', () => {
        // Team A starts: pc=3, po=0, readiness=3, stock=2, crm=2, ic=2
        getState().applyStateUpdate({ teamUpdates: [{ id: 'A', pc: 5 }] })
        const teamA = getState().gameState?.teams.find((t) => t.id === 'A')
        expect(teamA?.pc).toBe(5)
        // Others unchanged
        expect(teamA?.po).toBe(0)
        expect(teamA?.readiness).toBe(3)
        expect(teamA?.stock).toBe(2)
        expect(teamA?.crm).toBe(2)
        expect(teamA?.ic).toBe(2)
      })
    })
  })

  // ─── Simple Setters ─────────────────────────────────────────────────────────

  describe('simple setters', () => {
    it('setSetupMode changes setupMode', () => {
      getState().setSetupMode('load')
      expect(getState().setupMode).toBe('load')
    })

    it('addMessage appends to messages', () => {
      const msg: ChatMessage = {
        id: 'test1', type: 'facilitator', text: 'hello', timestamp: '2026-01-01T00:00:00Z',
      }
      getState().addMessage(msg)
      expect(getState().messages).toHaveLength(1)
      expect(getState().messages[0]).toEqual(msg)
    })

    it('addMessages appends multiple messages', () => {
      const msgs: ChatMessage[] = [
        { id: 'm1', type: 'facilitator', text: 'one', timestamp: '2026-01-01T00:00:00Z' },
        { id: 'm2', type: 'facilitator', text: 'two', timestamp: '2026-01-01T00:00:01Z' },
      ]
      getState().addMessages(msgs)
      expect(getState().messages).toHaveLength(2)
    })

    it('clearMessages empties messages', () => {
      getState().addMessage({
        id: 'c1', type: 'facilitator', text: 'hi', timestamp: '2026-01-01T00:00:00Z',
      } as ChatMessage)
      getState().clearMessages()
      expect(getState().messages).toEqual([])
    })

    it('appendHistory adds to llmHistory', () => {
      getState().appendHistory('user', 'test input')
      expect(getState().llmHistory).toHaveLength(1)
      expect(getState().llmHistory[0]).toEqual({ role: 'user', content: 'test input' })
    })

    it('setLoading changes loading', () => {
      getState().setLoading(true)
      expect(getState().loading).toBe(true)
    })

    it('setActiveTab changes activeTab', () => {
      getState().setActiveTab('actions')
      expect(getState().activeTab).toBe('actions')
    })
  })

  // ─── advanceRound (LLM-wired) ───────────────────────────────────────────────

  describe('advanceRound', () => {
    it('increments round, appends round_divider, flips loading, and fires LLM turn with [ROUND_START] prefix', async () => {
      initS1()
      expect(getState().gameState?.round).toBe(1)

      getState().advanceRound()

      // Synchronous observable state: round incremented, divider pushed, loading=true
      expect(getState().gameState?.round).toBe(2)
      const msgs = getState().messages
      expect(msgs.some((m) => m.type === 'round_divider' && m.label === 'Round 2')).toBe(true)
      expect(getState().loading).toBe(true)

      // Prefixed input persisted for Retry
      expect(getState().lastFacilitatorInput).toMatch(/^\[ROUND_START Round 2\]/)

      // Wait for async LLM turn to complete
      await waitFor(() => expect(getState().loading).toBe(false))
      // Kent + Finch bubbles added via LLM mock
      const personaMsgs = getState().messages.filter((m) => m.type === 'persona')
      expect(personaMsgs.length).toBe(2)
    })

    it('is a no-op when gameState is null', () => {
      expect(getState().gameState).toBeNull()
      getState().advanceRound()
      expect(getState().messages).toHaveLength(0)
      expect(getState().gameState).toBeNull()
      expect(getState().loading).toBe(false)
    })

    it('is a no-op when loading=true (already has an in-flight turn)', () => {
      initS1()
      getState().setLoading(true)
      getState().advanceRound()
      // Round NOT incremented, no divider appended.
      expect(getState().gameState?.round).toBe(1)
      expect(getState().messages.length).toBe(0)
    })
  })

  // ─── triggerDebrief (LLM-wired) ─────────────────────────────────────────────

  describe('triggerDebrief', () => {
    it('appends debrief_divider, flips loading, fires LLM turn with [DEBRIEF_TRIGGER] prefix', async () => {
      initS1()
      getState().triggerDebrief()
      const msgs = getState().messages
      expect(msgs.some((m) => m.type === 'debrief_divider' && m.label === 'DEBRIEF')).toBe(true)
      expect(getState().loading).toBe(true)
      expect(getState().lastFacilitatorInput).toMatch(/^\[DEBRIEF_TRIGGER\]/)

      await waitFor(() => expect(getState().loading).toBe(false))
    })
  })

  // ─── sendFacilitatorMessage happy path + error paths ────────────────────────

  describe('sendFacilitatorMessage', () => {
    beforeEach(() => {
      initS1()
    })

    it('no-ops for empty string', () => {
      getState().sendFacilitatorMessage('')
      expect(getState().messages).toHaveLength(0)
      expect(getState().loading).toBe(false)
    })

    it('no-ops for whitespace-only input', () => {
      getState().sendFacilitatorMessage('   ')
      expect(getState().messages).toHaveLength(0)
      expect(getState().loading).toBe(false)
    })

    it('no-ops when already loading', () => {
      getState().setLoading(true)
      getState().sendFacilitatorMessage('hello')
      // Facilitator message NOT pushed
      expect(getState().messages.filter((m) => m.type === 'facilitator').length).toBe(0)
    })

    it('trims whitespace and stores trimmed text', () => {
      getState().sendFacilitatorMessage('  hello  ')
      expect(getState().messages[0].text).toBe('hello')
      expect(getState().lastFacilitatorInput).toBe('hello')
    })

    it('happy path: adds facilitator bubble, runs LLM turn, adds persona messages, updates state, appends history, clears loading', async () => {
      getState().sendFacilitatorMessage('hello world')

      // Synchronous: facilitator bubble + loading=true
      expect(getState().messages[0].type).toBe('facilitator')
      expect(getState().loading).toBe(true)

      await waitFor(() => expect(getState().loading).toBe(false))

      // Two persona messages added
      const personaMsgs = getState().messages.filter((m) => m.type === 'persona')
      expect(personaMsgs).toHaveLength(2)
      expect(personaMsgs[0].speaker).toBe('kent')
      expect(personaMsgs[1].speaker).toBe('finch')
      // revealDelay staggered 0ms / 500ms
      expect(personaMsgs[0].revealDelay).toBe(0)
      expect(personaMsgs[1].revealDelay).toBe(500)

      // gameState updated from Finch's stateUpdate { crisisSeverity: 2 }
      expect(getState().gameState?.crisisSeverity).toBe(2)

      // llmHistory got +2 entries (user + assistant)
      expect(getState().llmHistory).toHaveLength(2)
      expect(getState().llmHistory[0]).toEqual({ role: 'user', content: 'hello world' })
      expect(getState().llmHistory[1].role).toBe('assistant')

      // currentAbortController cleared
      expect(getState().currentAbortController).toBeNull()
    })

    it('LLM error path (timeout): adds red error bubble, retryInput set, gameState + llmHistory unchanged', async () => {
      mockedCallLLMProxy.mockResolvedValue({
        ok: false,
        errorCode: 'LLM_TIMEOUT',
        message: 'Timed out after 45s',
      })
      const beforeGameState = getState().gameState
      const beforeHistory = getState().llmHistory

      getState().sendFacilitatorMessage('hello')

      await waitFor(() => expect(getState().loading).toBe(false))

      const errMsgs = getState().messages.filter((m) => m.type === 'error')
      expect(errMsgs).toHaveLength(1)
      expect(errMsgs[0].errorCode).toBe('LLM_TIMEOUT')
      expect(errMsgs[0].retryInput).toBe('hello')
      expect(errMsgs[0].rawResponse).toBeUndefined()

      // Atomicity: gameState + llmHistory byte-identical
      expect(getState().gameState).toEqual(beforeGameState)
      expect(getState().llmHistory).toEqual(beforeHistory)
      expect(getState().currentAbortController).toBeNull()
    })

    it('parse failure path: error bubble carries rawResponse + retryInput; gameState + llmHistory unchanged', async () => {
      mockedCallLLMProxy.mockResolvedValue({ ok: true, text: 'junk response' })
      mockedParsePersonaResponse.mockReturnValue({
        ok: false,
        errorKind: 'PARSE_FAILURE',
        raw: 'junk response',
        detail: 'JSON.parse failed',
      })
      const beforeGameState = getState().gameState
      const beforeHistory = getState().llmHistory

      getState().sendFacilitatorMessage('hello')
      await waitFor(() => expect(getState().loading).toBe(false))

      const errMsgs = getState().messages.filter((m) => m.type === 'error')
      expect(errMsgs).toHaveLength(1)
      expect(errMsgs[0].errorCode).toBe('PARSE_FAILURE')
      expect(errMsgs[0].retryInput).toBe('hello')
      expect(errMsgs[0].rawResponse).toBe('junk response')

      // Atomicity
      expect(getState().gameState).toEqual(beforeGameState)
      expect(getState().llmHistory).toEqual(beforeHistory)
    })

    it('atomicity across both error paths: no mutation regardless of which layer failed', async () => {
      // Establish a known baseline state
      initS1()
      const baseGameState = structuredClone(getState().gameState)
      const baseHistory = structuredClone(getState().llmHistory)

      // First error: network
      mockedCallLLMProxy.mockResolvedValueOnce({
        ok: false,
        errorCode: 'NETWORK_ERROR',
        message: 'offline',
      })
      getState().sendFacilitatorMessage('a')
      await waitFor(() => expect(getState().loading).toBe(false))

      expect(getState().gameState).toEqual(baseGameState)
      expect(getState().llmHistory).toEqual(baseHistory)

      // Second error: parse failure
      mockedCallLLMProxy.mockResolvedValueOnce({ ok: true, text: 'bad' })
      mockedParsePersonaResponse.mockReturnValueOnce({
        ok: false,
        errorKind: 'VALIDATION_FAILURE',
        raw: 'bad',
        detail: 'schema mismatch',
      })
      getState().sendFacilitatorMessage('b')
      await waitFor(() => expect(getState().loading).toBe(false))

      expect(getState().gameState).toEqual(baseGameState)
      expect(getState().llmHistory).toEqual(baseHistory)
    })
  })

  // ─── retryLastMessage ───────────────────────────────────────────────────────

  describe('retryLastMessage', () => {
    beforeEach(() => {
      initS1()
    })

    it('replays lastFacilitatorInput and applies the retry response', async () => {
      // First call fails
      mockedCallLLMProxy.mockResolvedValueOnce({
        ok: false,
        errorCode: 'LLM_TIMEOUT',
        message: 'Timed out',
      })
      getState().sendFacilitatorMessage('replay me')
      await waitFor(() => expect(getState().loading).toBe(false))
      expect(getState().messages.some((m) => m.type === 'error')).toBe(true)

      // Second call (retry) succeeds via the default happy-path mock
      getState().retryLastMessage()
      expect(getState().loading).toBe(true)
      await waitFor(() => expect(getState().loading).toBe(false))

      // Persona messages now present + gameState updated
      expect(getState().messages.filter((m) => m.type === 'persona')).toHaveLength(2)
      expect(getState().gameState?.crisisSeverity).toBe(2)

      // callLLMProxy called twice with same input
      expect(mockedCallLLMProxy).toHaveBeenCalledTimes(2)
      const secondCallArgs = mockedCallLLMProxy.mock.calls[1][1]
      const lastMessage = secondCallArgs[secondCallArgs.length - 1]
      expect(lastMessage).toEqual({ role: 'user', content: 'replay me' })
    })

    it('no-ops when lastFacilitatorInput is null', () => {
      getState().retryLastMessage()
      expect(mockedCallLLMProxy).not.toHaveBeenCalled()
    })

    it('no-ops when already loading', async () => {
      getState().sendFacilitatorMessage('hi')
      // While loading=true, retry should bail
      expect(getState().loading).toBe(true)
      getState().retryLastMessage()
      expect(mockedCallLLMProxy).toHaveBeenCalledTimes(1)
      await waitFor(() => expect(getState().loading).toBe(false))
    })
  })

  // ─── Control banner ─────────────────────────────────────────────────────────

  describe('pendingControlBanner', () => {
    beforeEach(() => {
      initS1()
    })

    it('LLM response with control.advanceRound=true sets banner kind=advanceRound with targetRound', async () => {
      mockedParsePersonaResponse.mockReturnValue({
        ok: true,
        value: {
          responses: [{ speaker: 'kent', message: 'go', stateUpdate: null, flag: null }],
          control: { advanceRound: true },
        },
      })
      getState().sendFacilitatorMessage('advance?')
      await waitFor(() => expect(getState().loading).toBe(false))

      const banner = getState().pendingControlBanner
      expect(banner?.kind).toBe('advanceRound')
      expect(banner?.targetRound).toBe(2)
    })

    it('conflict resolution: both flags true → prefer triggerDebrief', async () => {
      mockedParsePersonaResponse.mockReturnValue({
        ok: true,
        value: {
          responses: [{ speaker: 'kent', message: 'both', stateUpdate: null, flag: null }],
          control: { advanceRound: true, triggerDebrief: true },
        },
      })
      getState().sendFacilitatorMessage('both?')
      await waitFor(() => expect(getState().loading).toBe(false))

      const banner = getState().pendingControlBanner
      expect(banner?.kind).toBe('triggerDebrief')
    })

    it('dismissControlBanner clears banner; next no-control LLM response keeps it null', async () => {
      mockedParsePersonaResponse.mockReturnValueOnce({
        ok: true,
        value: {
          responses: [{ speaker: 'kent', message: 'go', stateUpdate: null, flag: null }],
          control: { advanceRound: true },
        },
      })
      getState().sendFacilitatorMessage('advance?')
      await waitFor(() => expect(getState().loading).toBe(false))
      expect(getState().pendingControlBanner?.kind).toBe('advanceRound')

      getState().dismissControlBanner()
      expect(getState().pendingControlBanner).toBeNull()

      // Next message returns no control signal.
      mockedParsePersonaResponse.mockReturnValueOnce({
        ok: true,
        value: {
          responses: [{ speaker: 'kent', message: 'nothing', stateUpdate: null, flag: null }],
        },
      })
      getState().sendFacilitatorMessage('noop')
      await waitFor(() => expect(getState().loading).toBe(false))
      expect(getState().pendingControlBanner).toBeNull()
    })

    it('confirmControlBanner with kind=advanceRound increments round and clears banner', async () => {
      mockedParsePersonaResponse.mockReturnValueOnce({
        ok: true,
        value: {
          responses: [{ speaker: 'kent', message: 'go', stateUpdate: null, flag: null }],
          control: { advanceRound: true },
        },
      })
      getState().sendFacilitatorMessage('advance?')
      await waitFor(() => expect(getState().loading).toBe(false))
      expect(getState().pendingControlBanner?.kind).toBe('advanceRound')
      expect(getState().gameState?.round).toBe(1)

      getState().confirmControlBanner()
      // Banner clears synchronously (before advanceRound's async LLM turn returns)
      expect(getState().pendingControlBanner).toBeNull()
      expect(getState().gameState?.round).toBe(2)

      await waitFor(() => expect(getState().loading).toBe(false))
    })
  })

  // ─── Clamp log warning (DEV only) ───────────────────────────────────────────

  describe('clamp log warning', () => {
    it('LLM stateUpdate with crisisSeverity=9 → clamped to 5, console.warn called in dev', async () => {
      initS1()
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      mockedParsePersonaResponse.mockReturnValue({
        ok: true,
        value: {
          responses: [
            { speaker: 'kent', message: 'overshoot', stateUpdate: { crisisSeverity: 9 }, flag: null },
          ],
        },
      })

      getState().sendFacilitatorMessage('boom')
      await waitFor(() => expect(getState().loading).toBe(false))

      expect(getState().gameState?.crisisSeverity).toBe(5)
      // import.meta.env.DEV is true under Vitest — warning must have fired.
      expect(warnSpy).toHaveBeenCalled()
      const warnCall = warnSpy.mock.calls.find((c) =>
        typeof c[0] === 'string' && c[0].includes('[stateUpdater]'),
      )
      expect(warnCall).toBeDefined()

      warnSpy.mockRestore()
    })
  })

  // ─── llmHistory invariant: ≤ 2N+1 = 13 entries ──────────────────────────────

  describe('llmHistory length invariant', () => {
    it('after 10 consecutive successful turns, llmHistory.length stays ≤ 2*HISTORY_WINDOW_N+1 = 13', async () => {
      initS1()
      const MAX = 2 * HISTORY_WINDOW_N + 1 // 13 when N=6

      for (let i = 0; i < 10; i++) {
        getState().sendFacilitatorMessage(`turn ${i}`)
        await waitFor(() => expect(getState().loading).toBe(false))
        expect(getState().llmHistory.length).toBeLessThanOrEqual(MAX)
      }

      // After 10 turns (20 entries appended raw), length should stabilise at exactly 13.
      expect(getState().llmHistory.length).toBe(MAX)
    })
  })

  // ─── newGame: FLOW-05 in-flight abort + Phase 6 transient reset ─────────────

  describe('newGame (FLOW-05)', () => {
    it('mid-LLM-turn newGame() aborts fetch, clears loading, nulls all transient slices', async () => {
      initS1()

      // Mock a never-resolving promise that records the signal it received.
      let capturedSignal: AbortSignal | undefined
      mockedCallLLMProxy.mockImplementation(async (_sys, _msgs, opts) => {
        capturedSignal = opts?.signal
        // Return a promise that only resolves when aborted.
        return new Promise<LLMCallResult>((resolve) => {
          opts?.signal?.addEventListener('abort', () => {
            resolve({ ok: false, errorCode: 'ABORTED', message: 'cancelled' })
          })
        })
      })

      // Pre-populate some transient state so we can verify it gets cleared.
      useGameStore.setState({
        lastFacilitatorInput: 'old input',
        pendingControlBanner: { kind: 'advanceRound', targetRound: 5 },
        llmHistory: [
          { role: 'user', content: 'old user' },
          { role: 'assistant', content: 'old asst' },
        ],
      })

      // Kick off an in-flight LLM call.
      getState().sendFacilitatorMessage('in-flight')
      expect(getState().loading).toBe(true)
      expect(getState().currentAbortController).not.toBeNull()

      // Immediately call newGame.
      getState().newGame()

      // Synchronous assertions.
      expect(getState().currentAbortController).toBeNull()
      expect(getState().loading).toBe(false)
      expect(getState().llmHistory).toEqual([])
      expect(getState().lastFacilitatorInput).toBeNull()
      expect(getState().pendingControlBanner).toBeNull()
      expect(getState().gameState).toBeNull()
      expect(getState().messages).toEqual([])

      // The fetch mock saw abort() on its signal.
      expect(capturedSignal?.aborted).toBe(true)

      // Let the aborted promise resolve so the in-flight turn's catch/bail completes cleanly.
      await waitFor(() => expect(getState().loading).toBe(false))
    })
  })
})
