import type { GameState, Staff } from './types'
import type { Point, Tile } from './layout'
import { receptionStand, tileBehind, tileToWorld, worldToTile } from './layout'
import { findPath } from './pathfind'
import { stepAlongPath } from './walk'
import { speedFor } from './content/staff'
import { onDuty, restTileFor, targetTile } from './staff'

/**
 * Roles whose job sits on a tile that is itself occupied — a repairer works
 * on the broken machine's own tile, a cleaner wipes a stain that spawns on
 * whatever tile left it (almost always a machine tile), and a trainer boxed
 * out of every tile beside the kit ends up on the kit's tile with the client.
 * All three need `allowBlockedGoal`, or `findPath` treats the job as
 * unreachable and drops it the instant it's assigned.
 */
const BLOCKED_GOAL_ROLES = new Set<Staff['role']>(['repair', 'cleaner', 'trainer'])

const sameTile = (a: Tile, b: Tile): boolean => a.x === b.x && a.y === b.y

/**
 * Where in the goal tile somebody actually comes to rest. Everyone stops dead
 * centre except a receptionist working the attendant's side of their own desk,
 * who steps up to the counter instead of standing a full tile off it. The
 * offset stays inside the goal tile, so pathing is unaffected — only the last
 * stride changes. A receptionist sent to a fallback tile (a desk in the top
 * row, or one built into a corner) takes the tile centre like everyone else:
 * the counter offset only points at the tile behind the desk, and applying it
 * anywhere else would strand them outside the tile they walked to.
 */
function standPoint(state: GameState, s: Staff, goal: Tile, working: boolean): Point {
  if (s.role === 'reception' && working) {
    const desk = state.decor.find(d => d.uid === s.targetUid && d.type === 'reception')
    if (desk && sameTile(tileBehind(desk.x, desk.y, desk.rotation), goal)) {
      return receptionStand(desk.x, desk.y, desk.rotation)
    }
  }
  return tileToWorld(goal.x, goal.y)
}

/**
 * Walks the payroll one step. A job that turns out to be unreachable is
 * dropped rather than retried forever — the player is free to wall a corner
 * off, and an employee frozen against a partition would look like a bug and
 * quietly cost a day's wage. Whoever drops one heads for the aisle in the same
 * breath, so an impossible job never reads as a stuck employee.
 */
export function moveStaff(state: GameState, dtMs: number): GameState {
  if (state.staff.length === 0) return state

  let changed = false

  const staff = state.staff.map<Staff>(s => {
    // Nobody with unpaid wages is working, but they do not stand at their post
    // pretending to either: treating a striker as jobless walks them off to
    // the aisle, so a strike looks like a strike rather than a frozen frame.
    const job = onDuty(s) ? targetTile(state, s) : null

    /** One step toward `goal`, or null when there is no way through. */
    const walk = (goal: Tile, working: boolean, drop: boolean): Staff | null => {
      const end = standPoint(state, s, goal, working)
      const cleared = drop ? { targetUid: null, workMs: 0 } : {}

      // Standing on the spot already: nothing to do, and no needless re-planning.
      if (Math.hypot(s.x - end.x, s.z - end.z) < 1e-6) {
        if (!drop && s.path.length === 0 && s.goal && sameTile(s.goal, goal)) return s
        changed = true
        return { ...s, ...cleared, path: [], goal }
      }

      let path = s.path
      if (!s.goal || !sameTile(s.goal, goal)) {
        // A repairer stands on the machine's own tile, and a cleaner's stain
        // sits on whatever tile left it — both goals are blocked for everyone
        // walking past but legal for the one doing the job.
        const found = findPath(state, worldToTile(s.x, s.z), goal, {
          allowBlockedGoal: BLOCKED_GOAL_ROLES.has(s.role) && working,
        })
        if (!found) return null
        path = found
      }

      const step = stepAlongPath(s, path, end, speedFor(s.rank), dtMs)
      changed = true
      return { ...s, ...cleared, x: step.pos.x, z: step.pos.z, path: step.path, goal }
    }

    if (job) {
      const toward = walk(job, true, false)
      if (toward) return toward
    }

    // Either idle, on strike, or holding a job nothing can reach. The aisle
    // is walkable by construction, so this practically always finds a way.
    const stoodDown = walk(restTileFor(state, s), false, job !== null)
    if (stoodDown) return stoodDown

    if (s.targetUid === null && s.path.length === 0) return s
    changed = true
    return { ...s, targetUid: null, workMs: 0, path: [], goal: null }
  })

  return changed ? { ...state, staff } : state
}
