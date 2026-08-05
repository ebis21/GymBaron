import type { GameState } from './types'
import { NEGLECT_GRACE_MS, clampRep } from './neglect'

/** Reputation lost per second by one machine left out of service. */
export const REP_DRAIN_BROKEN = 0.08

/**
 * Charges reputation for kit left out of service, and keeps each machine's
 * broken-for clock. A wreck is free for `NEGLECT_GRACE_MS` — long enough to
 * notice it and walk over — and only bites once it has plainly been ignored.
 *
 * The clock is derived here rather than stamped by whoever breaks or fixes a
 * machine: a working machine's timer is simply zero, so a repair (by the
 * player or by staff) clears it on the next tick with no extra bookkeeping.
 */
export function ageBrokenMachines(state: GameState, dtMs: number): GameState {
  if (state.machines.length === 0) return state

  let drain = 0
  let changed = false

  const machines = state.machines.map(m => {
    if (m.durability > 0) {
      if (m.brokenMs === 0) return m
      changed = true
      return { ...m, brokenMs: 0 }
    }

    const brokenMs = m.brokenMs + dtMs
    // Only the slice of this tick past the grace window is billable, so a
    // machine that breaks mid-tick is not charged for the whole tick.
    const billableMs = Math.max(0, Math.min(dtMs, brokenMs - NEGLECT_GRACE_MS))
    drain += REP_DRAIN_BROKEN * (billableMs / 1000)
    changed = true
    return { ...m, brokenMs }
  })

  if (!changed) return state

  return { ...state, machines, reputation: clampRep(state.reputation - drain) }
}
