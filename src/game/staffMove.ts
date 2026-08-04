import type { GameState, Staff } from './types'
import { tileToWorld, worldToTile } from './layout'
import { findPath } from './pathfind'
import { stepAlongPath } from './walk'
import { speedFor } from './content/staff'
import { onDuty, restTileFor, targetTile } from './staff'

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
    const end = tileToWorld(goal.x, goal.y)

    // Standing on the spot already: nothing to do, and no needless re-planning.
    if (Math.hypot(s.x - end.x, s.z - end.z) < 1e-6) {
      if (s.path.length === 0 && s.goal && s.goal.x === goal.x && s.goal.y === goal.y) return s
      changed = true
      return { ...s, path: [], goal }
    }

    let path = s.path
    if (!s.goal || s.goal.x !== goal.x || s.goal.y !== goal.y) {
      // A repairer stands on the machine's own tile, so its goal is blocked
      // for everyone walking past but legal for them.
      const found = findPath(state, worldToTile(s.x, s.z), goal, {
        allowBlockedGoal: s.role === 'repair' && job !== null,
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
