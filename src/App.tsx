import { useEffect, useState } from 'react'
import { useGameStore } from './store/gameStore'
import type { MachineTypeId } from './game/types'
import TopBar from './ui/TopBar'
import GymScreen from './ui/GymScreen'
import ShopScreen from './ui/ShopScreen'
import StatsScreen from './ui/StatsScreen'
import GameOverScreen from './ui/GameOverScreen'
import WelcomeBack from './ui/WelcomeBack'

type Tab = 'gym' | 'shop' | 'stats'

export default function App() {
  const state = useGameStore(s => s.state)
  const welcomeBack = useGameStore(s => s.welcomeBack)
  const ready = useGameStore(s => s.ready)
  const start = useGameStore(s => s.start)
  const stop = useGameStore(s => s.stop)
  const buyMachine = useGameStore(s => s.buyMachine)
  const scan = useGameStore(s => s.scan)
  const repair = useGameStore(s => s.repair)
  const restart = useGameStore(s => s.restart)
  const dismissWelcome = useGameStore(s => s.dismissWelcome)

  const [tab, setTab] = useState<Tab>('gym')
  // Which machine the player bought and still has to place. Purely a UI
  // concern — the engine only ever sees a completed purchase.
  const [pending, setPending] = useState<MachineTypeId | null>(null)

  useEffect(() => {
    start()
    return stop
  }, [start, stop])

  if (!ready) {
    return (
      <div className="app">
        <div className="screen">
          <p className="hint">Otwieranie siłowni…</p>
        </div>
      </div>
    )
  }

  const selectMachine = (type: MachineTypeId) => {
    setPending(type)
    setTab('gym')
  }

  const place = (x: number, y: number) => {
    if (!pending) return
    buyMachine(pending, x, y)
    setPending(null)
  }

  return (
    <div className="app">
      <TopBar state={state} />

      {tab === 'gym' && (
        <GymScreen
          state={state}
          pending={pending}
          onScan={scan}
          onPlace={place}
          onRepair={repair}
          onCancelPending={() => setPending(null)}
        />
      )}
      {tab === 'shop' && <ShopScreen state={state} onSelect={selectMachine} />}
      {tab === 'stats' && <StatsScreen state={state} />}

      <nav className="tabs">
        <button className={`tab${tab === 'gym' ? ' active' : ''}`} onClick={() => setTab('gym')}>
          Sala
        </button>
        <button className={`tab${tab === 'shop' ? ' active' : ''}`} onClick={() => setTab('shop')}>
          Sklep
        </button>
        <button className={`tab${tab === 'stats' ? ' active' : ''}`} onClick={() => setTab('stats')}>
          Statystyki
        </button>
      </nav>

      {welcomeBack && welcomeBack.awayMs > 0 && (
        <WelcomeBack
          earned={welcomeBack.earned}
          awayMs={welcomeBack.awayMs}
          onDismiss={dismissWelcome}
        />
      )}

      {state.gameOver && (
        <GameOverScreen
          state={state}
          onRestart={() => {
            setPending(null)
            restart()
          }}
        />
      )}
    </div>
  )
}
