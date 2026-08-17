import type { GameState } from './types'
import { DAY_MS } from './constants'
import { machineType } from './content/machines'
import { workMsFor } from './content/staff'
import { arrivalsPerSecond } from './clients'
import { onDuty, staffedDesks } from './staff'
import { campaignById, type CampaignId } from './content/campaigns'
import { spawnRateMultiplier } from './marketing'

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
}

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
  const arrivals = arrivalsPerDay(state, campaignById(campaignId).spawnMultiplier)
  const scans = scanCapacityPerDay(state)
  const seats = machineCapacityPerDay(state)
  const servable = Math.min(scans, seats)

  return {
    arrivals,
    servable,
    shortOf: arrivals <= servable * OVERSHOOT_MARGIN
      ? null
      : scans <= seats ? 'reception' : 'machines',
  }
}
