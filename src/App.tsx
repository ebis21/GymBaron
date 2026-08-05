import { useCallback, useEffect, useState } from 'react'
import { useGameStore } from './store/gameStore'
import type { PlacedKind } from './game/build'
import type { ClientRarity } from './game/types'
import { machineType } from './game/content/machines'
import { decorType } from './game/content/decor'
import GymScene3D from './three/GymScene3D'
import type { Focus, PickResult } from './three/scene'
import TopBar from './ui/TopBar'
import Phone, { type PhoneApp } from './ui/Phone'
import ShopScreen from './ui/ShopScreen'
import StatsScreen from './ui/StatsScreen'
import StaffPanel from './ui/StaffPanel'
import RecruitScreen from './ui/RecruitScreen'
import GameOverScreen from './ui/GameOverScreen'
import DayReportModal from './ui/DayReportModal'
import InventoryPanel from './ui/InventoryPanel'
import ClientCard from './ui/ClientCard'
import WelcomeBack from './ui/WelcomeBack'
import { money } from './ui/format'

/** Which full-screen panel is over the room, if any. */
type Tab = 'gym' | 'shop' | 'stats' | 'staff'

const RARITY_NAME: Record<ClientRarity, string> = {
  common: 'Zwykły',
  rare: 'Rzadki',
  epic: 'Epicki',
  legend: 'Legendarny',
  influencer: 'Influencer',
}

interface Selection {
  kind: PlacedKind
  uid: string
}

/**
 * How close to a tile's edge a tap has to land before it counts as aiming at
 * the partition there rather than at the floor. Half a tile would make every
 * click ambiguous; this is a comfortable thumb's width in world units.
 */
const EDGE_GRAB = 0.45

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
  const wipe = useGameStore(s => s.wipe)
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
  const moveWallEdge = useGameStore(s => s.moveWallEdge)
  const demolishWall = useGameStore(s => s.demolishWall)

  const hireCandidate = useGameStore(s => s.hireCandidate)
  const fireStaff = useGameStore(s => s.fireStaff)
  const settleArrears = useGameStore(s => s.settleArrears)
  const rerollCandidates = useGameStore(s => s.rerollCandidates)

  const [tab, setTab] = useState<Tab>('gym')
  const [phoneOpen, setPhoneOpen] = useState(false)
  const [focus, setFocus] = useState<Focus>(null)
  const [recruiting, setRecruiting] = useState(false)

  const [buildMode, setBuildMode] = useState(false)
  /** Client the player has stepped up to, face to face. */
  const [talking, setTalking] = useState<string | null>(null)
  const [selected, setSelected] = useState<Selection | null>(null)
  /** Wall tapped in wall mode: the one the buttons act on. */
  const [selectedWall, setSelectedWall] = useState<string | null>(null)
  /** The bag, opened either on a tile or empty-handed from the build bar. */
  const [bag, setBag] = useState<{ tile: { x: number; y: number } | null } | null>(null)
  /** Item taken out of the bag, waiting for a tile to be dropped on. */
  const [carrying, setCarrying] = useState<string | null>(null)
  /** Object picked up for relocation; the next tile tap drops it. */
  const [moving, setMoving] = useState<Selection | null>(null)
  /** Wall picked up for relocation; the next edge tap drops it. */
  const [movingWall, setMovingWall] = useState<string | null>(null)

  const onFocus = useCallback((next: Focus) => setFocus(next), [])

  useEffect(() => {
    start()
    return stop
  }, [start, stop])

  // Somebody who ran out of patience — or has already been sent to a machine —
  // is no longer standing at the counter, so the conversation ends by itself.
  const talkingGone = talking !== null && !state.clients.some(c => c.uid === talking && c.phase === 'queue')
  useEffect(() => {
    if (talkingGone) setTalking(null)
  }, [talkingGone])

  // Leaving the staff tab — by the panel's ✕ or by switching apps — should not
  // leave the recruit sub-screen armed for next time the tab opens.
  useEffect(() => {
    if (tab !== 'staff') setRecruiting(false)
  }, [tab])

  const clearBuildState = () => {
    setSelected(null)
    setSelectedWall(null)
    setMoving(null)
    setMovingWall(null)
    setCarrying(null)
    setBag(null)
  }

  const leaveBuildMode = () => {
    setBuildMode(false)
    clearBuildState()
  }

  const openApp = (app: PhoneApp) => {
    setPhoneOpen(false)

    if (app === 'build') {
      setTab('gym')
      setTalking(null)
      setBuildMode(true)
      return
    }

    if (app === 'gym') {
      setTab('gym')
      leaveBuildMode()
      return
    }

    // The shop and the stats sit over whatever is underneath, so opening them
    // mid-build does not throw away a half-arranged room.
    setTab(app)
  }

  /**
   * One click, several possible meanings, resolved without the player having
   * to say in advance whether they are working on walls or on equipment. Order
   * matters: a pending move beats everything, then an item in hand, then a
   * partition the click landed on top of, then whatever stands on the tile,
   * and only an otherwise-empty tile opens the bag.
   */
  const onPick = useCallback(
    (pick: PickResult) => {
      if (!pick.tile || !pick.edge) return

      if (moving) {
        moveObject(moving.kind, moving.uid, pick.tile.x, pick.tile.y)
        setSelected(moving)
        setMoving(null)
        return
      }

      if (movingWall) {
        moveWallEdge(movingWall, pick.edge.x, pick.edge.y, pick.edge.side)
        setSelectedWall(movingWall)
        setMovingWall(null)
        return
      }

      if (carrying) {
        const item = state.inventory.find(i => i.uid === carrying)
        if (item?.kind === 'wall') {
          placeWallEdge(carrying, pick.edge.x, pick.edge.y, pick.edge.side)
        } else {
          placeItem(carrying, pick.tile.x, pick.tile.y)
        }
        setCarrying(null)
        return
      }

      // A tap near a tile's boundary is a tap on the partition standing there,
      // not on the floor behind it.
      if (pick.wallUid && pick.edgeDistance < EDGE_GRAB) {
        setSelected(null)
        setSelectedWall(pick.wallUid)
        return
      }

      setSelectedWall(null)

      if (pick.object) {
        setSelected(pick.object)
        return
      }

      setSelected(null)
      setBag({ tile: pick.tile })
    },
    [moving, movingWall, carrying, state.inventory, moveObject, moveWallEdge, placeWallEdge, placeItem],
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

  const carried = carrying ? state.inventory.find(i => i.uid === carrying) : undefined
  const activeApp: PhoneApp = tab !== 'gym' ? tab : buildMode ? 'build' : 'gym'
  const partner = talking ? state.clients.find(c => c.uid === talking) : undefined

  /** The proximity button, shown only outside build mode. */
  const action = ((): Action | null => {
    if (!focus || state.dayEnded || buildMode || talking) return null

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

    if (focus.kind === 'wipe') {
      return {
        label: 'Posprzątaj',
        hint: '',
        enabled: true,
        run: () => wipe(focus.stainUid),
      }
    }

    const client = state.clients.find(c => c.uid === focus.clientUid)
    if (!client) return null

    // Scanning is now a face-to-face: this button only walks up to them, and
    // the card that follows is where the pass is actually charged.
    return {
      label: 'Obsłuż klienta',
      hint: `${client.kind === 'member' ? 'Członek' : 'Przechodzień'} · ${RARITY_NAME[client.rarity]}`,
      enabled: true,
      run: () => setTalking(focus.clientUid),
    }
  })()

  return (
    <div className={`app${tab === 'gym' ? '' : ' panelled'}`}>
      <GymScene3D
        state={state}
        buildMode={buildMode}
        selected={selected}
        preview={null}
        facing={talking}
        onFocus={onFocus}
        onPick={onPick}
      />

      <TopBar state={state} />

      {buildMode && tab === 'gym' && (
        <div className="build-bar">
          {moving ? (
            <span className="build-hint">Wskaż nowe pole…</span>
          ) : movingWall ? (
            <>
              <span className="build-hint">Wskaż nową krawędź…</span>
              <button className="btn ghost tiny" onClick={() => setMovingWall(null)}>
                Anuluj
              </button>
            </>
          ) : carrying ? (
            <>
              <span className="build-hint">
                {carried?.kind === 'wall'
                  ? 'Kliknij krawędź kafla…'
                  : 'Wskaż pole dla przedmiotu…'}
              </span>
              <button className="btn ghost tiny" onClick={() => setCarrying(null)}>
                Anuluj
              </button>
            </>
          ) : selectedWall ? (
            <>
              <span className="build-hint">Ścianka</span>
              <button className="btn tiny" onClick={() => setMovingWall(selectedWall)}>
                Przestaw
              </button>
              <button
                className="btn tiny"
                onClick={() => {
                  demolishWall(selectedWall)
                  setSelectedWall(null)
                }}
              >
                Schowaj
              </button>
              <button className="btn ghost tiny" onClick={() => setSelectedWall(null)}>
                ✕
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
              <span className="build-hint">Kliknij sprzęt, ściankę albo puste pole</span>
              <button className="btn tiny" onClick={() => setBag({ tile: null })}>
                Ekwipunek ({state.inventory.length})
              </button>
              <button className="btn tiny" onClick={() => setTab('shop')}>
                Sklep
              </button>
              <button className="btn primary tiny" onClick={leaveBuildMode}>
                ✓ Gotowe
              </button>
            </>
          )}
        </div>
      )}

      {tab !== 'gym' && (
        <div className="panel">
          <button className="panel-close" onClick={() => setTab('gym')} aria-label="Zamknij">
            ✕
          </button>
          {tab === 'shop' ? (
            <ShopScreen
              state={state}
              onBuyMachine={buyMachine}
              onBuyDecor={buyDecor}
              onBuyWall={buyWall}
            />
          ) : tab === 'staff' ? (
            recruiting ? (
              <RecruitScreen
                state={state}
                onHire={uid => {
                  hireCandidate(uid)
                  setRecruiting(false)
                }}
                onReroll={rerollCandidates}
                onBack={() => setRecruiting(false)}
              />
            ) : (
              <StaffPanel
                state={state}
                onFire={fireStaff}
                onSettle={settleArrears}
                onOpenRecruit={() => setRecruiting(true)}
              />
            )
          ) : (
            <StatsScreen state={state} />
          )}
        </div>
      )}

      {tab === 'gym' && action && (
        <button className="action-btn" disabled={!action.enabled} onClick={action.run}>
          <span className="action-label">{action.label}</span>
          {action.hint && <span className="action-hint">{action.hint}</span>}
        </button>
      )}

      <Phone
        state={state}
        open={phoneOpen}
        active={activeApp}
        onToggle={() => setPhoneOpen(o => !o)}
        onOpen={openApp}
      />

      {bag && (
        <InventoryPanel
          items={state.inventory}
          hint={
            bag.tile
              ? 'Ścianki stawia się na krawędzi — wybierz ją, a potem kliknij krawędź kafla.'
              : 'Wybierz przedmiot, potem wskaż mu miejsce na sali.'
          }
          onChoose={itemUid => {
            const tile = bag.tile
            const item = state.inventory.find(i => i.uid === itemUid)

            // A wall needs an edge, which a tile tap has not chosen — so it
            // always goes into the hand and waits for the next click.
            if (tile && item?.kind !== 'wall') placeItem(itemUid, tile.x, tile.y)
            else setCarrying(itemUid)
            setBag(null)
          }}
          onClose={() => setBag(null)}
        />
      )}

      {partner && (
        <ClientCard
          state={state}
          client={partner}
          onScan={() => {
            scan(partner.uid)
            setTalking(null)
          }}
          onClose={() => setTalking(null)}
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
