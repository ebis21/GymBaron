/**
 * The sponsorship deals on offer.
 *
 * OWNER: `feat/v2-sponsors`. Nobody else edits this file.
 *
 * Balance numbers belong here rather than in `constants.ts` — that file is
 * shared trunk, and a deal's payout is content, not a rule of the world.
 */

/**
 * What a brand measures the gym on.
 *
 * Two of these describe what the gym *is* and two describe what it *did today*,
 * and the difference decides when each can be judged — see `isStanding`.
 */
export type ConditionKind = 'reputation' | 'machines' | 'clientsServed' | 'cleanliness'

export const CONDITION_KINDS: ConditionKind[] = [
  'reputation',
  'machines',
  'clientsServed',
  'cleanliness',
]

export const isConditionKind = (v: unknown): v is ConditionKind =>
  typeof v === 'string' && (CONDITION_KINDS as string[]).includes(v)

export interface SponsorCondition {
  kind: ConditionKind
  /** `cleanliness` is a ceiling — at most this many stains. The rest are floors. */
  value: number
}

/**
 * Whether a condition can be judged before the day is over.
 *
 * Reputation and kit on the floor are true of the gym at any moment, so a brand
 * can look at them when it signs. Clients served and the state of the floor are
 * only known once the day has run, which is why a deal cannot demand them up
 * front: at 8:00 nobody has been served and every gym would fail.
 */
export const isStanding = (kind: ConditionKind): boolean =>
  kind === 'reputation' || kind === 'machines'

export type SponsorId =
  | 'juice-bar'
  | 'city-apparel'
  | 'supplements'
  | 'energy-drink'
  | 'global'

export interface Sponsor {
  id: SponsorId
  /** Paid at the day's close, every day the conditions hold. */
  payout: number
  /**
   * Cost of signing a deal that has already been broken once. Roughly four
   * days of its own payout: enough that losing a deal stings, cheap enough that
   * a bad week is not the end of the ladder.
   */
  resignFee: number
  conditions: SponsorCondition[]
}

/**
 * How many missed days end a deal. A day that pays clears the count, so only
 * sustained neglect costs the sponsor — one bad Tuesday never does.
 */
export const STRIKES_TO_LAPSE = 3

/**
 * A juice bar two doors down. One condition and a payout that reads as small
 * later on, but daily rent is 60: this is the deal that keeps a new gym's head
 * above water, and it asks for nothing but a reputation worth having.
 */
const JUICE_BAR: Sponsor = {
  id: 'juice-bar',
  payout: 150,
  resignFee: 600,
  conditions: [{ kind: 'reputation', value: 15 }],
}

/**
 * The first deal that asks for two things at once, and the first that can be
 * missed on a quiet day — twelve served is comfortable for a gym anyone visits
 * and out of reach for one nobody has heard of.
 */
const CITY_APPAREL: Sponsor = {
  id: 'city-apparel',
  payout: 450,
  resignFee: 1_800,
  conditions: [
    { kind: 'reputation', value: 35 },
    { kind: 'clientsServed', value: 12 },
  ],
}

/**
 * Both conditions are standing ones, which makes this the steadiest deal on the
 * board: sign it with the kit already in place and it pays whatever kind of day
 * the gym has. It is the rung that funds the jump to the demanding half.
 */
const SUPPLEMENTS: Sponsor = {
  id: 'supplements',
  payout: 1_200,
  resignFee: 4_800,
  conditions: [
    { kind: 'reputation', value: 55 },
    { kind: 'machines', value: 10 },
  ],
}

/**
 * Three conditions, and the first to care about the floor being clean. Worth
 * more per day than the whole early game earns, so it is meant to be juggled.
 */
const ENERGY_DRINK: Sponsor = {
  id: 'energy-drink',
  payout: 3_000,
  resignFee: 12_000,
  conditions: [
    { kind: 'reputation', value: 70 },
    { kind: 'clientsServed', value: 30 },
    { kind: 'cleanliness', value: 2 },
  ],
}

/**
 * The top of the ladder: a near-spotless reputation, a full day's traffic and a
 * floor that never got worse than one stain. Ambient dirt alone stops at three
 * stains, so holding this one means actually mopping rather than out-waiting
 * the grime.
 */
const GLOBAL: Sponsor = {
  id: 'global',
  payout: 7_500,
  resignFee: 30_000,
  conditions: [
    { kind: 'reputation', value: 85 },
    { kind: 'clientsServed', value: 50 },
    { kind: 'cleanliness', value: 1 },
  ],
}

/** Board order — the sponsors screen prints them exactly like this. */
export const SPONSORS: Sponsor[] = [
  JUICE_BAR,
  CITY_APPAREL,
  SUPPLEMENTS,
  ENERGY_DRINK,
  GLOBAL,
]

const BY_ID = new Map<SponsorId, Sponsor>(SPONSORS.map(s => [s.id, s]))

export function sponsorDeal(id: SponsorId): Sponsor {
  const deal = BY_ID.get(id)
  if (!deal) throw new Error(`Unknown sponsor: ${id}`)
  return deal
}

/**
 * Guards the id read back out of a save. `normalizeSponsors` runs on whatever
 * is in storage, including a deal removed from the board since — an id that no
 * longer exists has to read as "no deal" rather than as a lookup that throws.
 */
export const isSponsorId = (v: unknown): v is SponsorId =>
  typeof v === 'string' && BY_ID.has(v as SponsorId)
