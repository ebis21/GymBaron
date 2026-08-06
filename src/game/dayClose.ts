import type { DayReport, GameState, Staff } from './types'
import { DAY_MS, DEBT_LIMIT } from './constants'
import { isClosingTime } from './clock'
import { dailyCosts, emptyLedger } from './economy'
import { applyChurn, chargeRenewals } from './members'
import { wageFor } from './content/staff'
import { onDuty } from './staff'
import { ensurePool } from './recruit'

/**
 * Settles the payroll out of whatever is left after the bill, in hiring order,
 * each wage in full or not at all — no part payments.
 *
 * Whoever misses out is not sacked; they simply stop turning up until the
 * player clears the arrears from the staff panel. A strike costs the automation
 * without destroying a legendary hire it took a week of play to land. Nobody on
 * strike is billed again, so the debt can never run away.
 */
export function payWages(state: GameState, budget: number): {
  staff: Staff[]
  paid: number
} {
  if (state.staff.length === 0) return { staff: state.staff, paid: 0 }

  let left = budget
  let paid = 0

  const staff = state.staff.map(s => {
    if (!onDuty(s)) return s // already on strike; not billed twice

    const wage = wageFor(s.role, s.rank)
    if (wage <= left) {
      left -= wage
      paid += wage
      return s
    }
    return { ...s, owed: wage, targetUid: null, workMs: 0 }
  })

  return { staff, paid }
}

/**
 * Cashes up and freezes the game. Order matters: renewals and the bill are
 * both figured on the membership as it stood all day, and only then do the
 * unhappy ones quit — nobody escapes a bill for a day they used the place.
 *
 * The bill is never trimmed to fit the takings. Spend the last credit on a
 * machine and the invoice still arrives, which is what makes an unscanned
 * client hurt.
 *
 * Nothing calls this on a timer. The clock stopping at 20:00 only shuts the
 * door; the player locks up when they are done rearranging the place, and this
 * is that button. It refuses to run early so a stray call cannot cash up a
 * morning, and refuses to run twice on the same day.
 */
export function closeDay(state: GameState): GameState {
  if (state.dayEnded || state.gameOver || !isClosingTime(state.dayMs)) return state

  const cashBefore = state.cash

  const renewed = chargeRenewals(state).state
  const costs = dailyCosts(renewed)
  const { state: churnedState, churn } = applyChurn(renewed)

  const cash = churnedState.cash - costs.total
  const payroll = payWages(churnedState, cash)
  const cashAfterWages = cash - payroll.paid
  const ledger = churnedState.today

  const report: DayReport = {
    day: state.day,
    entryFees: ledger.entryFees,
    trainerFees: ledger.trainerFees,
    subscriptions: ledger.subscriptions,
    counterfeitLoss: ledger.counterfeitLoss,
    signups: ledger.signups,
    churn,
    rent: costs.rent,
    power: costs.power,
    memberUpkeep: costs.memberUpkeep,
    wages: payroll.paid,
    bill: costs.total,
    net: ledger.entryFees + ledger.subscriptions - ledger.counterfeitLoss - costs.total - payroll.paid,
    cashBefore,
    cashAfter: cashAfterWages,
    clientsServed: ledger.clientsServed,
    clientsLost: ledger.clientsLost,
  }

  return {
    ...churnedState,
    cash: cashAfterWages,
    staff: payroll.staff,
    dayMs: DAY_MS,
    dayEnded: true,
    dayReport: report,
    gameOver: state.gameOver || cashAfterWages < DEBT_LIMIT,
    stats: {
      ...churnedState.stats,
      totalSpent: churnedState.stats.totalSpent + costs.total + payroll.paid,
    },
  }
}

/**
 * The player's own hand on the calendar. Nothing else may advance the day —
 * a closed gym stays closed until someone opens it.
 */
export function nextDay(state: GameState): GameState {
  if (!state.dayEnded || state.gameOver) return state

  return ensurePool({
    ...state,
    day: state.day + 1,
    dayMs: 0,
    dayEnded: false,
    today: emptyLedger(),
    // Everyone left at closing time; the floor is clear in the morning.
    clients: [],
    machines: state.machines.map(m => (m.occupiedBy === null ? m : { ...m, occupiedBy: null })),
  })
}
