import type { Client, ClientKind, GameState, Machine } from './types'
import { machineType } from './content/machines'
import { rollRarity } from './content/rarity'
import { nextRandom } from './rng'
import { addXp, entryFee } from './economy'
import { addMember, signupChance } from './members'
import {
  DAY_MS,
  LIL_D_EXTRA_WORKOUT_MS,
  LIL_D_FAKE_PAYMENT,
  LIL_D_SPAWN_CHANCE,
  MAX_QUEUE,
  PATIENCE_MS,
} from './constants'
import { DOOR_X, DOOR_QUEUE_ANCHOR } from './layout'
import { spawnStain, STAIN_CHANCE } from './stains'

/**
 * Chance per second that a client walks in, at zero and at full reputation.
 * Cut by a fifth against the original rates: the gym is meant to be tight
 * enough that losing somebody at the door actually stings.
 */
const SPAWN_BASE = 0.144
const SPAWN_PER_REP = 0.24

/** Times an average member turns up over a full 8:00–20:00 day. */
const MEMBER_VISITS_PER_DAY = 1.6

/** Shared with clientMove.ts: a walled-off entrance costs exactly what an impatient walkout does. */
export const REP_LOSS_ON_WALKOUT = 3
export const SAT_LOSS_ON_WALKOUT = 2
const REP_GAIN_ON_WORKOUT = 1.5
const XP_ON_SCAN = 2

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

const isUsable = (m: Machine) => m.durability > 0 && m.occupiedBy === null

/** True when the gym can take one more person through the door right now. */
function acceptingArrivals(state: GameState): boolean {
  if (!state.machines.some(isUsable)) return false
  const waiting = state.clients.filter(c => c.phase === 'queue' || c.phase === 'arriving').length
  return waiting < MAX_QUEUE
}

function enqueue(state: GameState, kind: ClientKind, memberUid: string | null): GameState {
  const [rarity, seed] = rollRarity(state.seed)
  const client: Client = {
    uid: `c${state.nextUid}`,
    kind,
    rarity,
    phase: 'arriving',
    phaseMs: 0,
    machineUid: null,
    memberUid,
    x: DOOR_X,
    z: DOOR_QUEUE_ANCHOR.z,
    path: [],
    goal: null,
  }
  return { ...state, seed, nextUid: state.nextUid + 1, clients: [...state.clients, client] }
}

/** Adds the named secret visitor without consuming the normal rarity roll. */
export function summonLilD(state: GameState): GameState {
  if (state.clients.some(c => c.special === 'lil-d')) return state

  const client: Client = {
    uid: `c${state.nextUid}`,
    kind: 'walkin',
    rarity: 'secret',
    special: 'lil-d',
    phase: 'arriving',
    phaseMs: 0,
    machineUid: null,
    memberUid: null,
    x: DOOR_X,
    z: DOOR_QUEUE_ANCHOR.z,
    path: [],
    goal: null,
  }

  return {
    ...state,
    lilDSeenDay: state.day,
    nextUid: state.nextUid + 1,
    clients: [...state.clients, client],
  }
}

/** Rare easter egg, but never more than once during the same business day. */
export function spawnLilD(state: GameState, dtMs: number): GameState {
  if (state.lilDSeenDay === state.day || !acceptingArrivals(state)) return state

  const [roll, seed] = nextRandom(state.seed)
  const rolled = { ...state, seed }
  const chance = Math.min(1, LIL_D_SPAWN_CHANCE * (dtMs / 1000))
  return roll < chance ? summonLilD(rolled) : rolled
}

/**
 * Passers-by only turn up when there is a working, unoccupied machine — an
 * empty gym attracts nobody, which is what makes the first purchase matter.
 */
export function spawnWalkins(state: GameState, dtMs: number): GameState {
  if (!acceptingArrivals(state)) return state

  const perSecond = SPAWN_BASE + (clamp(state.reputation, 0, 100) / 100) * SPAWN_PER_REP
  const chance = perSecond * (dtMs / 1000)

  const [roll, seed] = nextRandom(state.seed)
  const next = { ...state, seed }
  return roll < chance ? enqueue(next, 'walkin', null) : next
}

/**
 * Members come back on their own, at a rate that scales with how many passes
 * are out there. Only members who are not already inside can arrive, so a
 * small membership cannot flood the queue with duplicates of one person.
 */
export function spawnMembers(state: GameState, dtMs: number): GameState {
  if (state.members.length === 0 || !acceptingArrivals(state)) return state

  const inside = new Set(
    state.clients.map(c => c.memberUid).filter((uid): uid is string => uid !== null),
  )
  const available = state.members.filter(m => !inside.has(m.uid))
  if (available.length === 0) return state

  const perSecond = (available.length * MEMBER_VISITS_PER_DAY) / (DAY_MS / 1000)
  const chance = perSecond * (dtMs / 1000)

  const [roll, seed] = nextRandom(state.seed)
  if (roll >= chance) return { ...state, seed }

  const [pick, seed2] = nextRandom(seed)
  const index = Math.min(available.length - 1, Math.floor(pick * available.length))
  const member = available[index]
  if (!member) return { ...state, seed: seed2 }

  return enqueue({ ...state, seed: seed2 }, 'member', member.uid)
}

/**
 * Ages every client by dtMs. Queued clients who run out of patience walk out
 * and cost reputation; finished workouts pay satisfaction, XP, and wear.
 */
export function advanceClients(state: GameState, dtMs: number): GameState {
  let { reputation, satisfaction, seed } = state
  let served = 0
  let lost = 0
  let signups = 0
  let xpAwarded = 0

  const machines = state.machines.map(m => ({ ...m }))
  const byUid = new Map(machines.map(m => [m.uid, m]))
  const survivors: Client[] = []
  const dirtied: { x: number; y: number }[] = []

  for (const client of state.clients) {
    // Walking phases are advanced by moveClients; only timers live here.
    if (client.phase === 'arriving' || client.phase === 'toMachine' || client.phase === 'leaving') {
      survivors.push(client)
      continue
    }

    const phaseMs = client.phaseMs + dtMs

    if (client.phase === 'queue') {
      if (phaseMs > PATIENCE_MS) {
        lost += 1
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
    const workoutMs = type.workoutMs + (client.special === 'lil-d' ? LIL_D_EXTRA_WORKOUT_MS : 0)
    if (phaseMs < workoutMs) {
      survivors.push({ ...client, phaseMs })
      continue
    }

    served += 1
    satisfaction = clamp(satisfaction + type.satisfaction, 0, 100)
    reputation = clamp(reputation + REP_GAIN_ON_WORKOUT, 0, 100)
    machine.durability = client.special === 'lil-d'
      ? 0
      : clamp(machine.durability - type.wearPerUse, 0, 100)
    machine.occupiedBy = null
    const [dirtRoll, dirtSeed] = nextRandom(seed)
    seed = dirtSeed
    if (dirtRoll < STAIN_CHANCE) dirtied.push({ x: machine.x, y: machine.y })
    xpAwarded += type.xpPerUse

    // Finished clients walk out rather than blinking away.
    survivors.push({
      ...client,
      phase: 'leaving',
      phaseMs: 0,
      machineUid: null,
      path: [],
      goal: null,
    })

    if (client.kind === 'walkin' && client.special !== 'lil-d') {
      const [roll, nextSeed] = nextRandom(seed)
      seed = nextSeed
      if (roll < signupChance(satisfaction)) signups += 1
    }
  }

  let next: GameState = {
    ...state,
    seed,
    reputation,
    satisfaction,
    machines,
    clients: survivors,
    today: {
      ...state.today,
      clientsServed: state.today.clientsServed + served,
      clientsLost: state.today.clientsLost + lost,
    },
    stats: {
      ...state.stats,
      clientsServed: state.stats.clientsServed + served,
      clientsLost: state.stats.clientsLost + lost,
    },
  }

  for (const tile of dirtied) next = spawnStain(next, tile.x, tile.y)
  for (let i = 0; i < signups; i += 1) next = addMember(next)
  return xpAwarded > 0 ? addXp(next, xpAwarded) : next
}

/**
 * The player's tap. Charges the entry fee and moves a queued client onto a
 * free working machine. With no machine available it changes nothing.
 *
 * The fee is settled here because this is where the machine is assigned, and
 * the machine's multiplier is what the visit is worth. Members go through the
 * same turnstile — their pass only discounts it.
 */
export function scanClient(state: GameState, clientUid: string): GameState {
  const client = state.clients.find(c => c.uid === clientUid)
  if (!client || client.phase !== 'queue') return state

  const machine = state.machines.find(isUsable)
  if (!machine) return state

  const isLilD = client.special === 'lil-d'
  const fee = isLilD ? LIL_D_FAKE_PAYMENT : entryFee(machine.type, client.kind, client.rarity)
  const cashDelta = isLilD ? -fee : fee

  const next: GameState = {
    ...state,
    cash: state.cash + cashDelta,
    machines: state.machines.map(m =>
      m.uid === machine.uid ? { ...m, occupiedBy: client.uid } : m,
    ),
    clients: state.clients.map(c =>
      c.uid === client.uid
        ? {
            ...c,
            phase: 'toMachine' as const,
            phaseMs: 0,
            machineUid: machine.uid,
            path: [],
            goal: null,
          }
        : c,
    ),
    today: {
      ...state.today,
      entryFees: state.today.entryFees + (isLilD ? 0 : fee),
      counterfeitLoss: state.today.counterfeitLoss + (isLilD ? fee : 0),
    },
    stats: isLilD
      ? { ...state.stats, totalSpent: state.stats.totalSpent + fee }
      : { ...state.stats, totalEarned: state.stats.totalEarned + fee },
  }
  return addXp(next, XP_ON_SCAN)
}
