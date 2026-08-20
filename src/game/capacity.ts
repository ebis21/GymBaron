import type { GameState } from './types'
import { DAY_MS, ENTRY_FEE_BASE } from './constants'
import { machineType } from './content/machines'
import { averageRarityMultiplier } from './content/rarity'
import { workMsFor } from './content/staff'
import { arrivalsPerSecond } from './clients'
import { passPrice, reputationBonus } from './economy'
import { signupChance } from './members'
import { onDuty, staffedDesks } from './staff'
import { earningsMult, luckMult } from './upgrades'
import { campaignById, type CampaignId } from './content/campaigns'
import { marketingLuck, marketingSignupBoost, spawnRateMultiplier } from './marketing'

/**
 * What the gym can actually get through in a day, against what advertising
 * would send it.
 *
 * This exists because footfall and throughput are set by completely different
 * systems — `equipmentDraw` and the campaign multipliers decide how many people
 * turn up, while the desks, the payroll and the machines decide how many of
 * them ever train. Nothing tied the two together, so the player could buy a
 * television spot for a gym with one receptionist and simply watch the extra
 * crowd time out at the door, paying a five-figure daily fee for reputation
 * damage. These are the numbers the marketing screen uses to say so first.
 *
 * Everything here is a projection, not a promise: it ignores breakdowns, dirt,
 * walking time and the player's own hand on the scanner. It is deliberately
 * generous, so a warning means the gym is *definitely* short rather than
 * possibly short.
 */

/**
 * Scans a day the reception can manage on its own.
 *
 * A receptionist with no desk to stand at does nothing, and a desk with nobody
 * behind it does nothing either, so this is the smaller of the two paired up —
 * fastest staff to the desks first, which is how `pickJob` hands them out.
 * Desks nobody can physically stand at are not counted at all: `deskPost`
 * returning null is exactly the case where a counter is boxed in.
 */
export function scanCapacityPerDay(state: GameState): number {
  const posts = staffedDesks(state).length
  if (posts === 0) return 0

  return state.staff
    .filter(s => s.role === 'reception' && onDuty(s))
    .map(s => DAY_MS / workMsFor('reception', s.rank))
    .sort((a, b) => b - a)
    .slice(0, posts)
    .reduce((sum, scans) => sum + scans, 0)
}

/**
 * Workouts a day the kit could seat if it never broke and nobody walked
 * anywhere. Counts only the floor the queue is actually on — visitors do not
 * take the stairs.
 */
export function machineCapacityPerDay(state: GameState): number {
  return state.machines.reduce(
    (sum, m) => sum + DAY_MS / machineType(m.type).workoutMs,
    0,
  )
}

/** Whichever of the two runs out first — the real ceiling on a day's takings. */
export const servablePerDay = (state: GameState): number =>
  Math.min(scanCapacityPerDay(state), machineCapacityPerDay(state))

/**
 * People a day at the door, at whatever advertising is live. Pass `extra` to
 * price an offer the player has not bought yet: campaigns compound, so a
 * prospective one multiplies whatever is already running.
 */
export function arrivalsPerDay(state: GameState, extra = 1): number {
  return arrivalsPerSecond(state, spawnRateMultiplier(state) * extra) * (DAY_MS / 1000)
}

export interface TrafficOutlook {
  /** Walk-ins a day this campaign would add to whatever is already live. */
  arrivals: number
  /** Workouts a day the gym could finish, desks and kit together. */
  servable: number
  /** Which side is short, or null when the gym can cope. */
  shortOf: 'reception' | 'machines' | null
  /** Money a day the offer would add, after its own fee. Negative loses money. */
  net: number
}

/**
 * What the average machine on this floor is worth at the till, weighted by how
 * many people it can actually put through in a day. Weighting matters: a hall
 * of slow, lucrative presses and one fast, cheap treadmill does not earn the
 * unweighted average of the two.
 */
function averageMachineValue(state: GameState): number {
  let workouts = 0
  let weighted = 0
  for (const m of state.machines) {
    const type = machineType(m.type)
    const share = DAY_MS / type.workoutMs
    workouts += share
    weighted += share * type.revenueMultiplier
  }
  return workouts === 0 ? 0 : weighted / workouts
}

/**
 * The door fee an average visitor pays, at a given luck. Deliberately built
 * from the same pieces `entryFee` charges rather than sampled: a screen cannot
 * roll a die on the player's behalf, so the rarity table is read as its
 * expectation. `luck` is the whole point — a premium campaign earns most of
 * its keep by raising this on people who were coming anyway.
 */
const doorFee = (state: GameState, luck: number): number =>
  ENTRY_FEE_BASE
  * averageMachineValue(state)
  * averageRarityMultiplier(luck)
  * reputationBonus(state.reputation)
  * earningsMult(state)
  * state.allianceIncomeMultiplier
  * state.premium.incomeMultiplier

/** A day's takings from `served` walk-ins, at the door and at the desk. */
const takings = (state: GameState, served: number, luck: number, deskLuck: number): number =>
  served * doorFee(state, luck)
  + served * signupChance(state.satisfaction, deskLuck) * passPrice(state)

/**
 * What starting `campaignId` would mean, given everything already running.
 *
 * The margin is what stops the warning crying wolf. A queue is *meant* to form
 * — a gym with nobody waiting is a gym that bought too much kit — so a campaign
 * only earns a warning once it would send appreciably more people than the
 * place can serve, not merely enough to keep the desk busy.
 */
const OVERSHOOT_MARGIN = 1.15

export function outlookFor(state: GameState, campaignId: CampaignId): TrafficOutlook {
  const campaign = campaignById(campaignId)
  const arrivals = arrivalsPerDay(state, campaign.spawnMultiplier)
  const scans = scanCapacityPerDay(state)
  const seats = machineCapacityPerDay(state)
  const servable = Math.min(scans, seats)

  // Nobody the gym could not have served pays for anything. Clamping both
  // sides of the comparison is what stops the projection promising a fortune
  // exactly where the warning above says the crowd will walk back out.
  const servedNow = Math.min(arrivalsPerDay(state), servable)
  const servedWith = Math.min(arrivals, servable)

  const luck = luckMult(state) * state.premium.luckMultiplier * marketingLuck(state)
  const deskLuck = luckMult(state) * state.premium.luckMultiplier * marketingSignupBoost(state)

  const net =
    takings(
      state,
      servedWith,
      luck * (campaign.clientLuck ?? 1),
      deskLuck * (campaign.signupBoost ?? 1),
    )
    - takings(state, servedNow, luck, deskLuck)
    - campaign.dailyCost

  return {
    arrivals,
    servable,
    shortOf: arrivals <= servable * OVERSHOOT_MARGIN
      ? null
      : scans <= seats ? 'reception' : 'machines',
    net,
  }
}
