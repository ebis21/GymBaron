import { GRID_H, GRID_W } from './constants'

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
export const HALL_W = GRID_W * TILE + AISLE
export const HALL_D = GRID_H * TILE

/** The grid sits right of centre, leaving the aisle clear on the left. */
export const GRID_OFFSET_X = AISLE / 2 - 0.2

/** Front of the queue, in the aisle by the door. */
export const DOOR_X = -HALL_W / 2 + 1.3

/**
 * Grid coordinates count from the top-left of the floor plan. The world is
 * centred on the origin, so the camera never has to compensate for an offset.
 */
export function tileToWorld(x: number, y: number): Point {
  return {
    x: (x - (GRID_W - 1) / 2) * TILE + GRID_OFFSET_X,
    z: (y - (GRID_H - 1) / 2) * TILE,
  }
}

export function worldToTile(x: number, z: number): Tile {
  return {
    x: Math.round((x - GRID_OFFSET_X) / TILE + (GRID_W - 1) / 2),
    y: Math.round(z / TILE + (GRID_H - 1) / 2),
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

/** Fallback formation used when no reception desk is placed. */
export const DOOR_QUEUE_ANCHOR: QueueAnchor = { x: DOOR_X, z: -2.4, angle: 0 }

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
