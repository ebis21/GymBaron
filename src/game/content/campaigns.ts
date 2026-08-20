/**
 * The advertising campaigns on offer.
 *
 * OWNER: `feat/v2-marketing`. Nobody else edits this file.
 *
 * Balance numbers belong here rather than in `constants.ts` — that file is
 * shared trunk, and what a flyer run costs is content, not a rule of the world.
 */
export type CampaignId =
  | 'flyers'
  | 'referral'
  | 'social'
  | 'billboards'
  | 'premium'
  | 'openDay'
  | 'influencer'
  | 'tv'
  | 'national'

/** A bar the gym has to clear before an offer can be ordered at all. */
export interface CampaignRequirement {
  reputation?: number
  machines?: number
  members?: number
}

export interface Campaign {
  id: CampaignId
  /** Calendar days touched, including the day the campaign starts. */
  durationDays: number
  /** Taken at closing for every day the campaign was live. */
  dailyCost: number
  /** Multiplies the reputation-derived walk-in rate. */
  spawnMultiplier: number
  /**
   * Bends the rarity table the way the luck upgrade does, so the campaign
   * changes *who* walks in rather than only how many. Composes with the
   * player's own luck track and with every other campaign running.
   */
  clientLuck?: number
  /**
   * Feeds the same `luck` parameter `signupChance` already takes, so a
   * referral push converts more of the crowd into passes — and runs into the
   * same conversion ceiling, which is what stops it compounding away from the
   * rest of the economy.
   */
  signupBoost?: number
  /** Unset means the offer is available from the first day of trading. */
  requires?: CampaignRequirement
}

/**
 * True when footfall is the whole of what an offer sells, over a normal
 * multi-day run. These are the rungs of the ladder, and the ladder rule below
 * governs them alone: an offer that also buys better clients, better
 * conversion, or a single day's spike is priced against what it does, not
 * against the rung above it.
 */
export const isPureReach = (campaign: Campaign): boolean =>
  campaign.clientLuck === undefined &&
  campaign.signupBoost === undefined &&
  campaign.durationDays > 1

/**
 * The cheap run can pay for itself in a modest gym. Every rung after it
 * deliberately gets dearer faster than the traffic it buys — a billboard is
 * wasteful when the base rate is low and powerful only after reputation has
 * done its work, and the top rungs only make sense once there is a floor of kit
 * to put the crowd on. Longer commitments make that expensive choice a plan
 * rather than a toggle.
 *
 * The big reach offers exist because the ceiling moved. Footfall is multiplied
 * by `equipmentDraw` as well, so a fully kitted gym running billboards alone
 * was leaving its best machines idle — there was nothing left to buy that could
 * fill them.
 *
 * Three offers sit off that ladder on purpose, because a list of nine prices
 * for one number is a menu, not a decision:
 *
 * - `referral` barely moves the door. It sells conversion, so it is worth
 *   most to a gym that is already busy and bad at keeping people — and it is
 *   gated on a membership existing to refer anyone in the first place.
 * - `premium` sells the rarity table rather than the queue. A quarter more
 *   people, each of them worth appreciably more at the desk, which is a
 *   different purchase from a quarter more people.
 * - `openDay` is a single day at triple rate. Cheap per point of traffic and
 *   ruinous if the floor cannot seat the crowd, which is exactly the gamble.
 *
 * The unlocks are what make the back half of this table feel earned rather
 * than merely expensive: a television spot is a price, a national campaign is
 * a reputation the player had to build.
 */
export const CAMPAIGNS: Campaign[] = [
  { id: 'flyers', durationDays: 2, dailyCost: 120, spawnMultiplier: 1.2 },
  {
    id: 'referral',
    durationDays: 8,
    dailyCost: 300,
    spawnMultiplier: 1.15,
    signupBoost: 1.6,
    requires: { members: 15 },
  },
  { id: 'social', durationDays: 4, dailyCost: 450, spawnMultiplier: 1.45 },
  { id: 'billboards', durationDays: 6, dailyCost: 1_400, spawnMultiplier: 1.75 },
  {
    id: 'premium',
    durationDays: 6,
    dailyCost: 2_200,
    spawnMultiplier: 1.25,
    clientLuck: 2,
    requires: { reputation: 55 },
  },
  { id: 'openDay', durationDays: 1, dailyCost: 2_500, spawnMultiplier: 3 },
  { id: 'influencer', durationDays: 5, dailyCost: 3_600, spawnMultiplier: 2.05 },
  { id: 'tv', durationDays: 7, dailyCost: 9_000, spawnMultiplier: 2.4 },
  {
    id: 'national',
    durationDays: 9,
    dailyCost: 14_000,
    spawnMultiplier: 2.8,
    requires: { reputation: 75, machines: 20 },
  },
]

const BY_ID = new Map<CampaignId, Campaign>(CAMPAIGNS.map(campaign => [campaign.id, campaign]))

export function campaignById(id: CampaignId): Campaign {
  const campaign = BY_ID.get(id)
  if (!campaign) throw new Error(`Unknown campaign: ${id}`)
  return campaign
}

export function isCampaignId(value: unknown): value is CampaignId {
  return typeof value === 'string' && BY_ID.has(value as CampaignId)
}
