import type { Client, GameState } from './types'
import type { Point, QueueAnchor, Tile } from './layout'
import {
  DOOR_QUEUE_ANCHOR,
  DOOR_X,
  queueSpot,
  tileToWorld,
  worldToTile,
} from './layout'
import { findPath } from './pathfind'
import { stepAlongPath } from './walk'

/** Visitors all walk at the same pace; rarity says what they are worth, not how fast they move. */
export const CLIENT_SPEED = 2.0

/** Where the queue forms: in front of the reception desk, if one is placed. */
export function queueAnchorFor(state: GameState): QueueAnchor {
  const desk = state.decor.find(d => d.type === 'reception')
  if (!desk) return DOOR_QUEUE_ANCHOR

  const at = tileToWorld(desk.x, desk.y)
  return { x: at.x, z: at.z, angle: (desk.rotation * Math.PI) / 2 }
}

/** Exact world point a client in the given phase is heading for. */
function destination(state: GameState, client: Client, queueIndex: number): Point | null {
  if (client.phase === 'arriving' || client.phase === 'queue') {
    return queueSpot(queueIndex, queueAnchorFor(state))
  }

  if (client.phase === 'toMachine') {
    const m = state.machines.find(x => x.uid === client.machineUid)
    // A machine that broke while somebody was still walking over is as good
    // as gone: the walk keeps going nowhere otherwise.
    return m && m.durability > 0 ? tileToWorld(m.x, m.y) : null
  }

  if (client.phase === 'leaving') return { x: DOOR_X, z: DOOR_QUEUE_ANCHOR.z }

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
function queueAreaReachable(state: GameState, from: Tile): boolean {
  const anchor = queueAnchorFor(state)
  const anchorTile = worldToTile(anchor.x, anchor.z)
  return findPath(state, from, anchorTile, { allowBlockedGoal: true }) !== null
}

/**
 * Walks every client one step and flips the phases that walking completes.
 * Runs before `advanceClients` so somebody who arrives this tick starts
 * queueing or training in the same tick rather than the next one.
 *
 * A client with nowhere to walk is not left stuck: on the way in they are
 * counted as lost — walling off the entrance has to cost reputation — and on
 * the way to a machine they give the machine back and head out.
 */
export function moveClients(state: GameState, dtMs: number): GameState {
  if (state.clients.length === 0) return state

  const survivors: Client[] = []
  const freed: string[] = []
  let lost = 0
  let queueIndex = 0
  let changed = false

  for (const client of state.clients) {
    if (client.phase === 'workout') {
      survivors.push(client)
      continue
    }

    const index = client.phase === 'arriving' || client.phase === 'queue' ? queueIndex++ : 0
    const end = destination(state, client, index)

    if (!end) {
      // The machine vanished from under a walking client.
      changed = true
      if (client.machineUid) freed.push(client.machineUid)
      survivors.push({ ...client, phase: 'leaving', phaseMs: 0, path: [], goal: null })
      continue
    }

    const here = worldToTile(client.x, client.z)
    const goal = worldToTile(end.x, end.z)
    const onMachine = client.phase === 'toMachine'

    // Re-plan whenever the aim moved: the queue shuffles forward constantly.
    let path = client.path
    if (!client.goal || client.goal.x !== goal.x || client.goal.y !== goal.y) {
      const queueing = client.phase === 'arriving' || client.phase === 'queue'
      const found = queueing && !queueAreaReachable(state, here)
        ? null
        : findPath(state, here, goal, { allowBlockedGoal: onMachine })
      if (!found) {
        changed = true
        if (client.phase === 'leaving') continue // already settled; just vanish
        if (client.phase === 'toMachine' && client.machineUid) {
          freed.push(client.machineUid)
          survivors.push({ ...client, phase: 'leaving', phaseMs: 0, path: [], goal: null })
          continue
        }
        lost += 1 // walled off on the way in
        continue
      }
      path = found
    }

    const step = stepAlongPath(client, path, end, CLIENT_SPEED, dtMs)
    changed = true

    if (!step.arrived) {
      survivors.push({ ...client, x: step.pos.x, z: step.pos.z, path: step.path, goal })
      continue
    }

    if (client.phase === 'leaving') continue // out of the door, gone

    const phase = client.phase === 'toMachine' ? 'workout' : 'queue'

    survivors.push({
      ...client,
      x: step.pos.x,
      z: step.pos.z,
      path: [],
      goal,
      phase,
      // Patience and workout clocks both start on arrival, not on dispatch.
      // Somebody already queuing who merely shuffled forward keeps their timer.
      phaseMs: client.phase === phase ? client.phaseMs : 0,
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
    today: { ...state.today, clientsLost: state.today.clientsLost + lost },
    stats: { ...state.stats, clientsLost: state.stats.clientsLost + lost },
  }
}
