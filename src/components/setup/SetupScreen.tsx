import { useGameStore } from '@/lib/gameStore'
import HomeScreen from './HomeScreen'

// TODO(04-03): replace placeholder with real LoadConfigPanel import
// import LoadConfigPanel from './LoadConfigPanel'

export default function SetupScreen() {
  const setupMode = useGameStore((s) => s.setupMode)

  switch (setupMode) {
    case 'home':
      return <HomeScreen />

    case 'load':
      // TODO(04-03): replace with <LoadConfigPanel />
      return (
        <div className="p-8 text-text-secondary">
          Load Config Panel — arriving in plan 04-03
        </div>
      )

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
