import GameHeader from './GameHeader'
import StatePanel from './StatePanel/StatePanel'
import ChatFeed from './ChatFeed/ChatFeed'
import ReferencePanel from './ReferencePanel/ReferencePanel'
import FacilitatorInput from './FacilitatorInput/FacilitatorInput'

export default function GameScreen() {
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-bg-base text-text-primary">
      <GameHeader />
      <div className="flex flex-1 overflow-hidden min-h-0">
        <StatePanel />
        <ChatFeed />
        <ReferencePanel />
      </div>
      <FacilitatorInput />
    </div>
  )
}
