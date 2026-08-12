import type { GameState, Member } from './types'
import { BILLING_PERIOD_DAYS } from './constants'
import { passPrice } from './economy'

/**
 * Conversion was tuned against a gym that served a handful of people a day by
 * hand. With the desk working, a 40% top rate meant a dozen-plus passes sold
 * every day on top of the renewals they had already generated, and the
 * membership — and with it the subscription income — compounded away from the
 * rest of the economy. Topping out near a fifth keeps a full house something
 * the player builds over a week rather than stumbles into on day three.
 */
const SIGNUP_BASE = 0.03
const SIGNUP_PER_SATISFACTION = 0.15
const CHURN_BASE = 0.02
const CHURN_PER_UNHAPPY = 0.08

/**
 * What the luck track is worth at the desk, and the wall it runs into.
 *
 * The ceiling is not optional. The comment above records why conversion came
 * down from 40% in the first place: at that rate the membership — and with it
 * the subscription income — pulled away from the rest of the economy. An
 * upgrade has no business undoing that fix, so luck raises the odds but can
 * never push them past a shade above today's best case (0.18).
 *
 * The side effect is the good kind. At full satisfaction the base already sits
 * just under the ceiling, so luck buys almost nothing there; at the 0.03–0.12
 * a middling gym actually runs at, it buys plenty. Luck rescues a struggling
 * gym rather than gilding a thriving one.
 */
const SIGNUP_PER_LUCK = 0.30
const SIGNUP_CEILING = 0.24

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

/**
 * Odds that a walk-in who just finished a workout buys a pass. A miserable
 * gym still converts the occasional enthusiast; a great one never converts
 * everybody.
 *
 * `luck` defaults to the unupgraded game, so existing callers are unaffected.
 */
export function signupChance(satisfaction: number, luck = 1): number {
  const base = SIGNUP_BASE + clamp01(satisfaction / 100) * SIGNUP_PER_SATISFACTION
  const lucky = base * (1 + Math.max(0, luck - 1) * SIGNUP_PER_LUCK)
  return Math.min(SIGNUP_CEILING, lucky)
}

/**
 * Enrols a new member and takes their first pass immediately — signing up is
 * itself a sale, not a promise of one seven days out.
 */
export function addMember(state: GameState): GameState {
  const fee = passPrice(state)
  const member: Member = { uid: `p${state.nextUid}`, joinedDay: state.day }

  return {
    ...state,
    cash: state.cash + fee,
    nextUid: state.nextUid + 1,
    members: [...state.members, member],
    today: {
      ...state.today,
      subscriptions: state.today.subscriptions + fee,
      signups: state.today.signups + 1,
    },
    stats: {
      ...state.stats,
      totalEarned: state.stats.totalEarned + fee,
      membersJoined: state.stats.membersJoined + 1,
    },
  }
}

/**
 * The whole gym bills on one seven-day week: days 7, 14, 21 and so on are
 * payday, and every pass in the building is charged that evening.
 *
 * Each member used to renew on their own cycle counted from the day they
 * joined. The weekly total was the same, but it arrived as one or two passes a
 * night, blended into the same receipt line as that day's signups — so the
 * money was invisible, and a pass read as a one-off sale that never came back.
 * Collected all at once it is a payday the player can see coming, plan around
 * and feel land.
 */
export const isPayday = (day: number): boolean => day % BILLING_PERIOD_DAYS === 0

/** Days until the next payday; zero on payday itself. */
export const daysToPayday = (day: number): number =>
  isPayday(day) ? 0 : BILLING_PERIOD_DAYS - (day % BILLING_PERIOD_DAYS)

export interface RenewalResult {
  state: GameState
  amount: number
  count: number
}

/**
 * Collects every pass in the building, but only on payday. Priced at today's
 * gym class — upgrading the floor raises what existing members pay on the next
 * collection, which is what makes a purchase worth more than the door fee it
 * lifts.
 *
 * Anyone who joined today is skipped: their first pass was banked at the desk
 * hours ago, and charging it twice on the same receipt would read as a bug.
 */
export function chargeRenewals(state: GameState): RenewalResult {
  if (!isPayday(state.day)) return { state, amount: 0, count: 0 }

  const due = state.members.filter(m => m.joinedDay < state.day)
  if (due.length === 0) return { state, amount: 0, count: 0 }

  const amount = passPrice(state) * due.length
  return {
    state: {
      ...state,
      cash: state.cash + amount,
      today: { ...state.today, subscriptions: state.today.subscriptions + amount },
      stats: { ...state.stats, totalEarned: state.stats.totalEarned + amount },
    },
    amount,
    count: due.length,
  }
}

export interface ChurnResult {
  state: GameState
  churn: number
}

/**
 * Neglect empties the gym. The newest members walk first — loyalty is earned
 * over time — and anyone who signed up today is safe, so a signup can never
 * be undone by the same evening's bill.
 */
export function applyChurn(state: GameState): ChurnResult {
  const eligible = state.members.filter(m => m.joinedDay < state.day)
  if (eligible.length === 0) return { state, churn: 0 }

  const unhappiness = 1 - clamp01(state.satisfaction / 100)
  const rate = CHURN_BASE + unhappiness * CHURN_PER_UNHAPPY
  const churn = Math.min(eligible.length, Math.round(eligible.length * rate))
  if (churn === 0) return { state, churn: 0 }

  const leaving = new Set(eligible.slice(-churn).map(m => m.uid))
  const members = state.members.filter(m => !leaving.has(m.uid))

  return {
    state: {
      ...state,
      members,
      // A member who quit is not standing in the queue tomorrow either.
      clients: state.clients.filter(c => c.memberUid === null || !leaving.has(c.memberUid)),
      stats: { ...state.stats, membersLost: state.stats.membersLost + churn },
    },
    churn,
  }
}
