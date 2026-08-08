import type { GameState } from './types'
import { DAY_MS } from './constants'
import {
  CAMPAIGNS,
  type CampaignId,
  campaignById,
  isCampaignId,
} from './content/campaigns'

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
  activeCampaignId: CampaignId | null
  /** Open-gym milliseconds until the final advertised closing time. */
  remainingMs: number
  /**
   * Kept separately because the campaign expires at 20:00 just before the
   * till settles. The final day's invoice must survive that last tick.
   */
  billableCampaignId: CampaignId | null
}

export const initialMarketing = (): MarketingState => ({
  activeCampaignId: null,
  remainingMs: 0,
  billableCampaignId: null,
})

/**
 * Fills in whatever a stored sub-state is missing. This is why the feature
 * needs no save migration of its own: `deserialize` runs it over every load, so
 * a field added here tomorrow lands on yesterday's save with its default.
 * Owner: default every new field, never throw.
 */
export function normalizeMarketing(raw: unknown): MarketingState {
  const base = initialMarketing()
  if (typeof raw !== 'object' || raw === null) return base

  const stored = raw as Record<string, unknown>
  const activeCampaignId = isCampaignId(stored.activeCampaignId)
    ? stored.activeCampaignId
    : null
  const billableCampaignId = isCampaignId(stored.billableCampaignId)
    ? stored.billableCampaignId
    : null
  const storedRemaining = stored.remainingMs
  const remainingMs = activeCampaignId !== null &&
      typeof storedRemaining === 'number' && Number.isFinite(storedRemaining)
    ? Math.max(0, storedRemaining)
    : 0

  return {
    activeCampaignId: remainingMs > 0 ? activeCampaignId : null,
    remainingMs,
    billableCampaignId,
  }
}

/**
 * Everything the player can do to advertising, as one union. The store
 * dispatches it blind, so adding a campaign type is a change to this file and
 * to the screen — never to `gameStore.ts`.
 */
export type MarketingAction = { type: 'start'; campaignId: CampaignId }

export function applyMarketing(state: GameState, action: MarketingAction): GameState {
  switch (action.type) {
    case 'start': {
      if (
        state.gameOver ||
        state.dayEnded ||
        state.dayMs >= DAY_MS ||
        state.marketing.activeCampaignId !== null
      ) return state

      const campaign = campaignById(action.campaignId)
      // No up-front fee, but the first invoice must be credible when the ad is
      // ordered. Later bills may still put the gym into debt, just like rent.
      if (state.cash < campaign.dailyCost) return state

      return {
        ...state,
        marketing: {
          activeCampaignId: campaign.id,
          // Starting at noon still buys the advertised number of calendar
          // days: what remains today, then whole days up to the final close.
          remainingMs: campaign.durationDays * DAY_MS - state.dayMs,
          billableCampaignId: campaign.id,
        },
      }
    }
  }
}

/** Per-tick advance. Runs inside the simulation's system list. */
export function advanceMarketing(state: GameState, dtMs: number): GameState {
  const activeId = state.marketing.activeCampaignId
  if (activeId === null || state.gameOver || state.dayEnded || dtMs <= 0) return state

  // The floor may keep draining after 20:00, but advertising buys open-door
  // time. Letting the after-hours tail consume it would make a busy gym lose
  // more of a campaign than an empty one.
  const openMs = Math.min(dtMs, Math.max(0, DAY_MS - state.dayMs))
  if (openMs <= 0) return state

  const remainingMs = Math.max(0, state.marketing.remainingMs - openMs)
  return {
    ...state,
    marketing: {
      activeCampaignId: remainingMs > 0 ? activeId : null,
      remainingMs,
      billableCampaignId: activeId,
    },
  }
}

/**
 * Day settlement. Charges campaign costs out of `cash` and records what was
 * spent in `today.marketingSpend`, which is what the receipt prints.
 */
export function settleMarketing(state: GameState): GameState {
  const billableId = state.marketing.billableCampaignId
  if (billableId === null) return state

  const cost = campaignById(billableId).dailyCost
  return {
    ...state,
    cash: state.cash - cost,
    marketing: { ...state.marketing, billableCampaignId: null },
    today: { ...state.today, marketingSpend: state.today.marketingSpend + cost },
    stats: { ...state.stats, totalSpent: state.stats.totalSpent + cost },
  }
}

/**
 * How much advertising multiplies walk-in arrivals. 1 is the game with no
 * campaign running, and the spawner treats it as a plain factor on the rate.
 */
export function spawnRateMultiplier(state: GameState): number {
  const activeId = state.marketing.activeCampaignId
  return activeId === null ? 1 : campaignById(activeId).spawnMultiplier
}

/** Every campaign the player could ever buy, in the order the screen lists them. */
export const campaigns = () => CAMPAIGNS
