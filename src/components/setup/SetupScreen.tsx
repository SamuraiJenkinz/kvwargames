import { useGameStore } from '@/lib/gameStore'
import HomeScreen from './HomeScreen'
import LoadConfigPanel from './LoadConfigPanel'
import GenerateBriefPanel from './GenerateBriefPanel'

export default function SetupScreen() {
  const setupMode = useGameStore((s) => s.setupMode)

  switch (setupMode) {
    case 'home':
      return <HomeScreen />

    case 'load':
      return <LoadConfigPanel />

    case 'brief':
      return <GenerateBriefPanel />

    case 'review':
      // 'review' is effectively redundant — the flow lands on 'load' mode after brief generation.
      // Kept for forward compatibility but redirect to 'load' for safety.
      return <LoadConfigPanel />
  }
}
