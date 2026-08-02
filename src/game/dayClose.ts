import type { DayReport, GameState } from './types'
import { DAY_MS, DEBT_LIMIT } from './constants'
import { dailyCosts, emptyLedger } from './economy'
import { applyChurn, chargeRenewals } from './members'

/**
 * Settles 20:00 and freezes the game. Order matters: renewals and the bill are
 * both figured on the membership as it stood all day, and only then do the
 * unhappy ones quit — nobody escapes a bill for a day they used the place.
 *
 * The bill is never trimmed to fit the takings. Spend the last credit on a
 * machine and the invoice still arrives, which is what makes an unscanned
 * client hurt.
 */
export function closeDay(state: GameState): GameState {
  const cashBefore = state.cash

  const renewed = chargeRenewals(state).state
  const costs = dailyCosts(renewed)
  const { state: churnedState, churn } = applyChurn(renewed)

  const cash = churnedState.cash - costs.total
  const ledger = churnedState.today

  const report: DayReport = {
    day: state.day,
    entryFees: ledger.entryFees,
    subscriptions: ledger.subscriptions,
    signups: ledger.signups,
    churn,
    rent: costs.rent,
    power: costs.power,
    memberUpkeep: costs.memberUpkeep,
    bill: costs.total,
    net: ledger.entryFees + ledger.subscriptions - costs.total,
    cashBefore,
    cashAfter: cash,
    clientsServed: ledger.clientsServed,
    clientsLost: ledger.clientsLost,
  }

  return {
    ...churnedState,
    cash,
    dayMs: DAY_MS,
    dayEnded: true,
    dayReport: report,
    gameOver: state.gameOver || cash < DEBT_LIMIT,
    stats: {
      ...churnedState.stats,
      totalSpent: churnedState.stats.totalSpent + costs.total,
    },
  }
}

/**
 * The player's own hand on the calendar. Nothing else may advance the day —
 * a closed gym stays closed until someone opens it.
 */
export function nextDay(state: GameState): GameState {
  if (!state.dayEnded || state.gameOver) return state

  return {
    ...state,
    day: state.day + 1,
    dayMs: 0,
    dayEnded: false,
    today: emptyLedger(),
    // Everyone left at closing time; the floor is clear in the morning.
    clients: [],
    machines: state.machines.map(m => (m.occupiedBy === null ? m : { ...m, occupiedBy: null })),
  }
}
