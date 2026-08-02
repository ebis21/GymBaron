import { useCallback, useEffect, useState } from 'react'
import { useGameStore } from './store/gameStore'
import type { MachineTypeId } from './game/types'
import { entryFee } from './game/economy'
import { machineType } from './game/content/machines'
import GymScene3D from './three/GymScene3D'
import type { Focus } from './three/scene'
import TopBar from './ui/TopBar'
import ShopScreen from './ui/ShopScreen'
import StatsScreen from './ui/StatsScreen'
import GameOverScreen from './ui/GameOverScreen'
import DayReportModal from './ui/DayReportModal'
import WelcomeBack from './ui/WelcomeBack'
import { money } from './ui/format'

type Tab = 'gym' | 'shop' | 'stats'

interface Action {
  label: string
  hint: string
  run: () => void
  enabled: boolean
}

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

  const advanceDay = useGameStore(s => s.advanceDay)

  const [tab, setTab] = useState<Tab>('gym')
  // Which machine the player bought and still has to place. Purely a UI
  // concern — the engine only ever sees a completed purchase.
  const [pending, setPending] = useState<MachineTypeId | null>(null)
  // What the player is standing next to, reported by the 3D scene.
  const [focus, setFocus] = useState<Focus>(null)

  const onFocus = useCallback((next: Focus) => setFocus(next), [])

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

  /**
   * Turns whatever the player is standing next to into the single button in
   * the bottom-right corner. One focus, one action — no menus in the world.
   */
  const action = ((): Action | null => {
    if (!focus || state.dayEnded) return null

    if (focus.kind === 'place') {
      if (!pending) return null
      const spec = machineType(pending)
      return {
        label: 'Postaw tutaj',
        hint: spec.name,
        enabled: true,
        run: () => {
          buyMachine(pending, focus.x, focus.y)
          setPending(null)
        },
      }
    }

    if (focus.kind === 'repair') {
      const machine = state.machines.find(m => m.uid === focus.machineUid)
      if (!machine) return null
      const spec = machineType(machine.type)
      return {
        label: `Napraw ${money(spec.repairCost)}`,
        hint: spec.name,
        enabled: state.cash >= spec.repairCost,
        run: () => repair(focus.machineUid),
      }
    }

    const client = state.clients.find(c => c.uid === focus.clientUid)
    if (!client) return null

    // The engine hands the client the first free machine, so quote that one.
    const free = state.machines.find(m => m.durability > 0 && m.occupiedBy === null)
    if (!free) {
      return { label: 'Brak wolnej maszyny', hint: '', enabled: false, run: () => {} }
    }

    const fee = entryFee(free.type, client.kind)
    return {
      label: `Skanuj +${money(fee)}`,
      hint: client.kind === 'member' ? 'Członek — 90% zniżki' : 'Przechodzień',
      enabled: true,
      run: () => scan(focus.clientUid),
    }
  })()

  return (
    <div className="app">
      <GymScene3D state={state} pending={pending} onFocus={onFocus} />

      <TopBar state={state} />

      {pending && (
        <div className="carry-banner">
          Niesiesz: <strong>{machineType(pending).name}</strong> — stań na wolnym polu
          <button className="btn ghost tiny" onClick={() => setPending(null)}>
            Odłóż
          </button>
        </div>
      )}

      {tab === 'shop' && (
        <div className="panel">
          <ShopScreen state={state} onSelect={selectMachine} />
        </div>
      )}
      {tab === 'stats' && (
        <div className="panel">
          <StatsScreen state={state} />
        </div>
      )}

      {tab === 'gym' && action && (
        <button className="action-btn" disabled={!action.enabled} onClick={action.run}>
          <span className="action-label">{action.label}</span>
          {action.hint && <span className="action-hint">{action.hint}</span>}
        </button>
      )}

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

      {state.dayEnded && state.dayReport && !state.gameOver && (
        <DayReportModal
          report={state.dayReport}
          onNextDay={() => {
            setTab('gym')
            advanceDay()
          }}
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
