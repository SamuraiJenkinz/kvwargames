import { Routes, Route, Navigate } from 'react-router'
import { useGameStore } from '@/lib/gameStore'
import SetupScreen from '@/components/setup/SetupScreen'
import GameScreen from '@/components/game/GameScreen'

function GuardedGameScreen() {
  const gameState = useGameStore((s) => s.gameState)
  if (gameState === null) {
    return <Navigate to="/setup" replace />
  }
  return <GameScreen />
}

function App() {
  return (
    <Routes>
      <Route path="/setup" element={<SetupScreen />} />
      <Route path="/game" element={<GuardedGameScreen />} />
      <Route path="/" element={<Navigate to="/setup" replace />} />
      <Route path="*" element={<Navigate to="/setup" replace />} />
    </Routes>
  )
}

export default App
