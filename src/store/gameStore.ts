import { create } from 'zustand'
import type { DecorTypeId, GameState, MachineTypeId } from '../game/types'
import { initialState } from '../game/economy'
import { machineType } from '../game/content/machines'
import { decorType, WALL_PRICE } from '../game/content/decor'
import {
  addToInventory,
  movePlaced,
  moveWall,
  placeFromInventory,
  placeWall,
  removeWall,
  rotatePlaced,
  storePlaced,
  type PlacedKind,
} from '../game/build'
import { scanClient } from '../game/clients'
import { wipeStain } from '../game/stains'
import { closeDay, nextDay } from '../game/dayClose'
import { nextExpansion } from '../game/content/expansion'
import { isClosingTime } from '../game/clock'
import { staffDoorPoint, syncRoomSize } from '../game/layout'
import { advance } from '../game/tick'
import { serialize, deserialize } from '../game/save'
import { settleOffline } from '../game/offline'
import { hire, fire, payArrears } from '../game/staff'
import { buyUpgrade } from '../game/upgrades'
import type { UpgradeId } from '../game/content/upgrades'
import { refreshPool, ensurePool } from '../game/recruit'
import { applyMarketing, type MarketingAction } from '../game/marketing'
import { applyContracts, machineUnlocked, type ContractAction } from '../game/contracts'
import { applySponsors, type SponsorAction } from '../game/sponsors'
import { loadRaw, saveRaw } from './storage'
import { AUTOSAVE_MS, SAVE_KEY } from '../game/constants'
import { switchActiveFloor, unlockNextFloor } from '../game/floors'

export interface WelcomeBack {
  earned: number
  awayMs: number
}

interface GameStore {
  state: GameState
  welcomeBack: WelcomeBack | null
  ready: boolean
  buyMachine: (type: MachineTypeId) => void
  buyDecor: (type: DecorTypeId) => void
  buyWall: () => void
  placeItem: (itemUid: string, x: number, y: number) => void
  placeWallEdge: (itemUid: string, x: number, y: number, side: 'n' | 's' | 'e' | 'w') => void
  storeObject: (kind: PlacedKind, uid: string) => void
  rotateObject: (kind: PlacedKind, uid: string) => void
  moveObject: (kind: PlacedKind, uid: string, x: number, y: number) => void
  moveWallEdge: (uid: string, x: number, y: number, side: 'n' | 's' | 'e' | 'w') => void
  demolishWall: (uid: string) => void
  /** `trainerUid` books a personal trainer for this visit; null is the plain fee. */
  scan: (clientUid: string, trainerUid?: string | null) => void
  buyExpansion: () => void
  /** Buys the next rung of one upgrade track; ignored at the top of the ladder. */
  buyUpgrade: (id: UpgradeId) => void
  buyNextFloor: () => void
  switchFloor: (floor: number) => void
  /** Cashes up the day. Only offered once the clock has run out. */
  endDay: () => void
  repair: (machineUid: string) => void
  wipe: (stainUid: string) => void
  hireCandidate: (candidateUid: string) => void
  fireStaff: (staffUid: string) => void
  settleArrears: (staffUid: string) => void
  rerollCandidates: () => void
  /**
   * The three v2 systems each get exactly one action, carrying a union the
   * feature owns. A new campaign type or a new kind of deal is a change to
   * that union and to the screen that dispatches it — never to this file,
   * which is why three branches can grow three feature sets without ever
   * meeting here.
   */
  marketing: (action: MarketingAction) => void
  contracts: (action: ContractAction) => void
  sponsors: (action: SponsorAction) => void
  advanceDay: () => void
  dismissWelcome: () => void
  restart: () => void
  start: () => void
  stop: () => void
  /** Dev-only shortcut for testing: overwrites arbitrary state fields. */
  cheat: (patch: Partial<GameState>) => void
}

// The store is the only place in the app that touches the wall clock.
let rafId: number | null = null
let lastFrameAt = 0
let sinceSaveMs = 0
let visibilityBound = false

export const useGameStore = create<GameStore>((set, get) => {
  const persist = (state: GameState) => {
    void saveRaw(SAVE_KEY, serialize({ ...state, lastSeenAt: Date.now() }))
  }

  /** Money out of the till, recorded as spend. */
  const charge = (state: GameState, price: number): GameState => ({
    ...state,
    cash: state.cash - price,
    stats: { ...state.stats, totalSpent: state.stats.totalSpent + price },
  })

  /**
   * Adopts a new state and saves it. The build functions return the state
   * unchanged when they refuse an action, so an identity check is all it takes
   * to skip a pointless render and write.
   */
  const commit = (next: GameState) => {
    if (next === get().state) return
    set({ state: next })
    persist(next)
  }

  const frame = (now: number) => {
    rafId = requestAnimationFrame(frame)

    const dtMs = lastFrameAt === 0 ? 0 : now - lastFrameAt
    lastFrameAt = now
    if (dtMs <= 0) return

    const current = get().state
    if (current.gameOver || current.dayEnded) return

    const next = advance(current, dtMs)
    set({ state: next })

    // Closing time is worth a save of its own — the takings of a whole day are
    // the one thing a player would hate to replay. After that the gym stays
    // live for building, so the ordinary autosave carries on below.
    if (isClosingTime(next.dayMs) && !isClosingTime(current.dayMs)) {
      sinceSaveMs = 0
      persist(next)
      return
    }

    sinceSaveMs += dtMs
    if (sinceSaveMs >= AUTOSAVE_MS) {
      sinceSaveMs = 0
      persist(next)
    }
  }

  const startLoop = () => {
    if (rafId !== null) return
    lastFrameAt = 0
    rafId = requestAnimationFrame(frame)
  }

  const stopLoop = () => {
    if (rafId === null) return
    cancelAnimationFrame(rafId)
    rafId = null
    persist(get().state)
  }

  return {
    state: initialState(Date.now(), Date.now()),
    welcomeBack: null,
    ready: false,

    start: () => {
      if (get().ready) {
        startLoop()
        return
      }

      void (async () => {
        const now = Date.now()
        const raw = await loadRaw(SAVE_KEY)
        const loaded = raw ? deserialize(raw, now) : initialState(now, now)
        // Before a single engine call: an expanded gym must be restored at its
        // real size, or the first offline tick would route everyone around
        // walls that are no longer there.
        syncRoomSize(loaded)
        const settled = settleOffline(loaded, now)
        const { earned, awayMs } = settled
        const state = ensurePool(settled.state)

        set({
          state,
          ready: true,
          welcomeBack: awayMs > 0 ? { earned, awayMs } : null,
        })
        persist(state)
        startLoop()
      })()

      // A backgrounded tab must not drain battery or bank frames.
      if (!visibilityBound) {
        visibilityBound = true
        document.addEventListener('visibilitychange', () => {
          if (document.hidden) stopLoop()
          else if (get().ready) startLoop()
        })
      }
    },

    stop: stopLoop,

    buyMachine: type => {
      const state = get().state
      const spec = machineType(type)
      if (state.gameOver || state.level < spec.minLevel || state.cash < spec.price) return
      // The shop already hides kit behind an unsigned contract, but the shop
      // is a view. This is where a purchase is actually decided, so this is
      // where the gate has to be — see `contracts.ts`. With no contracts in
      // the game yet the predicate passes everything, which is why the branch
      // that adds them is also the one that tests it.
      if (!machineUnlocked(state, type)) return

      commit(addToInventory(charge(state, spec.price), { kind: 'machine', type }))
    },

    buyDecor: type => {
      const state = get().state
      const spec = decorType(type)
      if (state.gameOver || state.cash < spec.price) return

      commit(addToInventory(charge(state, spec.price), { kind: 'decor', type }))
    },

    buyWall: () => {
      const state = get().state
      if (state.gameOver || state.cash < WALL_PRICE) return

      commit(addToInventory(charge(state, WALL_PRICE), { kind: 'wall' }))
    },

    placeItem: (itemUid, x, y) => commit(placeFromInventory(get().state, itemUid, x, y)),

    placeWallEdge: (itemUid, x, y, side) =>
      commit(placeWall(get().state, itemUid, x, y, side)),

    storeObject: (kind, uid) => commit(storePlaced(get().state, kind, uid)),

    rotateObject: (kind, uid) => commit(rotatePlaced(get().state, kind, uid)),

    moveObject: (kind, uid, x, y) => commit(movePlaced(get().state, kind, uid, x, y)),

    moveWallEdge: (uid, x, y, side) => commit(moveWall(get().state, uid, x, y, side)),

    demolishWall: uid => commit(removeWall(get().state, uid)),

    scan: (clientUid, trainerUid = null) => {
      const state = get().state
      if (state.gameOver) return
      commit(scanClient(state, clientUid, trainerUid))
    },

    buyExpansion: () => {
      const state = get().state
      const next = nextExpansion(state.expansion)
      if (state.gameOver || !next) return
      if (state.level < next.minLevel || state.cash < next.price) return

      const grown = { ...charge(state, next.price), expansion: state.expansion + 1 }
      // The room register is what `walkable`/`insideGrid` read; sync it now so
      // the very next build action already sees the new floor, rather than
      // waiting for the next engine tick to widen the bounds.
      syncRoomSize(grown)
      commit(grown)
    },

    // `buyUpgrade` already charges the price and books the spend, so it does
    // not go through `charge` — unlike the shop, where the purchase and the
    // payment are two separate steps.
    buyUpgrade: id => commit(buyUpgrade(get().state, id)),

    buyNextFloor: () => commit(unlockNextFloor(get().state)),

    switchFloor: floor => {
      const current = get().state
      const switched = switchActiveFloor(current, floor)
      if (switched === current) return

      // Geometry helpers and the staff entrance both depend on the active
      // room's size. Move the register first, then put every employee safely
      // on the target floor's doorway with their old job cleared.
      syncRoomSize(switched)
      const door = staffDoorPoint()
      commit({
        ...switched,
        staff: switched.staff.map(member => ({
          ...member,
          x: door.x,
          z: door.z,
        })),
      })
    },

    endDay: () => commit(closeDay(get().state)),

    repair: machineUid => {
      const state = get().state
      if (state.gameOver) return

      const machine = state.machines.find(m => m.uid === machineUid)
      if (!machine || machine.durability >= 100) return

      const cost = machineType(machine.type).repairCost
      if (state.cash < cost) return

      const next: GameState = {
        ...state,
        cash: state.cash - cost,
        machines: state.machines.map(m =>
          m.uid === machineUid ? { ...m, durability: 100 } : m,
        ),
        stats: { ...state.stats, totalSpent: state.stats.totalSpent + cost },
      }
      set({ state: next })
      persist(next)
    },

    wipe: uid => {
      const state = get().state
      if (state.gameOver) return
      commit(wipeStain(state, uid))
    },

    hireCandidate: uid => {
      const state = get().state
      if (state.gameOver) return
      commit(hire(state, uid))
    },

    fireStaff: uid => {
      const state = get().state
      if (state.gameOver) return
      commit(fire(state, uid))
    },

    settleArrears: uid => {
      const state = get().state
      if (state.gameOver) return
      commit(payArrears(state, uid))
    },

    rerollCandidates: () => {
      const state = get().state
      if (state.gameOver) return
      commit(refreshPool(state))
    },

    // Each dispatcher is deliberately identical and deliberately thin: the
    // guard, then the feature's own reducer, then `commit`. A reducer that
    // refuses an action returns the state it was given, and `commit` skips the
    // render and the write on identity — same contract as the build functions.
    marketing: action => {
      const state = get().state
      if (state.gameOver) return
      commit(applyMarketing(state, action))
    },

    contracts: action => {
      const state = get().state
      if (state.gameOver) return
      commit(applyContracts(state, action))
    },

    sponsors: action => {
      const state = get().state
      if (state.gameOver) return
      commit(applySponsors(state, action))
    },

    advanceDay: () => {
      const next = nextDay(get().state)
      if (next === get().state) return

      sinceSaveMs = 0
      set({ state: next })
      persist(next)
    },

    dismissWelcome: () => set({ welcomeBack: null }),

    restart: () => {
      const now = Date.now()
      const fresh = ensurePool(initialState(now, now))
      // A fresh gym is the base room again, whatever the last one grew to.
      syncRoomSize(fresh)
      sinceSaveMs = 0
      set({ state: fresh, welcomeBack: null, ready: true })
      persist(fresh)
      startLoop()
    },

    cheat: patch => commit({ ...get().state, ...patch }),
  }
})
