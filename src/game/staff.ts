import type { Client, Decor, GameState, Machine, Staff } from './types'
import type { Tile } from './layout'
import { gridH, tileBehind, tileToWorld, worldToTile } from './layout'
import { wipeStain } from './stains'
import { scanClient } from './clients'
import { workMsFor, STAFF_LIMIT, roleUnlockLevel } from './content/staff'
import { WALK_MIN_X, walkable } from './pathfind'

/** How close somebody must be standing to actually do the job. */
const WORK_REACH = 1.6

/** Out of service, and so worth a repairer walking over to. */
export const needsRepair = (m: Machine): boolean => m.durability <= 0

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

  // The aisle runs the full depth of whatever room the player has bought, so
  // the bound is the live grid height, not the size the gym shipped with.
  for (let x = -1; x >= WALK_MIN_X; x -= 1) {
    for (let y = 0; y < gridH(); y += 1) {
      if (!taken.has(`${x},${y}`)) return { x, y }
    }
  }
  return { x: -1, y: 0 }
}

/** The four tiles sharing an edge, in a fixed order — ties break the same way twice. */
const NEIGHBOURS: Tile[] = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }]

/**
 * Somewhere to stand next to a fixture. `preferred` is tried first — the
 * attendant's side of a desk, say — and the four neighbours after it in a
 * fixed order, so the usual answer is the usual tile and the fallbacks only
 * come up for a fixture pushed against an edge of the room or boxed in.
 * Null means there is genuinely nowhere to stand.
 */
export function standTileNear(state: GameState, at: Tile, preferred: Tile | null): Tile | null {
  if (preferred && walkable(state, preferred.x, preferred.y)) return preferred

  for (const step of NEIGHBOURS) {
    const tile = { x: at.x + step.x, y: at.y + step.y }
    if (walkable(state, tile.x, tile.y)) return tile
  }
  return null
}

/**
 * Where a receptionist stands to work a given desk. The attendant's side is
 * the point of the thing — it faces back across the counter into the queue —
 * but a desk in the top row facing north has that tile off the grid entirely,
 * and one shoved into a corner can have it built over. Either way the desk is
 * still perfectly usable from another side, and pretending otherwise left the
 * receptionist stuck in the aisle with a job they could never reach.
 */
export function deskPost(state: GameState, desk: Decor): Tile | null {
  return standTileNear(state, { x: desk.x, y: desk.y }, tileBehind(desk.x, desk.y, desk.rotation))
}

/** The desk this employee actually claimed — not merely *a* desk. */
function claimedDesk(state: GameState, s: Staff): Decor | null {
  return state.decor.find(d => d.uid === s.targetUid && d.type === 'reception') ?? null
}

/**
 * Whether a trainer is free to be booked. The rule — a trainer is busy exactly
 * when some client names them in `trainerUid` — is defined in `clients.ts`,
 * because this module already imports `scanClient` from there and stating it
 * here as well would either close an import cycle or leave two copies of one
 * rule to drift apart. Re-exported so callers still find everything about an
 * employee in one place.
 */
export { freeTrainers, isTrainerFree } from './clients'

/** The visit a trainer is booked for, whatever phase it is in. */
export function bookingFor(state: GameState, staffUid: string): Client | null {
  return state.clients.find(c => c.trainerUid === staffUid) ?? null
}

/** A booked visit only needs a trainer on the floor once it has a machine to be at. */
const beingCoached = (c: Client): boolean => c.phase === 'toMachine' || c.phase === 'workout'

/** Tile an employee's current job sits on, or null when they have no job. */
export function targetTile(state: GameState, s: Staff): Tile | null {
  if (!s.targetUid) return null

  if (s.role === 'cleaner') {
    const stain = state.stains.find(x => x.uid === s.targetUid)
    return stain ? { x: stain.x, y: stain.y } : null
  }

  if (s.role === 'repair') {
    // Only while it is *still* broken. A repaired machine still exists, so
    // returning its tile here read as "job still real" to `assignStaff` and
    // pinned the repairer to the first machine they ever fixed — they never
    // picked up a second one. A cleaner never hit this because wiping deletes
    // the stain outright.
    const m = state.machines.find(x => x.uid === s.targetUid)
    return m && needsRepair(m) ? { x: m.x, y: m.y } : null
  }

  if (s.role === 'trainer') {
    // The job is the client, and it lasts exactly as long as the visit does.
    const client = state.clients.find(c => c.uid === s.targetUid)
    if (!client || client.trainerUid !== s.uid || !beingCoached(client)) return null

    const machine = state.machines.find(m => m.uid === client.machineUid)
    if (!machine) return null

    // Beside the kit rather than on top of it — the client is already standing
    // on the machine's own tile. Boxed in, share it; nobody collides anyway.
    const beside = { x: machine.x, y: machine.y }
    return standTileNear(state, beside, null) ?? beside
  }

  // Stand on the attendant's side of the desk — opposite the queue — rather
  // than on the desk's own tile, which had the receptionist walking onto the
  // counter itself. Resolved through the uid that was actually claimed:
  // storing and re-placing a desk mints a new one, and reading "any desk"
  // here let a stale claim keep working while a second receptionist took the
  // new desk, both of them scanning from the same spot.
  const desk = claimedDesk(state, s)
  return desk ? deskPost(state, desk) : null
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
    const broken = state.machines.find(m => needsRepair(m) && !claimed.has(m.uid))
    return broken ? broken.uid : null
  }

  if (s.role === 'trainer') {
    // A trainer never picks their own work: the player books them at the desk
    // and the booking is on the client. All that is left is to notice it.
    const booked = state.clients.find(c => c.trainerUid === s.uid && beingCoached(c))
    return booked ? booked.uid : null
  }

  // A desk nobody can stand at is not a job. Handing one out anyway is what
  // had the receptionist re-assigned and dropped again on every single tick.
  const desk = state.decor.find(
    d => d.type === 'reception' && !claimed.has(d.uid) && deskPost(state, d) !== null,
  )
  return desk ? desk.uid : null
}

/**
 * Whoever is closest to walking out. Serving the head of the array instead
 * meant patience counted for nothing: the person about to leave was skipped
 * for whoever happened to have been spawned first.
 */
export function nextToServe(state: GameState): Client | null {
  let worst: Client | null = null
  for (const c of state.clients) {
    if (c.phase !== 'queue') continue
    if (worst === null || c.phaseMs > worst.phaseMs) worst = c
  }
  return worst
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

    // Coaching has no completion timer — the trainer is booked for the visit
    // and is released when the client leaves. Without this they fell through
    // to the reception branch below and started scanning the queue.
    if (s.role === 'trainer') continue

    const tile = targetTile(next, s)
    if (!tile || !nearEnough(s, tile)) continue

    const workMs = s.workMs + dtMs
    const needed = workMsFor(s.role, s.rank)

    if (workMs < needed) {
      progressed.set(s.uid, workMs)
      changed = true
      continue
    }

    if (s.role === 'cleaner') {
      next = wipeStain(next, s.targetUid)
      progressed.set(s.uid, 0)
      changed = true
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
      progressed.set(s.uid, 0)
      changed = true
      continue
    }

    const waiting = nextToServe(next)
    const served = waiting ? scanClient(next, waiting.uid) : next

    // Nobody to serve, or no machine free to send them to: the cycle is held
    // at the finish line rather than spent on nothing, so somebody arriving a
    // frame later is scanned at once instead of waiting a full cycle for a
    // turn that was already over. Capped at `needed`, so it cannot bank ahead.
    if (served === next) {
      if (s.workMs !== needed) {
        progressed.set(s.uid, needed)
        changed = true
      }
      continue
    }

    next = served
    progressed.set(s.uid, 0)
    changed = true
  }

  if (!changed) return state

  return {
    ...next,
    staff: next.staff.map(s =>
      progressed.has(s.uid) ? { ...s, workMs: progressed.get(s.uid)! } : s,
    ),
  }
}

/**
 * Takes a candidate off the board and onto the payroll. Hiring itself costs
 * `candidate.price` up front — separate from, and on top of, the daily wage
 * `payWages` collects afterwards.
 */
export function hire(state: GameState, candidateUid: string): GameState {
  const candidate = state.candidates.find(c => c.uid === candidateUid)
  if (!candidate) return state
  // Per role, not one gate for the payroll: a trainer is a desk decision the
  // player makes long before automation is on the table.
  if (state.level < roleUnlockLevel(candidate.role)) return state
  if (state.staff.length >= STAFF_LIMIT) return state
  if (candidate.role === 'reception' && !state.decor.some(d => d.type === 'reception')) return state
  if (state.cash < candidate.price) return state

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
    cash: state.cash - candidate.price,
    nextUid: state.nextUid + 1,
    staff: [...state.staff, employee],
    candidates: state.candidates.filter(c => c.uid !== candidateUid),
    stats: { ...state.stats, totalSpent: state.stats.totalSpent + candidate.price },
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
