import { strings } from '../i18n'
import { FLOOR_UNLOCK_COST, MAX_FLOORS } from './constants'
import { MAX_EXPANSION } from './content/expansion'
import type { Client, FloorPlan, GameState, Machine } from './types'

/**
 * Human-readable 0-based floor number used consistently by the HUD. Reads the
 * language from the store rather than taking it as an argument: every caller
 * is a render path that would otherwise have to thread it through untouched.
 */
export const floorName = (floor: number): string => {
  const t = strings()
  return floor === 0 ? t.floors.ground : t.floors.numbered(floor)
}

export function floorPlanFrom(state: GameState): FloorPlan {
  return {
    expansion: state.expansion,
    machines: state.machines,
    decor: state.decor,
    walls: state.walls,
    stains: state.stains,
    clients: state.clients,
  }
}

/** A newly unlocked storey starts as a clean base-size shell. */
export const emptyFloorPlan = (): FloorPlan => ({
  expansion: 0,
  machines: [],
  decor: [],
  walls: [],
  stains: [],
  clients: [],
})

/**
 * Updates the stored copy of the room the player is looking at. The engine
 * mutates the top-level mirror, so this seam is called before saving, changing
 * floors, and unlocking another one.
 */
export function snapshotActiveFloor(state: GameState): GameState {
  const plans = state.floorPlans.length > 0
    ? [...state.floorPlans]
    : [floorPlanFrom(state)]
  const active = Math.max(0, Math.min(plans.length - 1, state.activeFloor))
  plans[active] = floorPlanFrom(state)
  return { ...state, activeFloor: active, floorPlans: plans }
}

/** Current top-level mirror plus every inactive room, without double-counting. */
export function machinesAcrossFloors(state: GameState): Machine[] {
  return state.floorPlans.flatMap((plan, floor) => (
    floor === state.activeFloor ? state.machines : plan.machines
  ))
}

/** Used for global bookings such as checking whether a trainer is already busy. */
export function clientsAcrossFloors(state: GameState): Client[] {
  return state.floorPlans.flatMap((plan, floor) => (
    floor === state.activeFloor ? state.clients : plan.clients
  ))
}

/** The wall fixture appears only when the ground floor ladder is complete. */
export function floorAccessVisible(state: GameState): boolean {
  return state.floorPlans.length > 1 || (
    state.activeFloor === 0 && state.expansion >= MAX_EXPANSION
  )
}

export function canUnlockNextFloor(state: GameState): boolean {
  return (
    !state.gameOver &&
    state.activeFloor === 0 &&
    state.expansion >= MAX_EXPANSION &&
    state.floorPlans.length < MAX_FLOORS &&
    state.cash >= FLOOR_UNLOCK_COST
  )
}

/** Pays for the lock and adds one empty, independently stored room. */
export function unlockNextFloor(state: GameState): GameState {
  if (!canUnlockNextFloor(state)) return state

  const current = snapshotActiveFloor(state)
  return {
    ...current,
    cash: current.cash - FLOOR_UNLOCK_COST,
    floorPlans: [...current.floorPlans, emptyFloorPlan()],
    stats: {
      ...current.stats,
      totalSpent: current.stats.totalSpent + FLOOR_UNLOCK_COST,
    },
  }
}

export function canSwitchFloor(state: GameState, target: number): boolean {
  return (
    !state.gameOver &&
    Number.isInteger(target) &&
    target >= 0 &&
    target < state.floorPlans.length &&
    target !== state.activeFloor
  )
}

/**
 * Stores the room being left and loads the target into the engine's top-level
 * mirror. Visitors pause with their floor, including their machine booking;
 * hired staff are global, but their physical jobs are reset by the store after
 * the layout register has moved to the target room.
 */
export function switchActiveFloor(state: GameState, target: number): GameState {
  if (!canSwitchFloor(state, target)) return state

  const current = snapshotActiveFloor(state)
  const plan = current.floorPlans[target]!
  return {
    ...current,
    ...plan,
    activeFloor: target,
    staff: current.staff.map(member => ({
      ...member,
      targetUid: null,
      workMs: 0,
      path: [],
      goal: null,
    })),
  }
}
