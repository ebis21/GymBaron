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

/**
 * Where the nth person in the queue stands. Two short columns rather than one
 * long line, so a full queue still fits in the aisle and stays readable.
 */
export function queueSpot(index: number): { x: number; z: number } {
  const column = Math.floor(index / 5)
  const row = index % 5
  return { x: DOOR_X + column * 1.15, z: -2.4 + row * 1.2 }
}
