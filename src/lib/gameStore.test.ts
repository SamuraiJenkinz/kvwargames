import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useGameStore } from './gameStore'
import { EDIP_CONFIG } from '@/data/edipConfig'
import type { GameConfig, ChatMessage } from '@/types/game'

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

describe('gameStore', () => {
  // ─── Initial State ──────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('phase is setup', () => {
      expect(getState().phase).toBe('setup')
    })

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
  })

  // ─── initGame ───────────────────────────────────────────────────────────────

  describe('initGame', () => {
    beforeEach(() => {
      initS1()
    })

    it('sets phase to game', () => {
      expect(getState().phase).toBe('game')
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

    it('returns phase to setup', () => {
      expect(getState().phase).toBe('setup')
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
        const beforeState = getState().gameState!
        const prevCrisisState = beforeState.crisisState
        const prevEdipLeg = beforeState.edipLegitimacy

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
    it('setPhase changes phase', () => {
      getState().setPhase('game')
      expect(getState().phase).toBe('game')
    })

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
})
