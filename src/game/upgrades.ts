import type { GameState } from './types'
import {
  type UpgradeId,
  nextUpgrade,
  upgradeValueAt,
} from './content/upgrades'

/**
 * How many rungs of a track the player has paid for. Reads through a missing
 * or corrupt entry as zero, so a hand-edited save degrades to the unupgraded
 * game rather than to `NaN` spreading through the economy.
 */
export function upgradeLevel(state: GameState, id: UpgradeId): number {
  const level = state.upgrades?.[id]
  return typeof level === 'number' && Number.isFinite(level) ? level : 0
}

/** What a track is worth right now. */
export function upgradeValue(state: GameState, id: UpgradeId): number {
  return upgradeValueAt(id, upgradeLevel(state, id))
}

// Named readers for the five call sites. They exist so the engine never has to
// remember which string keys a track, and so a renamed id is a compile error in
// one file rather than a silent `base` value everywhere.

/** Hold time on a stain, in ms. */
export const cleanHoldMs = (state: GameState): number => upgradeValue(state, 'cleaning')

/** Hold time on a dead machine, in ms. */
export const repairHoldMs = (state: GameState): number => upgradeValue(state, 'repair')

/** Multiplier on the door fee. Passes are priced by gym class and stay out of it. */
export const earningsMult = (state: GameState): number => upgradeValue(state, 'earnings')

/** Weights the rarity table and nudges pass conversion. */
export const luckMult = (state: GameState): number => upgradeValue(state, 'luck')

/** How long somebody waits at the desk before walking out, in ms. */
export const patienceMs = (state: GameState): number => upgradeValue(state, 'patience')

/**
 * Buys the next rung of a track. Returns the state unchanged when it refuses,
 * which is what the store's identity check reads as "nothing happened" — same
 * contract as `hire` and the build functions.
 *
 * There is deliberately no level gate. Machines and expansions have one;
 * upgrades are a reward for playing rather than another lock, and the prices
 * order the purchases on their own — 600 is out of reach of a gym opening on
 * 500, and 1 200 000 stays out of reach for days.
 */
export function buyUpgrade(state: GameState, id: UpgradeId): GameState {
  if (state.gameOver) return state

  const next = nextUpgrade(id, upgradeLevel(state, id))
  if (!next || state.cash < next.price) return state

  return {
    ...state,
    cash: state.cash - next.price,
    upgrades: { ...state.upgrades, [id]: upgradeLevel(state, id) + 1 },
    stats: { ...state.stats, totalSpent: state.stats.totalSpent + next.price },
  }
}
