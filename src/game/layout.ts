import { GRID_H, GRID_W } from './constants'
import { expansionAt } from './content/expansion'
import type { GameState } from './types'

/** Kafelek siatki. Ujemne x to nawa wejściowa poza siatką sprzętu. */
export interface Tile {
  x: number
  y: number
}

/** Punkt na podłodze w jednostkach świata. Y pomijamy — nikt nie lata. */
export interface Point {
  x: number
  z: number
}

/** World units per grid tile. */
export const TILE = 2

/** The hall is wider than the equipment grid — the surplus is the entrance aisle. */
export const AISLE = 4

/**
 * The room the game ships with, and the size every one of these helpers
 * reports until something tells it otherwise. Exported as plain constants
 * because a handful of call sites (and a handful of tests) only ever care
 * about the starting hall — everything that has to survive an expansion reads
 * the accessors below instead.
 */
export const HALL_W = GRID_W * TILE + AISLE
export const HALL_D = GRID_H * TILE

/** The grid sits right of centre, leaving the aisle clear on the left. */
export const GRID_OFFSET_X = AISLE / 2 - 0.2

/** Front of the queue, in the aisle by the door, in the *base* room. */
export const DOOR_X = -HALL_W / 2 + 1.3

// --- the current room --------------------------------------------------------

/**
 * Deliberate module state. The room's size is a property of the save, but
 * `tileToWorld` and friends are pure two-argument functions called from some
 * thirty places across the engine, the renderer and the tests — threading a
 * `GameState` through every one of them would turn a geometry helper into a
 * parameter of half the codebase for no gain, since there is only ever one gym
 * on screen at a time.
 *
 * So the size lives here, in one register, and `syncRoomSize` is the single
 * seam that writes it. It defaults to the base room, which means anything that
 * never calls `syncRoomSize` — every existing test, every early-boot path —
 * behaves exactly as it did before expansions existed.
 */
let roomW = GRID_W
let roomH = GRID_H

/**
 * Points the geometry helpers at the room the given save is actually in.
 * Idempotent and cheap by design: call it at the top of every tick, on load,
 * and before the renderer rebuilds — never guess whether it is needed.
 */
export function syncRoomSize(state: GameState): void {
  const room = expansionAt(state.expansion)
  roomW = room.w
  roomH = room.h
}

/** Equipment-grid width of the current room, in tiles. */
export const gridW = (): number => roomW
/** Equipment-grid depth of the current room, in tiles. */
export const gridH = (): number => roomH
/** Hall width in world units — the grid plus the entrance aisle. */
export const hallW = (): number => roomW * TILE + AISLE
/** Hall depth in world units. */
export const hallD = (): number => roomH * TILE
/** Front of the queue, in the aisle by the door, in the current room. */
export const doorX = (): number => -hallW() / 2 + 1.3

/**
 * Tile columns of aisle left of the equipment grid. Derived rather than
 * written down twice — `pathfind.WALK_MIN_X` is the same number negated.
 */
export const AISLE_COLUMNS = AISLE / TILE

/**
 * How deep the staff room runs into the back of the aisle. Six tiles at two
 * columns wide, against a payroll capped at five, so everybody off shift has
 * their own spot and nobody is left loitering in the queue.
 */
export const STAFF_ROOM_DEPTH = 3

/**
 * Where off-shift staff wait: the back of the entrance aisle, behind its own
 * door, as far from the front counter as the room allows. They used to rest
 * at the head of the aisle — which is exactly where the queue forms — so an
 * idle cleaner was indistinguishable from a client waiting to be served.
 *
 * Ordered back-to-front, so the first person off shift takes the deepest spot
 * and the room fills away from the floor rather than toward it.
 */
export function staffRoomTiles(): Tile[] {
  const tiles: Tile[] = []
  const backmost = gridH() - 1
  const frontmost = Math.max(0, gridH() - STAFF_ROOM_DEPTH)

  for (let y = backmost; y >= frontmost; y -= 1) {
    for (let x = -1; x >= -AISLE_COLUMNS; x -= 1) tiles.push({ x, y })
  }
  return tiles
}

/**
 * Whether a world position is inside the staff room. The room is walled off,
 * so anybody standing in there is behind the partition as far as the player is
 * concerned — which is what the renderer uses this for.
 */
export function isInStaffRoom(x: number, z: number): boolean {
  const t = worldToTile(x, z)
  return staffRoomTiles().some(r => r.x === t.x && r.y === t.y)
}

/** Centre of the staff room in world units, for drawing its floor and door. */
export function staffRoomCentre(): Point {
  const tiles = staffRoomTiles()
  const first = tileToWorld(tiles[0]!.x, tiles[0]!.y)
  const last = tileToWorld(tiles[tiles.length - 1]!.x, tiles[tiles.length - 1]!.y)
  return { x: (first.x + last.x) / 2, z: (first.z + last.z) / 2 }
}

/**
 * Grid coordinates count from the top-left of the floor plan. The world is
 * centred on the origin, so the camera never has to compensate for an offset —
 * and when the room grows, everything already placed keeps its tile and the
 * whole floor plan re-centres around it.
 */
export function tileToWorld(x: number, y: number): Point {
  return {
    x: (x - (roomW - 1) / 2) * TILE + GRID_OFFSET_X,
    z: (y - (roomH - 1) / 2) * TILE,
  }
}

export function worldToTile(x: number, z: number): Tile {
  return {
    x: Math.round((x - GRID_OFFSET_X) / TILE + (roomW - 1) / 2),
    y: Math.round(z / TILE + (roomH - 1) / 2),
  }
}

/** World position and facing of the desk clients queue in front of. */
export interface QueueAnchor {
  x: number
  z: number
  /** Radians around Y; the direction the queue trails away from the desk. */
  angle: number
}

/**
 * Where the nth person in line stands, fanned out in front of the reception
 * desk rather than parked in a fixed spot the room's layout has no say in.
 * Two short columns rather than one long line, so a full queue stays
 * readable, and the whole formation rotates with the desk.
 */
export function queueSpot(index: number, anchor: QueueAnchor): Point {
  const column = Math.floor(index / 5)
  const row = index % 5

  // Local space before rotation: queue trails back along +Z from the desk's
  // front edge, columns fan out along local X.
  const localX = (column - 0.5) * 1.15
  const localZ = TILE * 0.85 + row * 1.2

  const sin = Math.sin(anchor.angle)
  const cos = Math.cos(anchor.angle)
  return {
    x: anchor.x + localX * cos + localZ * sin,
    z: anchor.z - localX * sin + localZ * cos,
  }
}

/**
 * How far up the hall the door-side queue forms when there is no desk to form
 * in front of. A fixed world offset rather than a fraction of the room: the
 * door is in the same corner however big the gym gets.
 */
export const DOOR_QUEUE_Z = -2.4

/**
 * Fallback formation used when no reception desk is placed — the *base* room's
 * one. Kept as a const because several callers still import it directly; use
 * `doorQueueAnchor()` instead anywhere the room can have grown.
 */
export const DOOR_QUEUE_ANCHOR: QueueAnchor = { x: DOOR_X, z: DOOR_QUEUE_Z, angle: 0 }

/** The same fallback formation, placed in whatever room is current. */
export const doorQueueAnchor = (): QueueAnchor => ({ x: doorX(), z: DOOR_QUEUE_Z, angle: 0 })

/**
 * The tile immediately behind a rotatable fixture — the side opposite
 * wherever it faces. `rotation` follows the same quarter-turn convention as
 * `Decor.rotation` (and `QueueAnchor.angle = rotation * PI/2`): at rotation 0
 * the fixture's front faces local +Z, so "behind" is one tile toward -Z, and
 * the offset rotates the same way as everything else built on that angle.
 * Used to stand the receptionist on the attendant's side of the desk, facing
 * back across it into the queue.
 */
export function tileBehind(x: number, y: number, rotation: number): Tile {
  const angle = (rotation * Math.PI) / 2
  return {
    x: x + Math.round(-Math.sin(angle)),
    y: y + Math.round(-Math.cos(angle)),
  }
}

/**
 * How far behind the desk's centre the attendant actually stands. A full tile
 * step (TILE = 2) parked them a clear pace off the counter, looking like they
 * had wandered away from it; just past the tile edge reads as standing at the
 * desk while still leaving the desk's own tile free.
 */
export const DESK_STAND_DIST = 1.2

/**
 * Where the receptionist stands to work: on the attendant's side of the desk,
 * pulled in close to the counter. Sits inside `tileBehind`'s tile, so the
 * pathfinder still routes to a whole tile and only the final step is offset.
 */
export function receptionStand(x: number, y: number, rotation: number): Point {
  const angle = (rotation * Math.PI) / 2
  const at = tileToWorld(x, y)
  return {
    x: at.x - Math.sin(angle) * DESK_STAND_DIST,
    z: at.z - Math.cos(angle) * DESK_STAND_DIST,
  }
}
