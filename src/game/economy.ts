import type { GameState } from './types'
import { machineType } from './content/machines'
import { DAY_MS, DAILY_RENT, DEBT_LIMIT, START_CASH, XP_PER_LEVEL, SAVE_VERSION } from './constants'

export function initialState(seed: number, now: number): GameState {
  return {
    version: SAVE_VERSION,
    cash: START_CASH,
    reputation: 0,
    satisfaction: 50,
    level: 1,
    xp: 0,
    machines: [],
    clients: [],
    seed,
    elapsedMs: 0,
    lastSeenAt: now,
    gameOver: false,
    stats: { totalEarned: 0, totalSpent: 0, clientsServed: 0, clientsLost: 0, daysPassed: 0 },
    nextUid: 1,
  }
}

export function entryFee(reputation: number): number {
  return 8 + Math.max(0, Math.min(100, reputation)) * 0.12
}

export function dailyCosts(state: GameState): number {
  const power = state.machines.reduce((sum, m) => sum + machineType(m.type).powerPerDay, 0)
  return DAILY_RENT + power
}

/**
 * Costs accrue continuously, pro-rated by dtMs. Cash is allowed below zero —
 * only crossing DEBT_LIMIT ends the run, so a player in the hole can trade
 * their way back out.
 */
export function chargeCosts(state: GameState, dtMs: number): GameState {
  const cost = dailyCosts(state) * (dtMs / DAY_MS)
  const cash = state.cash - cost
  return {
    ...state,
    cash,
    gameOver: state.gameOver || cash < DEBT_LIMIT,
    stats: { ...state.stats, totalSpent: state.stats.totalSpent + cost },
  }
}

export function addXp(state: GameState, amount: number): GameState {
  let xp = state.xp + amount
  let level = state.level
  while (xp >= XP_PER_LEVEL) {
    xp -= XP_PER_LEVEL
    level += 1
  }
  return { ...state, xp, level }
}
