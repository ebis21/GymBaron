import type { GameState } from './types'
import { spawnWalkins, spawnMembers, advanceClients } from './clients'
import { moveClients } from './clientMove'
import { closeDay } from './dayClose'
import { msLeftInDay } from './clock'
import { DAY_MS, MAX_STEP_MS } from './constants'

type System = (state: GameState, dtMs: number) => GameState

/**
 * The whole simulation, in order. Costs are deliberately absent — money only
 * leaves the till at closing time, never by the millisecond.
 */
const SYSTEMS: System[] = [spawnWalkins, spawnMembers, moveClients, advanceClients]

function step(state: GameState, dtMs: number): GameState {
  let next = state
  for (const system of SYSTEMS) next = system(next, dtMs)
  return next
}

/**
 * Advances the game by dtMs. Long gaps are split into MAX_STEP_MS slices so a
 * backgrounded tab or an offline settlement cannot leap over a client's whole
 * visit in a single jump.
 *
 * Time never spills past 20:00. Whatever dtMs is left over when the clock hits
 * closing is discarded and the day is settled, so no amount of elapsed real
 * time can carry the player into tomorrow — only `nextDay` does that.
 */
export function advance(state: GameState, dtMs: number): GameState {
  if (state.gameOver || state.dayEnded || dtMs <= 0) return state

  let next = state
  let remaining = Math.min(dtMs, msLeftInDay(state.dayMs))

  while (remaining > 0 && !next.gameOver) {
    const slice = Math.min(remaining, MAX_STEP_MS)
    next = step(next, slice)
    next = { ...next, elapsedMs: next.elapsedMs + slice, dayMs: next.dayMs + slice }
    remaining -= slice
  }

  return next.dayMs >= DAY_MS && !next.gameOver ? closeDay(next) : next
}
