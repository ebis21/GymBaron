import { summonLilD } from './clients'
import type { GameState } from './types'

export type AllianceIncomeMultiplier = 1 | 1.5

export function setAllianceIncomeMultiplier(
  state: GameState,
  multiplier: AllianceIncomeMultiplier,
): GameState {
  return state.allianceIncomeMultiplier === multiplier
    ? state
    : { ...state, allianceIncomeMultiplier: multiplier }
}

export interface SabotageDeliveryResult {
  state: GameState
  /** Safe to acknowledge remotely: this id is durably represented locally. */
  shouldAcknowledge: boolean
}

/**
 * Applies one queued LIL D. delivery exactly once. The id is stored in the
 * save before the server acknowledgement, so a crash between those writes
 * retries the acknowledgement without summoning another saboteur.
 */
export function applySabotageDelivery(state: GameState, eventId: string): SabotageDeliveryResult {
  if (state.appliedSabotageIds.includes(eventId)) {
    return { state, shouldAcknowledge: true }
  }

  const summoned = summonLilD(state)
  if (summoned === state) return { state, shouldAcknowledge: false }

  return {
    state: {
      ...summoned,
      appliedSabotageIds: [...summoned.appliedSabotageIds, eventId],
    },
    shouldAcknowledge: true,
  }
}
