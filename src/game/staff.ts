import type { GameState, Staff } from './types'
import type { Tile } from './layout'
import { tileToWorld, worldToTile } from './layout'
import { wipeStain } from './stains'
import { scanClient } from './clients'
import { workMsFor, STAFF_LIMIT } from './content/staff'
import { WALK_MIN_X } from './pathfind'

/** How close somebody must be standing to actually do the job. */
const WORK_REACH = 1.6

/** An employee with unpaid wages stays on the books but stops turning up. */
export const onDuty = (s: Staff): boolean => s.owed <= 0

/**
 * Idle staff wait in the entrance aisle rather than in a doorway. Nothing can
 * be built at negative x, so these tiles are guaranteed clear — and there are
 * twelve of them against a payroll capped at five.
 */
export function restTileFor(state: GameState, self: Staff): Tile {
  const taken = new Set(
    state.staff
      .filter(s => s.uid !== self.uid)
      .map(s => {
        const t = worldToTile(s.x, s.z)
        return `${t.x},${t.y}`
      }),
  )

  for (let x = -1; x >= WALK_MIN_X; x -= 1) {
    for (let y = 0; y < 6; y += 1) {
      if (!taken.has(`${x},${y}`)) return { x, y }
    }
  }
  return { x: -1, y: 0 }
}

/** Tile an employee's current job sits on, or null when they have no job. */
export function targetTile(state: GameState, s: Staff): Tile | null {
  if (!s.targetUid) return null

  if (s.role === 'cleaner') {
    const stain = state.stains.find(x => x.uid === s.targetUid)
    return stain ? { x: stain.x, y: stain.y } : null
  }

  if (s.role === 'repair') {
    const m = state.machines.find(x => x.uid === s.targetUid)
    return m ? { x: m.x, y: m.y } : null
  }

  const desk = state.decor.find(d => d.type === 'reception')
  return desk ? { x: desk.x, y: desk.y } : null
}

/**
 * Hands out jobs. Cleaners take the oldest stain rather than the closest one,
 * because a stale stain costs double — chasing the nearest mess would let the
 * expensive one rot. Two people are never sent to the same job.
 */
export function assignStaff(state: GameState): GameState {
  if (state.staff.length === 0) return state

  const claimed = new Set<string>()
  let changed = false

  const staff = state.staff.map(s => {
    if (!onDuty(s)) {
      if (s.targetUid === null) return s
      changed = true
      return { ...s, targetUid: null, workMs: 0 }
    }

    // Keep a job that is still real, so nobody abandons work half-done.
    if (s.targetUid && targetTile(state, s) && !claimed.has(s.targetUid)) {
      claimed.add(s.targetUid)
      return s
    }

    const next = pickJob(state, s, claimed)
    if (next === s.targetUid) return s

    changed = true
    if (next) claimed.add(next)
    return { ...s, targetUid: next, workMs: 0 }
  })

  return changed ? { ...state, staff } : state
}

function pickJob(state: GameState, s: Staff, claimed: Set<string>): string | null {
  if (s.role === 'cleaner') {
    const oldest = state.stains
      .filter(x => !claimed.has(x.uid))
      .reduce<null | { uid: string; ageMs: number }>(
        (best, x) => (best === null || x.ageMs > best.ageMs ? x : best),
        null,
      )
    return oldest ? oldest.uid : null
  }

  if (s.role === 'repair') {
    const broken = state.machines.find(m => m.durability <= 0 && !claimed.has(m.uid))
    return broken ? broken.uid : null
  }

  const desk = state.decor.find(d => d.type === 'reception')
  return desk ? desk.uid : null
}

const nearEnough = (s: Staff, tile: Tile): boolean => {
  const at = tileToWorld(tile.x, tile.y)
  return Math.hypot(s.x - at.x, s.z - at.z) <= WORK_REACH
}

/**
 * Runs the clock on whoever is standing at their job. The receptionist is the
 * odd one out: rather than finishing a task, they scan the head of the queue
 * every `workMs`, calling exactly the same function the player's own tap does.
 */
export function workStaff(state: GameState, dtMs: number): GameState {
  if (state.staff.length === 0) return state

  let next = state
  let changed = false
  const progressed = new Map<string, number>()

  for (const s of state.staff) {
    if (!onDuty(s) || !s.targetUid) continue

    const tile = targetTile(next, s)
    if (!tile || !nearEnough(s, tile)) continue

    const workMs = s.workMs + dtMs
    const needed = workMsFor(s.role, s.rank)

    if (workMs < needed) {
      progressed.set(s.uid, workMs)
      changed = true
      continue
    }

    progressed.set(s.uid, 0)
    changed = true

    if (s.role === 'cleaner') {
      next = wipeStain(next, s.targetUid)
      continue
    }

    if (s.role === 'repair') {
      // The wage is the payment for this work; no repair bill on top.
      next = {
        ...next,
        machines: next.machines.map(m =>
          m.uid === s.targetUid ? { ...m, durability: 100 } : m,
        ),
      }
      continue
    }

    const waiting = next.clients.find(c => c.phase === 'queue')
    if (waiting) next = scanClient(next, waiting.uid)
  }

  if (!changed) return state

  return {
    ...next,
    staff: next.staff.map(s =>
      progressed.has(s.uid) ? { ...s, workMs: progressed.get(s.uid)! } : s,
    ),
  }
}

/** Takes a candidate off the board and onto the payroll. */
export function hire(state: GameState, candidateUid: string): GameState {
  const candidate = state.candidates.find(c => c.uid === candidateUid)
  if (!candidate) return state
  if (state.staff.length >= STAFF_LIMIT) return state
  if (candidate.role === 'reception' && !state.decor.some(d => d.type === 'reception')) return state

  const rest = { x: -1, y: 0 }
  const at = tileToWorld(rest.x, rest.y)

  const employee: Staff = {
    uid: `e${state.nextUid}`,
    name: candidate.name,
    role: candidate.role,
    rank: candidate.rank,
    x: at.x,
    z: at.z,
    path: [],
    goal: null,
    targetUid: null,
    workMs: 0,
    owed: 0,
  }

  return {
    ...state,
    nextUid: state.nextUid + 1,
    staff: [...state.staff, employee],
    candidates: state.candidates.filter(c => c.uid !== candidateUid),
  }
}

/**
 * Letting somebody go is free and immediate — unless they are owed wages.
 * Without that catch a strike would cost nothing: sack the unpaid, hire
 * replacements, never settle the debt.
 */
export function fire(state: GameState, staffUid: string): GameState {
  const employee = state.staff.find(s => s.uid === staffUid)
  if (!employee || employee.owed > 0) return state
  return { ...state, staff: state.staff.filter(s => s.uid !== staffUid) }
}

export function payArrears(state: GameState, staffUid: string): GameState {
  const employee = state.staff.find(s => s.uid === staffUid)
  if (!employee || employee.owed <= 0 || state.cash < employee.owed) return state

  return {
    ...state,
    cash: state.cash - employee.owed,
    staff: state.staff.map(s => (s.uid === staffUid ? { ...s, owed: 0 } : s)),
    stats: { ...state.stats, totalSpent: state.stats.totalSpent + employee.owed },
  }
}
