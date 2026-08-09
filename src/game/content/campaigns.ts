/**
 * The advertising campaigns on offer.
 *
 * OWNER: `feat/v2-marketing`. Nobody else edits this file.
 *
 * Balance numbers belong here rather than in `constants.ts` — that file is
 * shared trunk, and what a flyer run costs is content, not a rule of the world.
 */
export type CampaignId = 'flyers' | 'social' | 'billboards'

export interface Campaign {
  id: CampaignId
  /** Calendar days touched, including the day the campaign starts. */
  durationDays: number
  /** Taken at closing for every day the campaign was live. */
  dailyCost: number
  /** Multiplies the reputation-derived walk-in rate. */
  spawnMultiplier: number
}

/**
 * The cheap run can pay for itself in a modest gym. The larger two deliberately
 * get dearer faster than the traffic they buy: a billboard is wasteful when
 * the base rate is low and powerful only after reputation has done its work.
 * Longer commitments make that expensive choice a plan rather than a toggle.
 */
export const CAMPAIGNS: Campaign[] = [
  { id: 'flyers', durationDays: 2, dailyCost: 120, spawnMultiplier: 1.2 },
  { id: 'social', durationDays: 4, dailyCost: 450, spawnMultiplier: 1.45 },
  { id: 'billboards', durationDays: 6, dailyCost: 1_400, spawnMultiplier: 1.75 },
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
