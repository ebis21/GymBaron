import type {
  Decor,
  DecorTypeId,
  GameState,
  InventoryItem,
  Machine,
  MachineTypeId,
  Rotation,
  WallSide,
} from './types'
import { gridH, gridW } from './layout'

export type PlacedKind = 'machine' | 'decor'

export interface Occupant {
  kind: PlacedKind
  uid: string
}

export const nextRotation = (r: Rotation): Rotation => (((r + 1) % 4) as Rotation)

/** Within the buildable floor of whatever room the player has bought so far. */
export function insideGrid(x: number, y: number): boolean {
  return (
    Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < gridW() && y < gridH()
  )
}

/**
 * What is standing on a tile, if anything. Machines and decor share the floor
 * plan, so one lookup answers for both and nothing can ever be stacked.
 */
export function tileOccupant(state: GameState, x: number, y: number): Occupant | null {
  const machine = state.machines.find(m => m.x === x && m.y === y)
  if (machine) return { kind: 'machine', uid: machine.uid }

  const decor = state.decor.find(d => d.x === x && d.y === y)
  if (decor) return { kind: 'decor', uid: decor.uid }

  return null
}

export const tileFree = (state: GameState, x: number, y: number): boolean =>
  insideGrid(x, y) && tileOccupant(state, x, y) === null

/**
 * Every edge has exactly one name: the north and west edges of the tile it
 * touches. Asking for a south or east edge resolves to the neighbour, which is
 * what stops the same wall being built twice from opposite sides.
 */
export function canonicalEdge(
  x: number,
  y: number,
  side: 'n' | 's' | 'e' | 'w',
): { x: number; y: number; side: WallSide } {
  if (side === 's') return { x, y: y + 1, side: 'n' }
  if (side === 'e') return { x: x + 1, y, side: 'w' }
  return { x, y, side }
}

export const wallAt = (state: GameState, x: number, y: number, side: WallSide) =>
  state.walls.find(w => w.x === x && w.y === y && w.side === side) ?? null

// --- inventory --------------------------------------------------------------

type NewItem =
  | { kind: 'machine'; type: MachineTypeId; durability?: number }
  | { kind: 'decor'; type: DecorTypeId }
  | { kind: 'wall' }

/** Buying puts things in the bag; placing them is a separate decision. */
export function addToInventory(state: GameState, item: NewItem): GameState {
  const uid = `i${state.nextUid}`

  const entry: InventoryItem =
    item.kind === 'machine'
      ? { uid, kind: 'machine', type: item.type, durability: item.durability ?? 100 }
      : item.kind === 'decor'
        ? { uid, kind: 'decor', type: item.type }
        : { uid, kind: 'wall' }

  return { ...state, nextUid: state.nextUid + 1, inventory: [...state.inventory, entry] }
}

const withoutItem = (state: GameState, itemUid: string) =>
  state.inventory.filter(i => i.uid !== itemUid)

// --- placing ----------------------------------------------------------------

/**
 * Takes a machine or a piece of decor out of the bag and stands it on a tile.
 * A blocked or off-grid tile changes nothing, so the caller can offer every
 * tile and let this decide.
 */
export function placeFromInventory(
  state: GameState,
  itemUid: string,
  x: number,
  y: number,
  rotation: Rotation = 0,
): GameState {
  const item = state.inventory.find(i => i.uid === itemUid)
  if (!item || item.kind === 'wall') return state
  if (!tileFree(state, x, y)) return state

  const uid = `${item.kind === 'machine' ? 'm' : 'd'}${state.nextUid}`
  const base = { ...state, nextUid: state.nextUid + 1, inventory: withoutItem(state, itemUid) }

  if (item.kind === 'machine') {
    const machine: Machine = {
      uid,
      type: item.type,
      x,
      y,
      rotation,
      durability: item.durability,
      occupiedBy: null,
      brokenMs: 0,
    }
    return { ...base, machines: [...base.machines, machine] }
  }

  const decor: Decor = { uid, type: item.type, x, y, rotation }
  return { ...base, decor: [...base.decor, decor] }
}

export function placeWall(
  state: GameState,
  itemUid: string,
  x: number,
  y: number,
  side: 'n' | 's' | 'e' | 'w',
): GameState {
  const item = state.inventory.find(i => i.uid === itemUid)
  if (!item || item.kind !== 'wall') return state
  if (!insideGrid(x, y)) return state

  const edge = canonicalEdge(x, y, side)
  if (wallAt(state, edge.x, edge.y, edge.side)) return state

  return {
    ...state,
    nextUid: state.nextUid + 1,
    inventory: withoutItem(state, itemUid),
    walls: [...state.walls, { uid: `w${state.nextUid}`, ...edge }],
  }
}

// --- editing what is already down -------------------------------------------

/**
 * Back into the bag. A machine with someone training on it stays put — pulling
 * the bench out from under a client would strand them mid-workout.
 */
export function storePlaced(state: GameState, kind: PlacedKind, uid: string): GameState {
  if (kind === 'decor') {
    const decor = state.decor.find(d => d.uid === uid)
    if (!decor) return state
    return addToInventory(
      { ...state, decor: state.decor.filter(d => d.uid !== uid) },
      { kind: 'decor', type: decor.type },
    )
  }

  const machine = state.machines.find(m => m.uid === uid)
  if (!machine || machine.occupiedBy !== null) return state

  return addToInventory(
    { ...state, machines: state.machines.filter(m => m.uid !== uid) },
    { kind: 'machine', type: machine.type, durability: machine.durability },
  )
}

/**
 * Slides a partition onto another edge. Going through the bag would work too,
 * but a wall the player is repositioning should never be at risk of getting
 * lost among a dozen identical spare ones.
 */
export function moveWall(
  state: GameState,
  uid: string,
  x: number,
  y: number,
  side: 'n' | 's' | 'e' | 'w',
): GameState {
  if (!state.walls.some(w => w.uid === uid)) return state
  if (!insideGrid(x, y)) return state

  const edge = canonicalEdge(x, y, side)

  // Landing back on its own edge, or on one already taken, changes nothing.
  if (wallAt(state, edge.x, edge.y, edge.side)) return state

  return { ...state, walls: state.walls.map(w => (w.uid === uid ? { uid, ...edge } : w)) }
}

export function removeWall(state: GameState, uid: string): GameState {
  if (!state.walls.some(w => w.uid === uid)) return state
  return addToInventory(
    { ...state, walls: state.walls.filter(w => w.uid !== uid) },
    { kind: 'wall' },
  )
}

export function rotatePlaced(state: GameState, kind: PlacedKind, uid: string): GameState {
  if (kind === 'machine') {
    if (!state.machines.some(m => m.uid === uid)) return state
    return {
      ...state,
      machines: state.machines.map(m =>
        m.uid === uid ? { ...m, rotation: nextRotation(m.rotation) } : m,
      ),
    }
  }

  if (!state.decor.some(d => d.uid === uid)) return state
  return {
    ...state,
    decor: state.decor.map(d => (d.uid === uid ? { ...d, rotation: nextRotation(d.rotation) } : d)),
  }
}

/**
 * Slides something to another tile without a trip through the bag, so a
 * machine keeps its wear and whoever is training on it comes along.
 */
export function movePlaced(
  state: GameState,
  kind: PlacedKind,
  uid: string,
  x: number,
  y: number,
): GameState {
  if (!insideGrid(x, y)) return state

  // Landing back on its own tile is a no-op rather than a failure.
  const occupant = tileOccupant(state, x, y)
  if (occupant && occupant.uid !== uid) return state

  if (kind === 'machine') {
    if (!state.machines.some(m => m.uid === uid)) return state
    return { ...state, machines: state.machines.map(m => (m.uid === uid ? { ...m, x, y } : m)) }
  }

  if (!state.decor.some(d => d.uid === uid)) return state
  return { ...state, decor: state.decor.map(d => (d.uid === uid ? { ...d, x, y } : d)) }
}
