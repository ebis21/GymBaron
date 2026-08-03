import type { Client, ClientKind, GameState, Machine } from './types'
import { machineType } from './content/machines'
import { rollRarity } from './content/rarity'
import { nextRandom } from './rng'
import { addXp, entryFee } from './economy'
import { addMember, signupChance } from './members'
import { DAY_MS, MAX_QUEUE, PATIENCE_MS } from './constants'

/** Chance per second that a client walks in, at zero and at full reputation. */
const SPAWN_BASE = 0.18
const SPAWN_PER_REP = 0.30

/** Times an average member turns up over a full 8:00–20:00 day. */
const MEMBER_VISITS_PER_DAY = 1.6

const REP_LOSS_ON_WALKOUT = 3
const SAT_LOSS_ON_WALKOUT = 2
const REP_GAIN_ON_WORKOUT = 1.5
const XP_ON_SCAN = 2

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

const isUsable = (m: Machine) => m.durability > 0 && m.occupiedBy === null

/** True when the gym can take one more person through the door right now. */
function acceptingArrivals(state: GameState): boolean {
  if (!state.machines.some(isUsable)) return false
  return state.clients.filter(c => c.phase === 'queue').length < MAX_QUEUE
}

function enqueue(state: GameState, kind: ClientKind, memberUid: string | null): GameState {
  const [rarity, seed] = rollRarity(state.seed)
  const client: Client = {
    uid: `c${state.nextUid}`,
    kind,
    rarity,
    phase: 'queue',
    phaseMs: 0,
    machineUid: null,
    memberUid,
  }
  return { ...state, seed, nextUid: state.nextUid + 1, clients: [...state.clients, client] }
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

  for (const client of state.clients) {
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
    if (phaseMs < type.workoutMs) {
      survivors.push({ ...client, phaseMs })
      continue
    }

    served += 1
    satisfaction = clamp(satisfaction + type.satisfaction, 0, 100)
    reputation = clamp(reputation + REP_GAIN_ON_WORKOUT, 0, 100)
    machine.durability = clamp(machine.durability - type.wearPerUse, 0, 100)
    machine.occupiedBy = null
    xpAwarded += type.xpPerUse

    // A good session is what sells a pass. Members already hold one.
    if (client.kind === 'walkin') {
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

  const fee = entryFee(machine.type, client.kind, client.rarity)

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
    today: { ...state.today, entryFees: state.today.entryFees + fee },
    stats: { ...state.stats, totalEarned: state.stats.totalEarned + fee },
  }
  return addXp(next, XP_ON_SCAN)
}
