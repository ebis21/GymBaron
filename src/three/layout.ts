import { GRID_H, GRID_W } from '../game/constants'

/** World units per grid tile. */
export const TILE = 2

/** The hall is wider than the equipment grid — the surplus is the entrance aisle. */
export const AISLE = 4
export const HALL_W = GRID_W * TILE + AISLE
export const HALL_D = GRID_H * TILE
export const WALL_H = 4.4

/** The grid sits right of centre, leaving the aisle clear on the left. */
export const GRID_OFFSET_X = AISLE / 2 - 0.2

/** How close the player must stand before an object becomes interactive. */
export const REACH = 2.4

/** Front of the queue, in the aisle by the door. */
export const DOOR_X = -HALL_W / 2 + 1.3

/**
 * Grid coordinates count from the top-left of the floor plan. The world is
 * centred on the origin, so the camera never has to compensate for an offset.
 */
export function tileToWorld(x: number, y: number): { x: number; z: number } {
  return {
    x: (x - (GRID_W - 1) / 2) * TILE + GRID_OFFSET_X,
    z: (y - (GRID_H - 1) / 2) * TILE,
  }
}

export function worldToTile(x: number, z: number): { x: number; y: number } {
  return {
    x: Math.round((x - GRID_OFFSET_X) / TILE + (GRID_W - 1) / 2),
    y: Math.round(z / TILE + (GRID_H - 1) / 2),
  }
}

export function insideGrid(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < GRID_W && y < GRID_H
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
export function queueSpot(index: number, anchor: QueueAnchor): { x: number; z: number } {
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

/** Clear space left around the hall when the build camera frames it. */
export const BUILD_MARGIN = 2.6

export interface Overhead {
  /** How high the camera must hang for the whole hall to fit on screen. */
  height: number
  /** Which world direction points up the screen, as a unit vector. */
  up: { x: number; z: number }
}

/**
 * Frames the whole room from directly above. On a portrait phone the hall is
 * turned a quarter turn so its long side runs down the screen: the room is
 * wider than it is deep, and framing it the other way up would leave it a
 * stripe across the middle with the rest of the display wasted.
 */
export function overheadFraming(fovDegrees: number, aspect: number): Overhead {
  const portrait = aspect < 1
  const half = Math.tan((fovDegrees * Math.PI) / 360)

  const down = portrait ? HALL_W : HALL_D
  const across = portrait ? HALL_D : HALL_W

  return {
    height: Math.max(
      (down + BUILD_MARGIN) / 2 / half,
      (across + BUILD_MARGIN) / 2 / (half * aspect),
    ),
    up: portrait ? { x: -1, z: 0 } : { x: 0, z: -1 },
  }
}
