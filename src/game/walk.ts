import type { Point, Tile } from './layout'
import { tileToWorld } from './layout'

export interface WalkResult {
  pos: Point
  /** What is left of the path. Waypoints already reached are gone. */
  path: Tile[]
  /** True once the walker is standing on `end`. */
  arrived: boolean
}

/**
 * Moves a walker along its tile path and then straight to `end`.
 *
 * The whole distance budget is spent, crossing as many waypoints as it
 * reaches, which is what keeps movement independent of the size of `dtMs`.
 * Crucially, this is also why nobody ever walks through a wall: travel only
 * ever follows the path, and the path only ever uses legal graph edges. A
 * legendary employee covers 3 units a second, so a single MAX_STEP_MS slice is
 * a tile and a half — relying on small time steps to stop wall-crossing would
 * be wishful thinking.
 *
 * `end` exists because not every destination is a tile centre: a spot in the
 * queue is computed in world units against the rotated reception desk. Within
 * one tile there are no obstacles, so the final straight leg is safe.
 */
export function stepAlongPath(
  from: Point,
  path: Tile[],
  end: Point,
  speed: number,
  dtMs: number,
): WalkResult {
  let budget = (speed * dtMs) / 1000
  let pos: Point = { x: from.x, z: from.z }
  let rest = path

  if (budget <= 0) {
    return { pos: from, path: rest, arrived: rest.length === 0 && reached(from, end) }
  }

  while (budget > 0) {
    const next = rest[0]
    const target: Point = next ? tileToWorld(next.x, next.y) : end

    const dx = target.x - pos.x
    const dz = target.z - pos.z
    const dist = Math.hypot(dx, dz)

    if (dist > budget) {
      pos = { x: pos.x + (dx / dist) * budget, z: pos.z + (dz / dist) * budget }
      return { pos, path: rest, arrived: false }
    }

    pos = { x: target.x, z: target.z }
    budget -= dist

    if (!next) return { pos, path: rest, arrived: true }
    rest = rest.slice(1)
  }

  return { pos, path: rest, arrived: rest.length === 0 && reached(pos, end) }
}

const reached = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z) < 1e-6
