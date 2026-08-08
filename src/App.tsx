import { useCallback, useEffect, useRef, useState } from 'react'
import { useGameStore } from './store/gameStore'
import type { PlacedKind } from './game/build'
import { machineType } from './game/content/machines'
import { FLOOR_UNLOCK_COST, HIRING_UNLOCK_LEVEL, STAFF_UNLOCK_LEVEL } from './game/constants'
import { isClosingTime } from './game/clock'
import GymScene3D from './three/GymScene3D'
import type { Focus, PickResult } from './three/scene'
import TopBar from './ui/TopBar'
import Phone, { type PhoneApp } from './ui/Phone'
import ShopScreen from './ui/ShopScreen'
import StatsScreen from './ui/StatsScreen'
import UpgradesScreen from './ui/UpgradesScreen'
import MarketingScreen from './ui/MarketingScreen'
import ContractsScreen from './ui/ContractsScreen'
import SponsorsScreen from './ui/SponsorsScreen'
import { cleanHoldMs, repairHoldMs } from './game/upgrades'
import StaffPanel from './ui/StaffPanel'
import RecruitScreen from './ui/RecruitScreen'
import GameOverScreen from './ui/GameOverScreen'
import DayReportModal from './ui/DayReportModal'
import InventoryPanel from './ui/InventoryPanel'
import ClientCard from './ui/ClientCard'
import WelcomeBack from './ui/WelcomeBack'
import DevPanel from './ui/DevPanel'
import SettingsModal from './ui/SettingsModal'
import { useI18n, useI18nStore } from './i18n'
import FloorAccessModal from './ui/FloorAccessModal'
import { floorName } from './game/floors'

/** Which full-screen panel is over the room, if any. */
type Tab =
  | 'gym' | 'shop' | 'stats' | 'staff' | 'upgrades'
  | 'marketing' | 'contracts' | 'sponsors'

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

// Cleaning is quick; repairing kit takes noticeably longer. Both are now the
// base rung of an upgrade track — see `content/upgrades.ts` — and are read off
// the state per render rather than fixed here.
/**
 * Stepping up to a client is instant on E. It opens a card and charges
 * nothing on its own — the decision is still one tap away inside it — so
 * making the player hold the key for it was friction with nothing behind it.
 * Cleaning and repairing still hold: those commit the moment they finish.
 */
const CLIENT_KEY_HOLD_MS = 0

/** Rotates the selected fixture in build mode. */
const ROTATE_KEY = 'r'

/** Puts the selected fixture or partition back in the bag, in build mode. */
const STORE_KEY = 'x'

/** The key bound to the proximity action. */
const ACTION_KEY = 'e'

/**
 * Whether to advertise the keyboard shortcut. A touch device has no E to hold,
 * and a hint about one is just noise on a small screen.
 */
const HAS_KEYBOARD =
  typeof window !== 'undefined' && window.matchMedia?.('(hover: hover)').matches === true

/** One in-progress hold, whichever input started it. */
interface Hold {
  ms: number
  uid: string
  run: () => void
}

interface Action {
  label: string
  hint: string
  run: () => void
  enabled: boolean
  /**
   * Present when the on-screen button resolves by being held down rather than
   * tapped. Null for actions a tap is enough for.
   */
  hold: { ms: number; uid: string } | null
  /**
   * What holding E does. Always present — every action is holdable from the
   * keyboard. `uid` identifies the target the hold is bound to, so a hold in
   * progress can be told apart from a fresh one on a new target.
   */
  key: { ms: number; uid: string }
}

export default function App() {
  const { t, money } = useI18n()
  const langReady = useI18nStore(s => s.ready)

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

  const buyExpansion = useGameStore(s => s.buyExpansion)
  const buyUpgrade = useGameStore(s => s.buyUpgrade)
  const marketing = useGameStore(s => s.marketing)
  const contracts = useGameStore(s => s.contracts)
  const sponsors = useGameStore(s => s.sponsors)
  const buyNextFloor = useGameStore(s => s.buyNextFloor)
  const switchFloor = useGameStore(s => s.switchFloor)
  const endDay = useGameStore(s => s.endDay)

  const hireCandidate = useGameStore(s => s.hireCandidate)
  const fireStaff = useGameStore(s => s.fireStaff)
  const settleArrears = useGameStore(s => s.settleArrears)
  const rerollCandidates = useGameStore(s => s.rerollCandidates)

  const [tab, setTab] = useState<Tab>('gym')
  const [phoneOpen, setPhoneOpen] = useState(false)
  const [focus, setFocus] = useState<Focus>(null)
  const [recruiting, setRecruiting] = useState(false)
  const [floorAccessOpen, setFloorAccessOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const [buildMode, setBuildMode] = useState(false)
  /** Bumped by the dev panel to drop the player at the front counter. */
  const [teleport, setTeleport] = useState(0)
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

  // --- serve / clean / repair hold ---------------------------------------
  // Fraction (0..1) the action button is currently filled while held down,
  // whether the hold came from a finger on the button or from E on the
  // keyboard. Purely a UI timer: `scan`/`wipe`/`repair` in the store still own
  // the actual mutation and its validation, this only gates *when* they run.
  const [holdPct, setHoldPct] = useState(0)
  const holdRef = useRef<(Hold & { start: number; raf: number }) | null>(null)
  /** Refreshed every render so the rAF loop always sees the latest action. */
  const actionRef = useRef<Action | null>(null)

  const cancelHold = useCallback(() => {
    const active = holdRef.current
    if (active) cancelAnimationFrame(active.raf)
    holdRef.current = null
    setHoldPct(0)
  }, [])

  const tickHold = useCallback((now: number) => {
    const active = holdRef.current
    if (!active) return

    // The target moved on, vanished, or became unaffordable mid-hold — no
    // partial credit, the player has to start over. `key.uid` is the target
    // identity for both input routes, so one check covers them both.
    const current = actionRef.current
    if (!current || current.key.uid !== active.uid || !current.enabled) {
      cancelHold()
      return
    }

    const pct = Math.min(1, (now - active.start) / active.ms)
    setHoldPct(pct)

    if (pct >= 1) {
      holdRef.current = null
      active.run()
      setHoldPct(0)
      return
    }

    active.raf = requestAnimationFrame(tickHold)
  }, [cancelHold])

  const beginHold = useCallback(
    (hold: Hold) => {
      // Re-entry guard: a second keydown while a hold is running (or a finger
      // landing on the button mid-keyboard-hold) must not orphan the first rAF.
      if (holdRef.current) return
      const entry = { ...hold, start: performance.now(), raf: 0 }
      holdRef.current = entry
      setHoldPct(0)
      entry.raf = requestAnimationFrame(tickHold)
    },
    [tickHold],
  )

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

  // A hold in progress is only ever valid for the exact target it started on.
  // `focus` only changes reference when the game decides the target itself
  // changed (moved, fixed, wiped, or the player walked out of reach) — see
  // `sameFocus` in three/scene.ts — so it is the right signal to reset on.
  // Leaving the gym tab, entering build mode, or stepping up to a client all
  // hide the button outright and should clear any hold the same way.
  useEffect(() => {
    cancelHold()
  }, [focus, buildMode, talking, tab, state.dayEnded, floorAccessOpen, cancelHold])

  // Belt-and-braces: drop any in-flight rAF if the component ever unmounts.
  useEffect(() => () => cancelHold(), [cancelHold])

  // E does whatever the on-screen action button would do. Actions that commit
  // something the moment they land — cleaning, repairing — are held; stepping
  // up to a client, which only opens a card, fires on the press.
  useEffect(() => {
    const isTyping = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      (target.isContentEditable || /^(input|textarea|select)$/i.test(target.tagName))

    const onDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== ACTION_KEY) return
      // `repeat` is the OS auto-firing the key; the hold is already running.
      if (e.repeat || e.altKey || e.ctrlKey || e.metaKey || isTyping(e.target)) return

      const act = actionRef.current
      if (!act || !act.enabled) return

      e.preventDefault()
      if (act.key.ms <= 0) act.run()
      else beginHold({ ms: act.key.ms, uid: act.key.uid, run: act.run })
    }

    const onUp = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === ACTION_KEY) cancelHold()
    }

    // Alt-tabbing mid-hold never delivers the keyup, which would otherwise
    // leave the bar frozen part-filled until the next press.
    const onBlur = () => cancelHold()

    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [beginHold, cancelHold])

  // R turns whatever is selected in build mode — the same thing the rotate
  // button does, without making the player reach for it between every piece.
  useEffect(() => {
    if (!buildMode || !selected) return

    const onRotate = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== ROTATE_KEY) return
      if (e.altKey || e.ctrlKey || e.metaKey) return
      e.preventDefault()
      rotateObject(selected.kind, selected.uid)
    }

    window.addEventListener('keydown', onRotate)
    return () => window.removeEventListener('keydown', onRotate)
  }, [buildMode, selected, rotateObject])

  // X packs the selection away — the same "Schowaj" the bar offers, for the
  // fixture or the partition, whichever one is selected. It stays quiet while
  // something is mid-move or in hand, because the button is gone in those
  // states and the key must not do what the bar is not offering.
  useEffect(() => {
    if (!buildMode || moving || movingWall || carrying) return
    if (!selected && !selectedWall) return

    const onStore = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== STORE_KEY) return
      if (e.altKey || e.ctrlKey || e.metaKey) return
      e.preventDefault()

      if (selectedWall) {
        demolishWall(selectedWall)
        setSelectedWall(null)
        return
      }
      if (!selected) return

      // A machine with someone on it cannot be packed: the button is disabled
      // in that state, and the key has to agree with it. Read at press time
      // rather than from a dep — the clock rewrites `state` every tick, and
      // this listener has no reason to be torn down and rebound that often.
      const machine =
        selected.kind === 'machine'
          ? useGameStore.getState().state.machines.find(m => m.uid === selected.uid)
          : undefined
      if (machine?.occupiedBy != null) return

      storeObject(selected.kind, selected.uid)
      setSelected(null)
    }

    window.addEventListener('keydown', onStore)
    return () => window.removeEventListener('keydown', onStore)
  }, [buildMode, moving, movingWall, carrying, selected, selectedWall, storeObject, demolishWall])

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

  // The language is read back from storage asynchronously, so the loading
  // screen also covers that — otherwise a Polish player would watch the game
  // paint in English and then switch under them.
  if (!ready || !langReady) {
    return (
      <div className="app">
        <div className="screen">
          <p className="hint">{t.loading}</p>
        </div>
      </div>
    )
  }

  const selectedMachine =
    selected?.kind === 'machine' ? state.machines.find(m => m.uid === selected.uid) : undefined
  const selectedDecor =
    selected?.kind === 'decor' ? state.decor.find(d => d.uid === selected.uid) : undefined

  const selectedName = selectedMachine
    ? t.content.machines[selectedMachine.type]
    : selectedDecor
      ? t.content.decor[selectedDecor.type]
      : null

  const carried = carrying ? state.inventory.find(i => i.uid === carrying) : undefined
  const activeApp: PhoneApp = tab !== 'gym' ? tab : buildMode ? 'build' : 'gym'
  const partner = talking ? state.clients.find(c => c.uid === talking) : undefined

  // 20:00 shuts the door but does not end the day: the gym stays live so the
  // player can rebuild, and closing up is a button rather than an ambush.
  const afterHours = isClosingTime(state.dayMs) && !state.dayEnded && !state.gameOver
  const stillInside = state.clients.length

  // The two proximity actions the player performs by hand, both shortened by
  // their own upgrade track.
  const cleanMs = cleanHoldMs(state)
  const repairMs = repairHoldMs(state)

  /** The proximity button, shown only outside build mode. */
  const action = ((): Action | null => {
    if (!focus || state.dayEnded || buildMode || talking) return null

    if (focus.kind === 'floorAccess') {
      const unlocked = state.floorPlans.length > 1
      return {
        label: unlocked ? t.action.floorPick : t.action.floorUnlock,
        hint: unlocked ? floorName(state.activeFloor) : money(FLOOR_UNLOCK_COST),
        run: () => setFloorAccessOpen(true),
        enabled: true,
        hold: null,
        key: { ms: 0, uid: 'floor-access' },
      }
    }

    if (focus.kind === 'repair') {
      const machine = state.machines.find(m => m.uid === focus.machineUid)
      if (!machine) return null
      const spec = machineType(machine.type)
      return {
        label: t.action.repair(money(spec.repairCost)),
        hint: t.content.machines[machine.type],
        enabled: state.cash >= spec.repairCost,
        run: () => repair(focus.machineUid),
        hold: { ms: repairMs, uid: focus.machineUid },
        key: { ms: repairMs, uid: focus.machineUid },
      }
    }

    if (focus.kind === 'wipe') {
      return {
        label: t.action.clean,
        hint: '',
        enabled: true,
        run: () => wipe(focus.stainUid),
        hold: { ms: cleanMs, uid: focus.stainUid },
        key: { ms: cleanMs, uid: focus.stainUid },
      }
    }

    const client = state.clients.find(c => c.uid === focus.clientUid)
    if (!client) return null

    // Scanning is a face-to-face: this only walks up to them, and the card
    // that follows is where the pass is actually charged. A tap on the button
    // is enough; E holds for two seconds, because that hand is also driving.
    return {
      label: t.action.serve,
      hint: `${client.kind === 'member' ? t.action.member : t.action.passerby} · ${t.content.rarity[client.rarity]}`,
      enabled: true,
      run: () => setTalking(focus.clientUid),
      hold: null,
      key: { ms: CLIENT_KEY_HOLD_MS, uid: focus.clientUid },
    }
  })()

  actionRef.current = action

  return (
    <div className={`app${tab === 'gym' ? '' : ' panelled'}`}>
      <GymScene3D
        state={state}
        buildMode={buildMode}
        selected={selected}
        preview={null}
        facing={talking}
        paused={floorAccessOpen}
        teleport={teleport}
        onFocus={onFocus}
        onPick={onPick}
        onFloorAccess={() => setFloorAccessOpen(true)}
      />

      <TopBar state={state} onOpenSettings={() => setSettingsOpen(true)} />
      {import.meta.env.DEV && (
        <DevPanel
          onTeleportToReception={() => {
            setTab('gym')
            leaveBuildMode()
            setTalking(null)
            setTeleport(n => n + 1)
          }}
        />
      )}

      {buildMode && tab === 'gym' && (
        <div className="build-bar">
          {moving ? (
            <span className="build-hint">{t.build.pickTile}</span>
          ) : movingWall ? (
            <>
              <span className="build-hint">{t.build.pickEdge}</span>
              <button className="btn ghost tiny" onClick={() => setMovingWall(null)}>
                {t.build.cancel}
              </button>
            </>
          ) : carrying ? (
            <>
              <span className="build-hint">
                {carried?.kind === 'wall'
                  ? t.build.pickEdgeForWall
                  : t.build.pickTileForItem}
              </span>
              <button className="btn ghost tiny" onClick={() => setCarrying(null)}>
                {t.build.cancel}
              </button>
            </>
          ) : selectedWall ? (
            <>
              <span className="build-hint">{t.build.wall}</span>
              <button className="btn tiny" onClick={() => setMovingWall(selectedWall)}>
                {t.build.move}
              </button>
              <button
                className="btn tiny"
                onClick={() => {
                  demolishWall(selectedWall)
                  setSelectedWall(null)
                }}
              >
                {t.build.store}{HAS_KEYBOARD && <kbd className="btn-key">X</kbd>}
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
                {t.build.rotate}{HAS_KEYBOARD && <kbd className="btn-key">R</kbd>}
              </button>
              <button
                className="btn tiny"
                onClick={() => {
                  setMoving(selected)
                  setSelected(null)
                }}
              >
                {t.build.move}
              </button>
              <button
                className="btn tiny"
                disabled={selectedMachine?.occupiedBy != null}
                onClick={() => {
                  storeObject(selected.kind, selected.uid)
                  setSelected(null)
                }}
              >
                {t.build.store}{HAS_KEYBOARD && <kbd className="btn-key">X</kbd>}
              </button>
              <button className="btn ghost tiny" onClick={() => setSelected(null)}>
                ✕
              </button>
            </>
          ) : (
            <>
              <span className="build-hint">{t.build.idle}</span>
              <button className="btn tiny" onClick={() => setBag({ tile: null })}>
                {t.build.inventory(state.inventory.length)}
              </button>
              <button className="btn tiny" onClick={() => setTab('shop')}>
                {t.build.shop}
              </button>
              <button className="btn primary tiny" onClick={leaveBuildMode}>
                {t.build.done}
              </button>
            </>
          )}
        </div>
      )}

      {tab !== 'gym' && (
        <div className="panel">
          <button className="panel-close" onClick={() => setTab('gym')} aria-label={t.settings.close}>
            ✕
          </button>
          {tab === 'shop' ? (
            <ShopScreen
              state={state}
              onBuyMachine={buyMachine}
              onBuyDecor={buyDecor}
              onBuyWall={buyWall}
              onBuyExpansion={buyExpansion}
            />
          ) : tab === 'staff' ? (
            state.level < HIRING_UNLOCK_LEVEL ? (
              <div className="screen">
                <header className="screen-head">
                  <h2>{t.staff.title}</h2>
                </header>
                <p className="hint">
                  {t.staff.locked(HIRING_UNLOCK_LEVEL, STAFF_UNLOCK_LEVEL, state.level)}
                </p>
              </div>
            ) : recruiting ? (
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
          ) : tab === 'upgrades' ? (
            <UpgradesScreen state={state} onBuy={buyUpgrade} />
          ) : tab === 'marketing' ? (
            <MarketingScreen state={state} onMarketing={marketing} />
          ) : tab === 'contracts' ? (
            <ContractsScreen state={state} onContract={contracts} />
          ) : tab === 'sponsors' ? (
            <SponsorsScreen state={state} onSponsor={sponsors} />
          ) : (
            <StatsScreen state={state} />
          )}
        </div>
      )}

      {tab === 'gym' && action && (
        <button
          className={`action-btn${action.hold ? ' holdable' : ''}${holdPct > 0 ? ' holding' : ''}`}
          disabled={!action.enabled}
          onClick={action.hold ? undefined : action.run}
          onPointerDown={
            action.hold
              ? () => beginHold({ ...action.hold!, run: action.run })
              : undefined
          }
          onPointerUp={action.hold ? cancelHold : undefined}
          onPointerCancel={action.hold ? cancelHold : undefined}
          onPointerLeave={action.hold ? cancelHold : undefined}
          onContextMenu={action.hold ? e => e.preventDefault() : undefined}
        >
          {/* A keyboard hold fills the same bar even on a tap-only action. */}
          {(action.hold || holdPct > 0) && (
            <span className="action-hold-track">
              <span
                className="action-hold-fill"
                style={{ width: `${(1 - holdPct) * 100}%` }}
              />
            </span>
          )}
          <span className="action-label">{action.label}</span>
          {holdPct > 0 ? (
            <span className="action-hint">
              {t.action.remaining(
                Math.max(0, ((1 - holdPct) * action.key.ms) / 1000).toFixed(1),
              )}
            </span>
          ) : (
            <span className="action-hint">
              {action.hint}
              {HAS_KEYBOARD && (
                <span className="action-key">
                  <kbd>E</kbd> {action.key.ms > 0 ? t.action.hold : ''}
                </span>
              )}
            </span>
          )}
        </button>
      )}

      {tab === 'gym' && afterHours && (
        <div className="closing-bar">
          <div className="closing-text">
            <strong>{t.closing.title}</strong>
            <small>
              {stillInside > 0 ? t.closing.stillInside(stillInside) : t.closing.empty}
            </small>
          </div>
          <button className="btn primary tiny" onClick={endDay}>
            {t.closing.closeDay}
          </button>
        </div>
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
              ? t.build.bagOnEdge
              : t.build.bagOnTile
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
          onScan={trainerUid => {
            scan(partner.uid, trainerUid)
            setTalking(null)
          }}
          onClose={() => setTalking(null)}
        />
      )}

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}

      {floorAccessOpen && (
        <FloorAccessModal
          state={state}
          onBuy={buyNextFloor}
          onSwitch={floor => {
            leaveBuildMode()
            setTalking(null)
            switchFloor(floor)
          }}
          onClose={() => setFloorAccessOpen(false)}
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
