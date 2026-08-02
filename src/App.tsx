import { useCallback, useEffect, useState } from 'react'
import { useGameStore } from './store/gameStore'
import type { PlacedKind } from './game/build'
import { entryFee } from './game/economy'
import { machineType } from './game/content/machines'
import { decorType } from './game/content/decor'
import GymScene3D from './three/GymScene3D'
import type { Focus, PickResult } from './three/scene'
import TopBar from './ui/TopBar'
import ShopScreen from './ui/ShopScreen'
import StatsScreen from './ui/StatsScreen'
import GameOverScreen from './ui/GameOverScreen'
import DayReportModal from './ui/DayReportModal'
import InventoryPanel from './ui/InventoryPanel'
import WelcomeBack from './ui/WelcomeBack'
import { money } from './ui/format'

type Tab = 'gym' | 'shop' | 'stats'

interface Selection {
  kind: PlacedKind
  uid: string
}

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
  const scan = useGameStore(s => s.scan)
  const repair = useGameStore(s => s.repair)
  const restart = useGameStore(s => s.restart)
  const dismissWelcome = useGameStore(s => s.dismissWelcome)
  const advanceDay = useGameStore(s => s.advanceDay)

  const buyMachine = useGameStore(s => s.buyMachine)
  const buyDecor = useGameStore(s => s.buyDecor)
  const buyWall = useGameStore(s => s.buyWall)
  const placeItem = useGameStore(s => s.placeItem)
  const placeWallEdge = useGameStore(s => s.placeWallEdge)
  const storeObject = useGameStore(s => s.storeObject)
  const rotateObject = useGameStore(s => s.rotateObject)
  const moveObject = useGameStore(s => s.moveObject)
  const demolishWall = useGameStore(s => s.demolishWall)

  const [tab, setTab] = useState<Tab>('gym')
  const [focus, setFocus] = useState<Focus>(null)

  const [buildMode, setBuildMode] = useState(false)
  const [wallMode, setWallMode] = useState(false)
  const [selected, setSelected] = useState<Selection | null>(null)
  /** Tile the player tapped, waiting for something out of the bag. */
  const [placingOn, setPlacingOn] = useState<{ x: number; y: number } | null>(null)
  /** Object picked up for relocation; the next tile tap drops it. */
  const [moving, setMoving] = useState<Selection | null>(null)

  const onFocus = useCallback((next: Focus) => setFocus(next), [])

  useEffect(() => {
    start()
    return stop
  }, [start, stop])

  const leaveBuildMode = () => {
    setBuildMode(false)
    setWallMode(false)
    setSelected(null)
    setMoving(null)
    setPlacingOn(null)
  }

  /**
   * One click, several possible meanings. Order matters: a pending move beats
   * everything, then wall work, then selecting what is already there, and only
   * an otherwise-empty tile opens the bag.
   */
  const onPick = useCallback(
    (pick: PickResult) => {
      if (!pick.tile) return

      if (moving) {
        moveObject(moving.kind, moving.uid, pick.tile.x, pick.tile.y)
        setSelected(moving)
        setMoving(null)
        return
      }

      if (wallMode) {
        if (pick.wallUid) {
          demolishWall(pick.wallUid)
          return
        }
        const wall = state.inventory.find(i => i.kind === 'wall')
        if (wall && pick.edge) placeWallEdge(wall.uid, pick.edge.x, pick.edge.y, pick.edge.side)
        return
      }

      if (pick.object) {
        setSelected(pick.object)
        return
      }

      setSelected(null)
      setPlacingOn(pick.tile)
    },
    [moving, wallMode, state.inventory, moveObject, demolishWall, placeWallEdge],
  )

  if (!ready) {
    return (
      <div className="app">
        <div className="screen">
          <p className="hint">Otwieranie siłowni…</p>
        </div>
      </div>
    )
  }

  const selectedMachine =
    selected?.kind === 'machine' ? state.machines.find(m => m.uid === selected.uid) : undefined
  const selectedDecor =
    selected?.kind === 'decor' ? state.decor.find(d => d.uid === selected.uid) : undefined

  const selectedName = selectedMachine
    ? machineType(selectedMachine.type).name
    : selectedDecor
      ? decorType(selectedDecor.type).name
      : null

  const wallsInBag = state.inventory.filter(i => i.kind === 'wall').length

  /** The proximity button, shown only outside build mode. */
  const action = ((): Action | null => {
    if (!focus || state.dayEnded || buildMode) return null

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
      <GymScene3D
        state={state}
        buildMode={buildMode}
        selected={selected}
        preview={null}
        onFocus={onFocus}
        onPick={onPick}
      />

      <TopBar state={state} />

      {tab === 'gym' && !state.dayEnded && (
        <button
          className={`build-toggle${buildMode ? ' on' : ''}`}
          onClick={() => (buildMode ? leaveBuildMode() : setBuildMode(true))}
        >
          {buildMode ? '✓ Gotowe' : '🔨 Buduj'}
        </button>
      )}

      {buildMode && (
        <div className="build-bar">
          {moving ? (
            <span className="build-hint">Wskaż nowe pole…</span>
          ) : wallMode ? (
            <>
              <span className="build-hint">Klikaj krawędzie kafli · w torbie: {wallsInBag}</span>
              <button className="btn ghost tiny" onClick={() => setWallMode(false)}>
                Koniec ścian
              </button>
            </>
          ) : selected && selectedName ? (
            <>
              <span className="build-hint">{selectedName}</span>
              <button
                className="btn tiny"
                onClick={() => rotateObject(selected.kind, selected.uid)}
              >
                Obróć
              </button>
              <button
                className="btn tiny"
                onClick={() => {
                  setMoving(selected)
                  setSelected(null)
                }}
              >
                Przestaw
              </button>
              <button
                className="btn tiny"
                disabled={selectedMachine?.occupiedBy != null}
                onClick={() => {
                  storeObject(selected.kind, selected.uid)
                  setSelected(null)
                }}
              >
                Schowaj
              </button>
              <button className="btn ghost tiny" onClick={() => setSelected(null)}>
                ✕
              </button>
            </>
          ) : (
            <>
              <span className="build-hint">Kliknij pole albo sprzęt</span>
              <button
                className="btn tiny"
                onClick={() => setWallMode(true)}
                disabled={wallsInBag === 0}
              >
                Ścianki ({wallsInBag})
              </button>
            </>
          )}
        </div>
      )}

      {tab === 'shop' && (
        <div className="panel">
          <ShopScreen
            state={state}
            onBuyMachine={buyMachine}
            onBuyDecor={buyDecor}
            onBuyWall={buyWall}
          />
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
        <button
          className={`tab${tab === 'shop' ? ' active' : ''}`}
          onClick={() => {
            leaveBuildMode()
            setTab('shop')
          }}
        >
          Sklep
        </button>
        <button
          className={`tab${tab === 'stats' ? ' active' : ''}`}
          onClick={() => {
            leaveBuildMode()
            setTab('stats')
          }}
        >
          Statystyki
        </button>
      </nav>

      {placingOn && (
        <InventoryPanel
          items={state.inventory.filter(i => i.kind !== 'wall')}
          onChoose={itemUid => {
            placeItem(itemUid, placingOn.x, placingOn.y)
            setPlacingOn(null)
          }}
          onClose={() => setPlacingOn(null)}
        />
      )}

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
            leaveBuildMode()
            setTab('gym')
            advanceDay()
          }}
        />
      )}

      {state.gameOver && (
        <GameOverScreen
          state={state}
          onRestart={() => {
            leaveBuildMode()
            restart()
          }}
        />
      )}
    </div>
  )
}
