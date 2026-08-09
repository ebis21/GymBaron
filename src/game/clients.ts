import type { Client, ClientKind, GameState, Machine, Staff } from './types'
import { machineType } from './content/machines'
import { isClosingTime } from './clock'
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
  TRAINER_SATISFACTION_MULT,
} from './constants'
import { earningsMult, luckMult, patienceMs } from './upgrades'
import { DOOR_QUEUE_Z, doorX } from './layout'
import { spawnStain, STAIN_CHANCE } from './stains'
import { clientsAcrossFloors } from './floors'
import { spawnRateMultiplier } from './marketing'

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
export const REP_LOSS_ON_WALKOUT = 1.5
export const SAT_LOSS_ON_WALKOUT = 2
/**
 * Reputation per finished workout, at zero reputation. These numbers were set
 * when a broken receptionist meant the player served a handful of people by
 * hand; a working desk serves sixty a day, and at the old +1.5 the gym went
 * from unknown to famous in an afternoon.
 *
 * The gain is also scaled by how much reputation is left to win, so the first
 * points come quickly and the last ones have to be earned over days. A walkout
 * costs a flat `REP_LOSS_ON_WALKOUT`, so the better the gym's name, the more
 * a turned-away client actually costs it.
 */
const REP_GAIN_ON_WORKOUT = 0.4
const XP_ON_SCAN = 2

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

const isUsable = (m: Machine) => m.durability > 0 && m.occupiedBy === null

/**
 * True when a trainer is on the payroll, being paid, and not already booked.
 * The booking lives on the client, so "free" is simply "nobody names them".
 *
 * This lives here rather than in `staff.ts` because `staff.ts` already imports
 * `scanClient` from this module — putting it the other way round would close
 * an import cycle.
 */
export function isTrainerFree(state: GameState, trainerUid: string): boolean {
  const trainer = state.staff.find(s => s.uid === trainerUid)
  // `owed > 0` is an employee on strike over unpaid wages; they coach nobody.
  if (!trainer || trainer.role !== 'trainer' || trainer.owed > 0) return false
  return !clientsAcrossFloors(state).some(c => c.trainerUid === trainerUid)
}

/** Every trainer available to be booked for the client at the desk right now. */
export function freeTrainers(state: GameState): Staff[] {
  return state.staff.filter(s => s.role === 'trainer' && isTrainerFree(state, s.uid))
}

/** True when the gym can take one more person through the door right now. */
function acceptingArrivals(state: GameState): boolean {
  // Past 20:00 the door is shut. Whoever is already inside still finishes.
  if (isClosingTime(state.dayMs)) return false
  if (!state.machines.some(isUsable)) return false
  const waiting = state.clients.filter(c => c.phase === 'queue' || c.phase === 'arriving').length
  return waiting < MAX_QUEUE
}

function enqueue(state: GameState, kind: ClientKind, memberUid: string | null): GameState {
  const [rarity, seed] = rollRarity(state.seed, luckMult(state))
  const client: Client = {
    uid: `c${state.nextUid}`,
    kind,
    rarity,
    phase: 'arriving',
    phaseMs: 0,
    machineUid: null,
    memberUid,
    trainerUid: null,
    x: doorX(),
    z: DOOR_QUEUE_Z,
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
    trainerUid: null,
    x: doorX(),
    z: DOOR_QUEUE_Z,
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

  // Reputation is what the gym earned; advertising is what it paid for. They
  // multiply rather than add, so a campaign is worth more to a place people
  // already like — which is the shape the marketing design wants.
  const perSecond =
    (SPAWN_BASE + (clamp(state.reputation, 0, 100) / 100) * SPAWN_PER_REP) *
    spawnRateMultiplier(state)
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

  // Both upgrade tracks are read once for the whole sweep rather than per
  // client — they cannot change mid-tick, and the loop runs over every person
  // in the building on every frame.
  const patience = patienceMs(state)
  const luck = luckMult(state)

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
      if (phaseMs > patience) {
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
    const coached = client.trainerUid !== null
    satisfaction = clamp(
      satisfaction + type.satisfaction * (coached ? TRAINER_SATISFACTION_MULT : 1),
      0,
      100,
    )
    reputation = clamp(
      reputation + REP_GAIN_ON_WORKOUT * (1 - clamp(reputation, 0, 100) / 100),
      0,
      100,
    )
    machine.durability = client.special === 'lil-d'
      ? 0
      : clamp(machine.durability - type.wearPerUse, 0, 100)
    machine.occupiedBy = null
    const [dirtRoll, dirtSeed] = nextRandom(seed)
    seed = dirtSeed
    if (dirtRoll < STAIN_CHANCE) dirtied.push({ x: machine.x, y: machine.y })
    xpAwarded += type.xpPerUse

    // Finished clients walk out rather than blinking away. The session is
    // over the moment the workout is, so the trainer is released here rather
    // than when the client finally reaches the door — otherwise a coach would
    // stay booked for the length of a walk across the hall.
    survivors.push({
      ...client,
      phase: 'leaving',
      phaseMs: 0,
      machineUid: null,
      trainerUid: null,
      path: [],
      goal: null,
    })

    if (client.kind === 'walkin' && client.special !== 'lil-d') {
      const [roll, nextSeed] = nextRandom(seed)
      seed = nextSeed
      if (roll < signupChance(satisfaction, luck)) signups += 1
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
 *
 * `trainerUid` books a personal trainer for the visit, which is what makes the
 * client worth `TRAINER_FEE_MULT` of the usual fee. It is validated rather
 * than trusted: a trainer who has since been booked, sacked or gone on strike
 * is quietly ignored and the client goes through at the plain price, so a
 * stale button in the UI can never conjure money out of nothing.
 */
export function scanClient(
  state: GameState,
  clientUid: string,
  trainerUid: string | null = null,
): GameState {
  const client = state.clients.find(c => c.uid === clientUid)
  if (!client || client.phase !== 'queue') return state

  const machine = state.machines.find(isUsable)
  if (!machine) return state

  const isLilD = client.special === 'lil-d'
  const coach = trainerUid && !isLilD && isTrainerFree(state, trainerUid) ? trainerUid : null

  // LIL D. settles by his own rules and his notes are a loss, so the earnings
  // track never touches him — upgrading how well you sell cannot make a con
  // pay better.
  const earnings = earningsMult(state)
  const plainFee = isLilD
    ? 0
    : entryFee(machine.type, client.kind, client.rarity, state.reputation, false, earnings)
  const fee = isLilD
    ? LIL_D_FAKE_PAYMENT
    : entryFee(
        machine.type,
        client.kind,
        client.rarity,
        state.reputation,
        coach !== null,
        earnings,
      )
  // A breakdown of `fee`, not income on top of it — see `DayLedger.trainerFees`.
  const trainerShare = isLilD ? 0 : fee - plainFee
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
            trainerUid: coach,
            path: [],
            goal: null,
          }
        : c,
    ),
    today: {
      ...state.today,
      entryFees: state.today.entryFees + (isLilD ? 0 : fee),
      trainerFees: state.today.trainerFees + trainerShare,
      counterfeitLoss: state.today.counterfeitLoss + (isLilD ? fee : 0),
    },
    stats: isLilD
      ? { ...state.stats, totalSpent: state.stats.totalSpent + fee }
      : { ...state.stats, totalEarned: state.stats.totalEarned + fee },
  }
  return addXp(next, XP_ON_SCAN)
}
