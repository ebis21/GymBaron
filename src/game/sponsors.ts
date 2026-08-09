import type { GameState, Stain } from './types'
import { machinesAcrossFloors } from './floors'
import {
  type ConditionKind,
  type SponsorCondition,
  type SponsorId,
  SPONSORS,
  STRIKES_TO_LAPSE,
  isConditionKind,
  isSponsorId,
  isStanding,
  sponsorDeal,
} from './content/sponsors'

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
  /** The one deal running. Exactly one at a time; signing another ends this. */
  activeId: SponsorId | null
  /**
   * Day the active deal was signed. It starts paying the day *after*, so a
   * signature at 19:00 is never judged on a day the brand did not see.
   */
  signedDay: number
  /** Missed days in a row. `STRIKES_TO_LAPSE` of them ends the deal. */
  strikes: number
  /** Deals broken once already. Signing one again costs its `resignFee`. */
  lapsed: SponsorId[]
  /**
   * The dirtiest the gym got today, not how dirty it is now. Cleanliness is the
   * one condition that could otherwise be met by mopping at 19:59, which would
   * make it a chore rather than a standard.
   */
  worstStains: number
  /**
   * Which conditions failed the last time a day was judged. The screen turns
   * this into a sentence — a player who loses a deal is owed the reason.
   */
  lastMiss: ConditionKind[]
}

export const initialSponsors = (): SponsorState => ({
  activeId: null,
  signedDay: 0,
  strikes: 0,
  lapsed: [],
  worstStains: 0,
  lastMiss: [],
})

const numberOr = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback

/**
 * Fills in whatever a stored sub-state is missing, so the feature never needs
 * a save migration of its own. See `normalizeMarketing` for the reasoning.
 *
 * Every field is read defensively rather than spread wholesale: this runs on
 * whatever is in storage, including a save written before a field existed and
 * one naming a deal since taken off the board.
 */
export function normalizeSponsors(raw: unknown): SponsorState {
  const base = initialSponsors()
  if (typeof raw !== 'object' || raw === null) return base

  const stored = raw as Partial<Record<keyof SponsorState, unknown>>
  const lapsed = Array.isArray(stored.lapsed) ? stored.lapsed.filter(isSponsorId) : []

  return {
    activeId: isSponsorId(stored.activeId) ? stored.activeId : null,
    signedDay: numberOr(stored.signedDay, 0),
    strikes: numberOr(stored.strikes, 0),
    lapsed: [...new Set(lapsed)],
    worstStains: numberOr(stored.worstStains, 0),
    lastMiss: Array.isArray(stored.lastMiss) ? stored.lastMiss.filter(isConditionKind) : [],
  }
}

/**
 * Stains on every storey, not just the one being looked at. The active floor is
 * mirrored at the top level while the rest live in their plans — the same rule
 * `machinesAcrossFloors` follows, and for the same reason: a brand is paying to
 * be seen in the whole gym, so dirt upstairs still counts.
 */
function stainsAcrossFloors(state: GameState): Stain[] {
  if (state.floorPlans.length === 0) return state.stains
  return state.floorPlans.flatMap((plan, floor) => (
    floor === state.activeFloor ? state.stains : plan.stains
  ))
}

/** What the gym currently measures on a given condition. */
export function currentValue(state: GameState, kind: ConditionKind): number {
  switch (kind) {
    case 'reputation':
      return state.reputation
    case 'machines':
      return machinesAcrossFloors(state).length
    case 'clientsServed':
      return state.today.clientsServed
    case 'cleanliness':
      return Math.max(state.sponsors.worstStains, stainsAcrossFloors(state).length)
  }
}

/** Cleanliness is a ceiling; everything else is a floor. */
const holds = (condition: SponsorCondition, value: number): boolean =>
  condition.kind === 'cleanliness' ? value <= condition.value : value >= condition.value

export interface ConditionStatus {
  kind: ConditionKind
  target: number
  current: number
  met: boolean
  /** Whether this one is judged at signing as well as at the day's close. */
  standing: boolean
}

/** Every condition of a deal against what the gym is doing right now. */
export function conditionStatuses(state: GameState, id: SponsorId): ConditionStatus[] {
  return sponsorDeal(id).conditions.map(condition => {
    const current = currentValue(state, condition.kind)
    return {
      kind: condition.kind,
      target: condition.value,
      current,
      met: holds(condition, current),
      standing: isStanding(condition.kind),
    }
  })
}

/** What signing costs today: nothing, unless this deal was broken before. */
export const signCost = (state: GameState, id: SponsorId): number =>
  state.sponsors.lapsed.includes(id) ? sponsorDeal(id).resignFee : 0

/**
 * A brand signs a gym that already looks the part and pays it to stay that way.
 * So only the standing conditions gate the signature — demanding a day's
 * footfall up front would make every deal unsignable before lunchtime, and
 * demanding a clean floor would make it a matter of when the player asked.
 */
export const canSign = (state: GameState, id: SponsorId): boolean =>
  !state.gameOver
  && state.sponsors.activeId !== id
  && state.cash >= signCost(state, id)
  && conditionStatuses(state, id).every(c => !c.standing || c.met)

export type SponsorAction =
  | { type: 'sign'; id: SponsorId }
  | { type: 'drop' }

/**
 * Returns the state unchanged when it refuses, which is what the store's
 * identity check reads as "nothing happened" — same contract as `buyUpgrade`.
 */
export function applySponsors(state: GameState, action: SponsorAction): GameState {
  switch (action.type) {
    case 'sign': {
      if (!canSign(state, action.id)) return state

      const fee = signCost(state, action.id)

      return {
        ...state,
        cash: state.cash - fee,
        // The fee is spent the moment it is paid, exactly like a machine or an
        // upgrade. It deliberately never reaches `today.sponsorIncome`, which
        // is an income line — netting the two off there would print a deal that
        // paid nothing as a deal that cost nothing.
        stats: { ...state.stats, totalSpent: state.stats.totalSpent + fee },
        sponsors: {
          ...state.sponsors,
          activeId: action.id,
          signedDay: state.day,
          strikes: 0,
          lastMiss: [],
          lapsed: state.sponsors.lapsed.filter(id => id !== action.id),
          // Today's dirt carries into the new deal rather than starting at
          // nought: signing does not unmop a floor.
          worstStains: stainsAcrossFloors(state).length,
        },
      }
    }

    /**
     * Walking away is free and leaves no mark. Only a deal the player failed to
     * hold up counts as broken — charging for the honest exit would just teach
     * people to sit on a deal they cannot meet and eat the strikes instead.
     */
    case 'drop':
      if (state.sponsors.activeId === null) return state
      return {
        ...state,
        sponsors: { ...state.sponsors, activeId: null, strikes: 0, lastMiss: [] },
      }
  }
}

/**
 * Per-tick advance — live tracking of whatever a deal is measured on.
 *
 * Only cleanliness needs watching: reputation and kit are true of the gym at
 * any moment and clients served only ever climbs, so both are the same answer
 * at 20:00 as they were all day. Dirt is not, which is the whole reason this
 * runs every tick instead of once at the close.
 */
export function advanceSponsors(state: GameState, _dtMs: number): GameState {
  if (state.sponsors.activeId === null) return state

  const stains = stainsAcrossFloors(state).length
  if (stains <= state.sponsors.worstStains) return state

  return { ...state, sponsors: { ...state.sponsors, worstStains: stains } }
}

/**
 * Day settlement. Pays out whatever the deals earned and records it in
 * `today.sponsorIncome`, which is what the receipt prints. This is the one of
 * the three settlers that puts money *into* the till.
 *
 * It runs before the bill and before payroll, so a sponsor's cheque can be what
 * meets a wage — a gym that is run well can carry a payroll it could not
 * otherwise afford, which is the point of the whole system.
 */
export function settleSponsors(state: GameState): GameState {
  const { activeId, signedDay, strikes } = state.sponsors
  if (activeId === null) return state

  // Tomorrow is judged on tomorrow's dirt. Reset to what is on the floor now
  // rather than to nought — nobody mops overnight.
  const worstStains = stainsAcrossFloors(state).length

  // A deal signed today has not had a day yet. No pay, and no strike either:
  // being judged on the hours before the signature is the kind of unfairness
  // that reads as a bug.
  if (signedDay >= state.day) {
    return { ...state, sponsors: { ...state.sponsors, worstStains } }
  }

  const missed = conditionStatuses(state, activeId).filter(c => !c.met)

  if (missed.length === 0) {
    const { payout } = sponsorDeal(activeId)
    return {
      ...state,
      cash: state.cash + payout,
      today: { ...state.today, sponsorIncome: state.today.sponsorIncome + payout },
      stats: { ...state.stats, totalEarned: state.stats.totalEarned + payout },
      sponsors: { ...state.sponsors, strikes: 0, lastMiss: [], worstStains },
    }
  }

  const nextStrikes = strikes + 1
  const lapsing = nextStrikes >= STRIKES_TO_LAPSE

  return {
    ...state,
    sponsors: {
      ...state.sponsors,
      activeId: lapsing ? null : activeId,
      strikes: lapsing ? 0 : nextStrikes,
      lapsed: lapsing ? [...state.sponsors.lapsed, activeId] : state.sponsors.lapsed,
      lastMiss: missed.map(c => c.kind),
      worstStains,
    },
  }
}

/** Every deal on the table, in the order the screen lists them. */
export const sponsors = () => SPONSORS
