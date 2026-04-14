import { Routes, Route, Navigate } from 'react-router'
import { useGameStore } from '@/lib/gameStore'
import SetupScreen from '@/components/setup/SetupScreen'
import GameScreen from '@/components/game/GameScreen'

// ─── GuardedGameScreen ────────────────────────────────────────────────────────

/**
 * Renders GameScreen when gameState is set; redirects to /setup (replace) when null.
 * `replace` prevents a history entry so the browser back button cannot bounce
 * back to /game from /setup.
 */
function GuardedGameScreen() {
  const gameState = useGameStore((s) => s.gameState)
  if (gameState === null) {
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
