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
export interface RunningCampaign {
  id: CampaignId
  /** Open-gym milliseconds until this campaign's final advertised close. */
  remainingMs: number
}

export interface MarketingState {
  /** Every campaign live right now, in the order they were ordered. */
  running: RunningCampaign[]
  /**
   * Kept separately because a campaign expires at 20:00 just before the till
   * settles. The final day's invoice must survive that last tick, so this is
   * every campaign that was live at any point today, not just the survivors.
   */
  billable: CampaignId[]
}

export const initialMarketing = (): MarketingState => ({ running: [], billable: [] })

const uniqueIds = (ids: CampaignId[]): CampaignId[] => [...new Set(ids)]

/**
 * Reads one stored entry, or null if it is unusable. A clock past the
 * campaign's own advertised length is clamped rather than dropped: a
 * hand-edited save should lose the cheat, not the campaign.
 */
function readRunning(raw: unknown): RunningCampaign | null {
  if (typeof raw !== 'object' || raw === null) return null
  const stored = raw as Record<string, unknown>
  if (!isCampaignId(stored.id)) return null

  const ms = stored.remainingMs
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return null
  return { id: stored.id, remainingMs: Math.min(ms, campaignById(stored.id).durationDays * DAY_MS) }
}

/**
 * Fills in whatever a stored sub-state is missing. This is why the feature
 * needs no save migration of its own: `deserialize` runs it over every load, so
 * a field added here tomorrow lands on yesterday's save with its default.
 * Owner: default every new field, never throw.
 *
 * It also reads the single-campaign shape this feature shipped with, where the
 * live offer was `activeCampaignId` and its invoice `billableCampaignId`. A
 * save written before campaigns could run side by side is a perfectly good
 * save, and rewriting it as a one-entry list is the whole of the upgrade.
 */
export function normalizeMarketing(raw: unknown): MarketingState {
  if (typeof raw !== 'object' || raw === null) return initialMarketing()
  const stored = raw as Record<string, unknown>

  const running = Array.isArray(stored.running)
    ? stored.running.map(readRunning).filter((r): r is RunningCampaign => r !== null)
    : [readRunning({ id: stored.activeCampaignId, remainingMs: stored.remainingMs })]
        .filter((r): r is RunningCampaign => r !== null)

  // One entry per offer: two clocks on the same campaign is not a state the
  // game can produce, and honouring it would bill it twice.
  const deduped = running.filter(
    (r, i) => running.findIndex(other => other.id === r.id) === i,
  )

  const billableRaw = Array.isArray(stored.billable)
    ? stored.billable.filter(isCampaignId)
    : isCampaignId(stored.billableCampaignId) ? [stored.billableCampaignId] : []

  return { running: deduped, billable: uniqueIds(billableRaw) }
}

/**
 * Everything the player can do to advertising, as one union. The store
 * dispatches it blind, so adding a campaign type is a change to this file and
 * to the screen — never to `gameStore.ts`.
 */
export type MarketingAction = { type: 'start'; campaignId: CampaignId }

/** Combined daily fee of everything currently live. */
export const dailyMarketingCost = (state: GameState): number =>
  state.marketing.running.reduce((sum, r) => sum + campaignById(r.id).dailyCost, 0)

export function applyMarketing(state: GameState, action: MarketingAction): GameState {
  switch (action.type) {
    case 'start': {
      if (state.gameOver || state.dayEnded || state.dayMs >= DAY_MS) return state

      // Campaigns stack, but not with themselves — re-ordering a live offer
      // would silently reset its clock rather than buying anything.
      if (state.marketing.running.some(r => r.id === action.campaignId)) return state

      const campaign = campaignById(action.campaignId)
      // No up-front fee, but the first invoice must be credible when the ad is
      // ordered — and that invoice now covers everything running at once.
      // Later bills may still put the gym into debt, just like rent.
      if (state.cash < dailyMarketingCost(state) + campaign.dailyCost) return state

      return {
        ...state,
        marketing: {
          running: [
            ...state.marketing.running,
            // Starting at noon still buys the advertised number of calendar
            // days: what remains today, then whole days up to the final close.
            { id: campaign.id, remainingMs: campaign.durationDays * DAY_MS - state.dayMs },
          ],
          billable: uniqueIds([...state.marketing.billable, campaign.id]),
        },
      }
    }
  }
}

/** Per-tick advance. Runs inside the simulation's system list. */
export function advanceMarketing(state: GameState, dtMs: number): GameState {
  const { running, billable } = state.marketing
  if (running.length === 0 || state.gameOver || state.dayEnded || dtMs <= 0) return state

  // The floor may keep draining after 20:00, but advertising buys open-door
  // time. Letting the after-hours tail consume it would make a busy gym lose
  // more of a campaign than an empty one.
  const openMs = Math.min(dtMs, Math.max(0, DAY_MS - state.dayMs))
  if (openMs <= 0) return state

  const advanced = running
    .map(r => ({ id: r.id, remainingMs: Math.max(0, r.remainingMs - openMs) }))

  return {
    ...state,
    marketing: {
      running: advanced.filter(r => r.remainingMs > 0),
      // Anything that was live during this tick is owed for today, including
      // whatever just ran out on it.
      billable: uniqueIds([...billable, ...running.map(r => r.id)]),
    },
  }
}

/**
 * Day settlement. Charges every campaign that was live today out of `cash` and
 * records the total in `today.marketingSpend`, which is what the receipt
 * prints. Running three offers at once means three fees on one invoice.
 */
export function settleMarketing(state: GameState): GameState {
  const { billable } = state.marketing
  if (billable.length === 0) return state

  const cost = billable.reduce((sum, id) => sum + campaignById(id).dailyCost, 0)
  return {
    ...state,
    cash: state.cash - cost,
    marketing: { ...state.marketing, billable: [] },
    today: { ...state.today, marketingSpend: state.today.marketingSpend + cost },
    stats: { ...state.stats, totalSpent: state.stats.totalSpent + cost },
  }
}

/**
 * How much advertising multiplies walk-in arrivals. 1 is the game with no
 * campaign running, and the spawner treats it as a plain factor on the rate.
 *
 * Campaigns compound: running billboards and a television spot together is
 * their two multipliers multiplied, not the better of the pair. Paying two
 * daily fees has to beat paying one, and the door is bounded by how many
 * machines are actually free anyway — see `acceptingArrivals` — so stacking
 * buys a fuller gym rather than an unbounded queue.
 */
export function spawnRateMultiplier(state: GameState): number {
  return state.marketing.running.reduce(
    (product, r) => product * campaignById(r.id).spawnMultiplier,
    1,
  )
}

/** Ids live right now, for the screen and for the traffic projection. */
export const runningCampaigns = (state: GameState): CampaignId[] =>
  state.marketing.running.map(r => r.id)

/** Every campaign the player could ever buy, in the order the screen lists them. */
export const campaigns = () => CAMPAIGNS
