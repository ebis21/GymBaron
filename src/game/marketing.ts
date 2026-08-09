import type { GameState } from './types'
import { CAMPAIGNS } from './content/campaigns'

/**
 * Advertising: what the player pays to bring more people through the door.
 *
 * OWNER: `feat/v2-marketing`. Nobody else edits this file.
 *
 * The seam around it is fixed. Every hook the rest of the game needs is
 * already called from the shared files — `advanceMarketing` from the tick,
 * `settleMarketing` from the day close, `spawnRateMultiplier` from the client
 * spawner, `applyMarketing` from the store. Filling them in requires no change
 * anywhere outside this module, its content table, its screen and its
 * dictionary. That is the whole point: three branches, one shared trunk that
 * nobody has to touch twice.
 */
export interface MarketingState {
  /**
   * Extended by the owner. Everything the feature remembers lives in here —
   * never as a new field on `GameState`, which is the one file all three
   * branches would otherwise collide in.
   */
  readonly placeholder?: never
}

export const initialMarketing = (): MarketingState => ({})

/**
 * Fills in whatever a stored sub-state is missing. This is why the feature
 * needs no save migration of its own: `deserialize` runs it over every load, so
 * a field added here tomorrow lands on yesterday's save with its default.
 * Owner: default every new field, never throw.
 */
export function normalizeMarketing(raw: unknown): MarketingState {
  const base = initialMarketing()
  if (typeof raw !== 'object' || raw === null) return base
  return { ...base, ...(raw as MarketingState) }
}

/**
 * Everything the player can do to advertising, as one union. The store
 * dispatches it blind, so adding a campaign type is a change to this file and
 * to the screen — never to `gameStore.ts`.
 */
export type MarketingAction = { type: 'noop' }

export function applyMarketing(state: GameState, action: MarketingAction): GameState {
  switch (action.type) {
    case 'noop':
      return state
  }
}

/** Per-tick advance. Runs inside the simulation's system list. */
export function advanceMarketing(state: GameState, _dtMs: number): GameState {
  return state
}

/**
 * Day settlement. Charges campaign costs out of `cash` and records what was
 * spent in `today.marketingSpend`, which is what the receipt prints.
 */
export function settleMarketing(state: GameState): GameState {
  return state
}

/**
 * How much advertising multiplies walk-in arrivals. 1 is the game with no
 * campaign running, and the spawner treats it as a plain factor on the rate.
 */
export function spawnRateMultiplier(_state: GameState): number {
  return 1
}

/** Every campaign the player could ever buy, in the order the screen lists them. */
export const campaigns = () => CAMPAIGNS
