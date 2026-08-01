import type { GameState } from './types'
import { advance } from './tick'
import { OFFLINE_CAP_MS } from './constants'

export interface OfflineResult {
  state: GameState
  /** Net cash change over the settled period — can be negative. */
  earned: number
  awayMs: number
}

/**
 * Runs the engine over the time the player was away, at full income and full
 * costs, capped at OFFLINE_CAP_MS. A clock that jumped backwards settles to
 * zero rather than rewinding the game.
 */
export function settleOffline(state: GameState, now: number): OfflineResult {
  const awayMs = Math.max(0, Math.min(now - state.lastSeenAt, OFFLINE_CAP_MS))
  const advanced = advance(state, awayMs)
  return {
    state: { ...advanced, lastSeenAt: now },
    earned: advanced.cash - state.cash,
    awayMs,
  }
}
