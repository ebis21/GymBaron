import type { GameState } from './types'
import type { Tile } from './layout'
import { gridH, gridW } from './layout'
import { tileOccupant, wallAt } from './build'

/**
 * The hall is wider than the equipment grid; the surplus on the left is the
 * entrance aisle, exactly two tile columns of it. Nothing can ever be built
 * there — `build.ts` rejects negative x — so the aisle is walkable by
 * construction and always offers a way around a blocked room.
 *
 * The aisle is the one part of the floor plan an expansion does *not* change:
 * the door stays where it is and the room grows away from it, so this stays a
 * constant while the far edge moves.
 */
export const WALK_MIN_X = -2

export function walkable(state: GameState, x: number, y: number): boolean {
  if (!Number.isInteger(x) || !Number.isInteger(y)) return false
  if (y < 0 || y >= gridH()) return false
  if (x < WALK_MIN_X || x >= gridW()) return false
  if (x < 0) return true
  return tileOccupant(state, x, y) === null
}

/**
 * True when a wall stands on the shared edge of two neighbouring tiles. Edges
 * have one canonical name — the north or west edge of the tile they touch —
 * so a step south is asked about as the north edge of the tile below.
 */
function wallBetween(state: GameState, from: Tile, to: Tile): boolean {
  if (to.y < from.y) return wallAt(state, from.x, from.y, 'n') !== null
  if (to.y > from.y) return wallAt(state, from.x, to.y, 'n') !== null
  if (to.x < from.x) return wallAt(state, from.x, from.y, 'w') !== null
  return wallAt(state, to.x, from.y, 'w') !== null
}

/**
 * Fixed order, deliberately. A* ties are broken by the order neighbours are
 * pushed, so a stable order is what makes the same query always return the
 * same path — and the seed the only source of variation in the whole engine.
 */
const STEPS: Tile[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
]

const key = (t: Tile) => `${t.x},${t.y}`
const same = (a: Tile, b: Tile) => a.x === b.x && a.y === b.y

/**
 * A* over the 60 walkable tiles, four-directional. Diagonals are left out on
 * purpose: cutting a corner would take a walker straight through the end of a
 * wall.
 *
 * The returned path excludes the starting tile and ends on the goal. `null`
 * means the goal cannot be reached — a legitimate outcome, since the player is
 * free to wall a corner off, and every caller has to handle it.
 *
 * `allowBlockedGoal` covers standing *on* an occupied tile: a client using a
 * machine and a repairer working on one both end up there, even though the
 * tile is impassable for everyone walking past.
 */
export function findPath(
  state: GameState,
  from: Tile,
  to: Tile,
  opts: { allowBlockedGoal?: boolean } = {},
): Tile[] | null {
  const goalOk = opts.allowBlockedGoal === true
  if (!walkable(state, to.x, to.y) && !goalOk) return null
  if (same(from, to)) return []

  const cameFrom = new Map<string, Tile>()
  const cost = new Map<string, number>([[key(from), 0]])
  const open: Tile[] = [from]
  const heuristic = (t: Tile) => Math.abs(t.x - to.x) + Math.abs(t.y - to.y)

  while (open.length > 0) {
    let bestAt = 0
    let bestScore = cost.get(key(open[0]!))! + heuristic(open[0]!)
    for (let i = 1; i < open.length; i += 1) {
      const score = cost.get(key(open[i]!))! + heuristic(open[i]!)
      if (score < bestScore) {
        bestScore = score
        bestAt = i
      }
    }

    const current = open.splice(bestAt, 1)[0]!
    if (same(current, to)) {
      const path: Tile[] = []
      let node = current
      while (!same(node, from)) {
        path.unshift(node)
        node = cameFrom.get(key(node))!
      }
      return path
    }

    for (const step of STEPS) {
      const next: Tile = { x: current.x + step.x, y: current.y + step.y }
      const isGoal = same(next, to)
      if (!walkable(state, next.x, next.y) && !(isGoal && goalOk)) continue
      if (wallBetween(state, current, next)) continue

      const nextCost = cost.get(key(current))! + 1
      const known = cost.get(key(next))
      if (known !== undefined && known <= nextCost) continue

      cost.set(key(next), nextCost)
      cameFrom.set(key(next), current)
      if (!open.some(t => same(t, next))) open.push(next)
    }
  }

  return null
}
