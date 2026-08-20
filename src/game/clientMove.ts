import type { Client, Decor, GameState } from './types'
import type { Point, QueueAnchor, Tile } from './layout'
import {
  DOOR_QUEUE_Z,
  doorQueueAnchor,
  doorX,
  queueSpot,
  tileToWorld,
  worldToTile,
} from './layout'
import { findPath } from './pathfind'
import { stepAlongPath } from './walk'
import { REP_LOSS_ON_WALKOUT, SAT_LOSS_ON_WALKOUT, clamp } from './clients'

/** Visitors all walk at the same pace; rarity says what they are worth, not how fast they move. */
export const CLIENT_SPEED = 2.0

/** Where a desk's own queue forms, or the legacy/manual queue when none is named. */
export function queueAnchorFor(state: GameState, receptionUid: string | null = null): QueueAnchor {
  const desk = receptionUid
    ? state.decor.find(d => d.uid === receptionUid && d.type === 'reception')
    : state.decor.find(d => d.type === 'reception')
  if (!desk) return doorQueueAnchor()

  const at = tileToWorld(desk.x, desk.y)
  return { x: at.x, z: at.z, angle: (desk.rotation * Math.PI) / 2 }
}

/**
 * Counters that can receive an automated queue right now.
 *
 * An on-duty receptionist claims exactly one desk, so their claims are the
 * source of truth. With no automated counter we retain the old manual flow at
 * the first desk: buying an empty counter must not split people into a queue
 * that nobody can serve.
 */
function queueDesks(state: GameState): Decor[] {
  const claimed = new Set(
    state.staff
      .filter(s => s.role === 'reception' && s.owed <= 0 && s.targetUid !== null)
      .map(s => s.targetUid as string),
  )
  const desks = state.decor.filter(d => d.type === 'reception')
  const working = desks.filter(d => claimed.has(d.uid))
  return working.length > 0 ? working : desks.slice(0, 1)
}

/**
 * Keeps existing valid choices stable, then sends newcomers to the shortest
 * working desk queue. The two passes matter: opening a second reception does
 * not make everybody already waiting zig-zag across the room, while new
 * visitors immediately fill the new line until both are balanced.
 */
function receptionAssignments(state: GameState): Map<string, string | null> {
  const desks = queueDesks(state)
  const valid = new Set(desks.map(d => d.uid))
  const loads = new Map(desks.map(d => [d.uid, 0]))
  const assigned = new Map<string, string | null>()
  const waiting = state.clients.filter(c => c.phase === 'arriving' || c.phase === 'queue')

  for (const client of waiting) {
    if (!client.receptionUid || !valid.has(client.receptionUid)) continue
    assigned.set(client.uid, client.receptionUid)
    loads.set(client.receptionUid, (loads.get(client.receptionUid) ?? 0) + 1)
  }

  for (const client of waiting) {
    if (assigned.has(client.uid)) continue

    let shortest: Decor | null = null
    for (const desk of desks) {
      if (shortest === null || (loads.get(desk.uid) ?? 0) < (loads.get(shortest.uid) ?? 0)) {
        shortest = desk
      }
    }

    const uid = shortest?.uid ?? null
    assigned.set(client.uid, uid)
    if (uid) loads.set(uid, (loads.get(uid) ?? 0) + 1)
  }

  return assigned
}

/** Exact world point a client in the given phase is heading for. */
function destination(
  state: GameState,
  client: Client,
  queueIndex: number,
  receptionUid: string | null,
): Point | null {
  if (client.phase === 'arriving' || client.phase === 'queue') {
    return queueSpot(queueIndex, queueAnchorFor(state, receptionUid))
  }

  if (client.phase === 'toMachine') {
    const m = state.machines.find(x => x.uid === client.machineUid)
    // A machine that broke while somebody was still walking over is as good
    // as gone: the walk keeps going nowhere otherwise.
    return m && m.durability > 0 ? tileToWorld(m.x, m.y) : null
  }

  if (client.phase === 'leaving') return { x: doorX(), z: DOOR_QUEUE_Z }

  return null
}

/**
 * Whether a client at `from` could still reach the front counter at all.
 * Gates the fine-grained, per-slot pathfind below: the exact fanned-out spot
 * for a given queue position can round onto a tile that happens to be
 * reachable by some route that never goes near the desk. Checking the desk's
 * own tile first is what makes walling the reception off actually turn
 * newcomers away, instead of leaving them to file into some technically-legal
 * spot nobody would call "queueing at the desk".
 */
function queueAreaReachable(state: GameState, from: Tile, receptionUid: string | null): boolean {
  const anchor = queueAnchorFor(state, receptionUid)
  const anchorTile = worldToTile(anchor.x, anchor.z)
  return findPath(state, from, anchorTile, { allowBlockedGoal: true }) !== null
}

/**
 * Walks every client one step and flips the phases that walking completes.
 * Runs before `advanceClients` so somebody who arrives this tick starts
 * queueing or training in the same tick rather than the next one.
 *
 * A client with nowhere to walk is not left stuck: on the way in they are
 * counted as lost — walling off the entrance costs reputation and
 * satisfaction exactly as an impatient walkout does — and on the way to a
 * machine they give the machine back and head out.
 *
 * `changed` tracks whether any client's stored fields actually differ from
 * what they already were, not merely whether we computed a step for them.
 * Every settled client (already standing on its target, nothing re-planned)
 * is pushed back by reference: with a full queue idling between scans, that
 * is what lets `commit()` skip the render on reference identity instead of
 * rebuilding every client object on every tick for nothing.
 */
export function moveClients(state: GameState, dtMs: number): GameState {
  if (state.clients.length === 0) return state

  const survivors: Client[] = []
  const freed: string[] = []
  let reputation = state.reputation
  let satisfaction = state.satisfaction
  let lost = 0
  const assignments = receptionAssignments(state)
  const queueIndexes = new Map<string, number>()
  let changed = false

  for (const original of state.clients) {
    let client = original
    if (client.phase === 'workout') {
      survivors.push(client)
      continue
    }

    const queueing = client.phase === 'arriving' || client.phase === 'queue'
    const receptionUid = queueing ? assignments.get(client.uid) ?? null : null

    // A missing value comes from an older save; an invalid one means the desk
    // was removed or its receptionist stopped working. Either way, re-route
    // immediately and discard the path toward the old counter.
    if (queueing && client.receptionUid !== receptionUid) {
      client = { ...client, receptionUid, path: [], goal: null }
      changed = true
    }

    const queueKey = receptionUid ?? ''
    const index = queueing ? queueIndexes.get(queueKey) ?? 0 : 0
    if (queueing) queueIndexes.set(queueKey, index + 1)
    const end = destination(state, client, index, receptionUid)

    if (!end) {
      // The machine vanished from under a walking client.
      changed = true
      if (client.machineUid) freed.push(client.machineUid)
      survivors.push({
        ...client,
        phase: 'leaving',
        phaseMs: 0,
        machineUid: null,
        receptionUid: null,
        path: [],
        goal: null,
      })
      continue
    }

    const here = worldToTile(client.x, client.z)
    const goal = worldToTile(end.x, end.z)
    const onMachine = client.phase === 'toMachine'
    const goalChanged = !client.goal || client.goal.x !== goal.x || client.goal.y !== goal.y

    // Re-plan whenever the aim moved: the queue shuffles forward constantly.
    let path = client.path
    if (goalChanged) {
      const found = queueing && !queueAreaReachable(state, here, receptionUid)
        ? null
        : findPath(state, here, goal, { allowBlockedGoal: onMachine })
      if (!found) {
        changed = true
        if (client.phase === 'leaving') continue // already settled; just vanish
        if (client.phase === 'toMachine' && client.machineUid) {
          freed.push(client.machineUid)
          survivors.push({ ...client, phase: 'leaving', phaseMs: 0, machineUid: null, path: [], goal: null })
          continue
        }
        // Walled off on the way in — the same hit an impatient walkout costs.
        lost += 1
        reputation = clamp(reputation - REP_LOSS_ON_WALKOUT, 0, 100)
        satisfaction = clamp(satisfaction - SAT_LOSS_ON_WALKOUT, 0, 100)
        continue
      }
      path = found
    }

    const step = stepAlongPath(client, path, end, CLIENT_SPEED, dtMs)

    if (!step.arrived) {
      const posChanged = step.pos.x !== client.x || step.pos.z !== client.z
      const pathChanged = step.path !== client.path
      if (posChanged || pathChanged || goalChanged) {
        changed = true
        survivors.push({ ...client, x: step.pos.x, z: step.pos.z, path: step.path, goal })
      } else {
        survivors.push(client)
      }
      continue
    }

    if (client.phase === 'leaving') {
      changed = true // out of the door, gone
      continue
    }

    const phase = client.phase === 'toMachine' ? 'workout' : 'queue'
    const phaseChanged = client.phase !== phase
    const posChanged = step.pos.x !== client.x || step.pos.z !== client.z
    const pathChanged = client.path.length !== 0

    if (!phaseChanged && !posChanged && !pathChanged && !goalChanged) {
      survivors.push(client) // already settled here; nothing to update
      continue
    }

    changed = true
    survivors.push({
      ...client,
      x: step.pos.x,
      z: step.pos.z,
      path: [],
      goal,
      phase,
      // Patience and workout clocks both start on arrival, not on dispatch.
      // Somebody already queuing who merely shuffled forward keeps their timer.
      phaseMs: phaseChanged ? 0 : client.phaseMs,
    })
  }

  if (!changed && lost === 0 && freed.length === 0) return state

  const machines = freed.length === 0
    ? state.machines
    : state.machines.map(m =>
        freed.includes(m.uid) && m.occupiedBy !== null ? { ...m, occupiedBy: null } : m,
      )

  return {
    ...state,
    machines,
    clients: survivors,
    reputation,
    satisfaction,
    today: { ...state.today, clientsLost: state.today.clientsLost + lost },
    stats: { ...state.stats, clientsLost: state.stats.clientsLost + lost },
  }
}
