/**
 * The sponsorship deals on offer.
 *
 * OWNER: `feat/v2-sponsors`. Nobody else edits this file.
 *
 * Balance numbers belong here rather than in `constants.ts` — that file is
 * shared trunk, and a deal's payout is content, not a rule of the world.
 */
export type SponsorId = string

export interface Sponsor {
  id: SponsorId
}

/** Empty until the owner fills it in. */
export const SPONSORS: Sponsor[] = []
