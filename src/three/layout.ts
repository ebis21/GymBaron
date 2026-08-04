export {
  TILE,
  AISLE,
  HALL_W,
  HALL_D,
  GRID_OFFSET_X,
  DOOR_X,
  DOOR_QUEUE_ANCHOR,
  tileToWorld,
  worldToTile,
  queueSpot,
} from '../game/layout'
export type { Point, Tile, QueueAnchor } from '../game/layout'

import { GRID_H, GRID_W } from '../game/constants'
import { HALL_W, HALL_D } from '../game/layout'

export const WALL_H = 4.4

/** How close the player must stand before an object becomes interactive. */
export const REACH = 2.4

export function insideGrid(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < GRID_W && y < GRID_H
}

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
