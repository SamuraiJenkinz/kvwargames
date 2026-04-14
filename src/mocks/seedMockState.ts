/**
 * Dev-only store seeder for Phase 5 game screen rendering.
 *
 * Call seedMockState() to populate the Zustand store with mock data so that
 * navigating to /game during development shows a fully-rendered mid-game UI.
 *
 * NEVER call this function from production code paths. The import.meta.env.DEV
 * guard lives at the call site (Plan 05-03 GuardedGameScreen) — not here.
 * Keeping this function unconditional makes it testable in isolation.
 */

import { useGameStore } from '@/lib/gameStore'
import { EDIP_CONFIG } from '@/data/edipConfig'
import { MOCK_GAME_STATE, MOCK_MESSAGES } from './mockGameState'
import type { GameConfig } from '@/types/game'

export function seedMockState(): void {
  const { setGameConfig, setGameState, addMessages, setLoading } =
    useGameStore.getState()

  setGameConfig(EDIP_CONFIG as GameConfig)
  setGameState(MOCK_GAME_STATE)
  addMessages(MOCK_MESSAGES)
  setLoading(true) // renders persona-attributed loading indicator at feed tail
}
