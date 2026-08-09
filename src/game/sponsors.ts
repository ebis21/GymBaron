import type { GameState } from './types'
import { SPONSORS } from './content/sponsors'

/**
 * Sponsors: a brand pays the gym to be seen in it, for as long as the gym is
 * worth being seen in.
 *
 * OWNER: `feat/v2-sponsors`. Nobody else edits this file.
 *
 * What separates a sponsor from a campaign is the direction the money runs and
 * what it is conditional on. Advertising is cash out for more footfall;
 * sponsorship is cash in for hitting a bar the player has to keep clearing —
 * reputation, footfall, kit on the floor. Miss the bar and the deal lapses.
 */
export interface SponsorState {
  /**
   * Extended by the owner. Everything the feature remembers lives in here —
   * never as a new field on `GameState`.
   */
  readonly placeholder?: never
}

export const initialSponsors = (): SponsorState => ({})

/**
 * Fills in whatever a stored sub-state is missing, so the feature never needs
 * a save migration of its own. See `normalizeMarketing` for the reasoning.
 */
export function normalizeSponsors(raw: unknown): SponsorState {
  const base = initialSponsors()
  if (typeof raw !== 'object' || raw === null) return base
  return { ...base, ...(raw as SponsorState) }
}

export type SponsorAction = { type: 'noop' }

export function applySponsors(state: GameState, action: SponsorAction): GameState {
  switch (action.type) {
    case 'noop':
      return state
  }
}

/** Per-tick advance — live tracking of whatever a deal is measured on. */
export function advanceSponsors(state: GameState, _dtMs: number): GameState {
  return state
}

/**
 * Day settlement. Pays out whatever the deals earned and records it in
 * `today.sponsorIncome`, which is what the receipt prints. This is the one of
 * the three settlers that puts money *into* the till.
 */
export function settleSponsors(state: GameState): GameState {
  return state
}

/** Every deal on the table, in the order the screen lists them. */
export const sponsors = () => SPONSORS
