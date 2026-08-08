/**
 * The advertising campaigns on offer.
 *
 * OWNER: `feat/v2-marketing`. Nobody else edits this file.
 *
 * Balance numbers belong here rather than in `constants.ts` — that file is
 * shared trunk, and what a flyer run costs is content, not a rule of the world.
 */
export type CampaignId = string

export interface Campaign {
  id: CampaignId
}

/** Empty until the owner fills it in. */
export const CAMPAIGNS: Campaign[] = []
