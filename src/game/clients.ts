import type { Client, GameState, Machine } from './types'
import { machineType } from './content/machines'
import { nextRandom } from './rng'
import { addXp, entryFee } from './economy'
import { PATIENCE_MS } from './constants'

/** Longest queue the gym will grow before newcomers stop showing up. */
const MAX_QUEUE = 6

/** Chance per second that a client walks in, at zero and at full reputation. */
const SPAWN_BASE = 0.18
const SPAWN_PER_REP = 0.30

const REP_LOSS_ON_WALKOUT = 3
const SAT_LOSS_ON_WALKOUT = 2
const REP_GAIN_ON_WORKOUT = 1.5
const XP_ON_SCAN = 2

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

const isUsable = (m: Machine) => m.durability > 0 && m.occupiedBy === null

/**
 * Clients only turn up when there is a working, unoccupied machine — an empty
 * gym attracts nobody, which is what makes the first purchase matter.
 */
export function spawnClients(state: GameState, dtMs: number): GameState {
  if (!state.machines.some(isUsable)) return state
  if (state.clients.filter(c => c.phase === 'queue').length >= MAX_QUEUE) return state

  const perSecond = SPAWN_BASE + (clamp(state.reputation, 0, 100) / 100) * SPAWN_PER_REP
  const chance = perSecond * (dtMs / 1000)

  const [roll, seed] = nextRandom(state.seed)
  if (roll >= chance) return { ...state, seed }

  const client: Client = {
    uid: `c${state.nextUid}`,
    phase: 'queue',
    phaseMs: 0,
    machineUid: null,
  }
  return { ...state, seed, nextUid: state.nextUid + 1, clients: [...state.clients, client] }
}

/**
 * Ages every client by dtMs. Queued clients who run out of patience walk out
 * and cost reputation; finished workouts pay satisfaction, XP, and wear.
 */
export function advanceClients(state: GameState, dtMs: number): GameState {
  let { reputation, satisfaction } = state
  let { clientsServed, clientsLost } = state.stats
  let xpAwarded = 0

  const machines = state.machines.map(m => ({ ...m }))
  const byUid = new Map(machines.map(m => [m.uid, m]))
  const survivors: Client[] = []

  for (const client of state.clients) {
    const phaseMs = client.phaseMs + dtMs

    if (client.phase === 'queue') {
      if (phaseMs > PATIENCE_MS) {
        clientsLost += 1
        reputation = clamp(reputation - REP_LOSS_ON_WALKOUT, 0, 100)
        satisfaction = clamp(satisfaction - SAT_LOSS_ON_WALKOUT, 0, 100)
        continue
      }
      survivors.push({ ...client, phaseMs })
      continue
    }

    const machine = client.machineUid ? byUid.get(client.machineUid) : undefined
    if (!machine) continue // machine vanished; drop the orphaned client

    const type = machineType(machine.type)
    if (phaseMs < type.workoutMs) {
      survivors.push({ ...client, phaseMs })
      continue
    }

    clientsServed += 1
    satisfaction = clamp(satisfaction + type.satisfaction, 0, 100)
    reputation = clamp(reputation + REP_GAIN_ON_WORKOUT, 0, 100)
    machine.durability = clamp(machine.durability - type.wearPerUse, 0, 100)
    machine.occupiedBy = null
    xpAwarded += type.xpPerUse
  }

  const next: GameState = {
    ...state,
    reputation,
    satisfaction,
    machines,
    clients: survivors,
    stats: { ...state.stats, clientsServed, clientsLost },
  }
  return xpAwarded > 0 ? addXp(next, xpAwarded) : next
}

/**
 * The player's tap. Charges the entry fee and moves a queued client onto a
 * free working machine. With no machine available it changes nothing.
 */
export function scanClient(state: GameState, clientUid: string): GameState {
  const client = state.clients.find(c => c.uid === clientUid)
  if (!client || client.phase !== 'queue') return state

  const machine = state.machines.find(isUsable)
  if (!machine) return state

  const fee = entryFee(state.reputation)

  const next: GameState = {
    ...state,
    cash: state.cash + fee,
    machines: state.machines.map(m =>
      m.uid === machine.uid ? { ...m, occupiedBy: client.uid } : m,
    ),
    clients: state.clients.map(c =>
      c.uid === client.uid
        ? { ...c, phase: 'workout' as const, phaseMs: 0, machineUid: machine.uid }
        : c,
    ),
    stats: { ...state.stats, totalEarned: state.stats.totalEarned + fee },
  }
  return addXp(next, XP_ON_SCAN)
}
