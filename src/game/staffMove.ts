import type { GameState, Staff } from './types'
import type { Point, Tile } from './layout'
import { receptionStand, tileToWorld, worldToTile } from './layout'
import { findPath } from './pathfind'
import { stepAlongPath } from './walk'
import { speedFor } from './content/staff'
import { onDuty, restTileFor, targetTile } from './staff'

/**
 * Roles whose job sits on a tile that is itself occupied — a repairer works
 * on the broken machine's own tile, a cleaner wipes a stain that spawns on
 * whatever tile left it (almost always a machine tile). Both need
 * `allowBlockedGoal`, or `findPath` treats the job as unreachable and drops
 * it the instant it's assigned.
 */
const BLOCKED_GOAL_ROLES = new Set<Staff['role']>(['repair', 'cleaner'])

/**
 * Where in the goal tile somebody actually comes to rest. Everyone stops dead
 * centre except a receptionist on duty, who steps up to the counter instead of
 * standing a full tile off it. The offset stays inside the goal tile, so
 * pathing is unaffected — only the last stride changes.
 */
function standPoint(state: GameState, s: Staff, goal: Tile, working: boolean): Point {
  if (s.role === 'reception' && working) {
    const desk = state.decor.find(d => d.type === 'reception')
    if (desk) return receptionStand(desk.x, desk.y, desk.rotation)
  }
  return tileToWorld(goal.x, goal.y)
}

/**
 * Walks the payroll one step. A job that turns out to be unreachable is
 * dropped rather than retried forever — the player is free to wall a corner
 * off, and an employee frozen against a partition would look like a bug and
 * quietly cost a day's wage.
 */
export function moveStaff(state: GameState, dtMs: number): GameState {
  if (state.staff.length === 0) return state

  let changed = false

  const staff = state.staff.map<Staff>(s => {
    if (!onDuty(s)) return s

    const job = targetTile(state, s)
    const goal = job ?? restTileFor(state, s)
    const end = standPoint(state, s, goal, job !== null)

    // Standing on the spot already: nothing to do, and no needless re-planning.
    if (Math.hypot(s.x - end.x, s.z - end.z) < 1e-6) {
      if (s.path.length === 0 && s.goal && s.goal.x === goal.x && s.goal.y === goal.y) return s
      changed = true
      return { ...s, path: [], goal }
    }

    let path = s.path
    if (!s.goal || s.goal.x !== goal.x || s.goal.y !== goal.y) {
      // A repairer stands on the machine's own tile, and a cleaner's stain
      // sits on whatever tile left it — both goals are blocked for everyone
      // walking past but legal for the one doing the job.
      const found = findPath(state, worldToTile(s.x, s.z), goal, {
        allowBlockedGoal: BLOCKED_GOAL_ROLES.has(s.role) && job !== null,
      })

      if (!found) {
        if (s.targetUid === null) return s
        changed = true
        return { ...s, targetUid: null, workMs: 0, path: [], goal: null }
      }
      path = found
    }

    const step = stepAlongPath(s, path, end, speedFor(s.rank), dtMs)
    changed = true
    return { ...s, x: step.pos.x, z: step.pos.z, path: step.path, goal }
  })

  return changed ? { ...state, staff } : state
}
