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

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

/**
 * Odds that a walk-in who just finished a workout buys a pass. A miserable
 * gym still converts the occasional enthusiast; a great one never converts
 * everybody.
 */
export function signupChance(satisfaction: number): number {
  return SIGNUP_BASE + clamp01(satisfaction / 100) * SIGNUP_PER_SATISFACTION
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

export interface RenewalResult {
  state: GameState
  amount: number
  count: number
}

/**
 * Every member renews on their own seven-day cycle counted from the day they
 * joined, so passes trickle in across the week instead of all landing on the
 * same evening. Priced at today's gym class — upgrading the floor raises what
 * existing members pay on their next renewal.
 */
export function chargeRenewals(state: GameState): RenewalResult {
  const due = state.members.filter(m => {
    const age = state.day - m.joinedDay
    return age > 0 && age % BILLING_PERIOD_DAYS === 0
  })
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
