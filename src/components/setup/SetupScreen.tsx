import { useGameStore } from '@/lib/gameStore'
import HomeScreen from './HomeScreen'
import LoadConfigPanel from './LoadConfigPanel'

export default function SetupScreen() {
  const setupMode = useGameStore((s) => s.setupMode)

  switch (setupMode) {
    case 'home':
      return <HomeScreen />

    case 'load':
      return <LoadConfigPanel />

    case 'brief':
      return (
        <div className="p-8 text-text-secondary">
          Brief generation — Phase 7
        </div>
      )

    case 'review':
      return (
        <div className="p-8 text-text-secondary">
          Review — Phase 7
        </div>
      )
  }
}
