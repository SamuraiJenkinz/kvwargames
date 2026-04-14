import { Routes, Route, Navigate } from 'react-router'
import { useGameStore } from '@/lib/gameStore'
import { seedMockState } from '@/mocks/seedMockState'
import SetupScreen from '@/components/setup/SetupScreen'
import GameScreen from '@/components/game/GameScreen'

// ─── GuardedGameScreen ────────────────────────────────────────────────────────

/**
 * Renders GameScreen when gameState is set; redirects to /setup (replace) when null.
 * `replace` prevents a history entry so the browser back button cannot bounce
 * back to /game from /setup.
 *
 * DEV shortcut: when import.meta.env.DEV is true and gameState is null, seeds
 * mock state synchronously then returns null (triggering an immediate re-render
 * with the seeded state). Production dead-code elimination strips this branch.
 */
function GuardedGameScreen() {
  const gameState = useGameStore((s) => s.gameState)

  if (gameState === null) {
    if (import.meta.env.DEV) {
      // Dev convenience: seed mock state synchronously so the game screen
      // renders immediately without going through the Launch flow.
      seedMockState()
      // Fall through and render below — the next render will have state.
      return null
    }
    return <Navigate to="/setup" replace />
  }

  return <GameScreen />
}

// ─── AppRoutes ────────────────────────────────────────────────────────────────

/**
 * Route table with no Router wrapper.
 * Exported so tests can render under MemoryRouter without wrapping in BrowserRouter.
 * Production entry (main.tsx) wraps in BrowserRouter > App > AppRoutes.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/setup" element={<SetupScreen />} />
      <Route path="/game" element={<GuardedGameScreen />} />
      <Route path="/" element={<Navigate to="/setup" replace />} />
      <Route path="*" element={<Navigate to="/setup" replace />} />
    </Routes>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────

/**
 * Root component. BrowserRouter lives in main.tsx; App just renders AppRoutes.
 */
function App() {
  return <AppRoutes />
}

export default App
