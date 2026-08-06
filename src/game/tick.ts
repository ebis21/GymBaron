import type { GameState } from './types'
import { spawnLilD, spawnWalkins, spawnMembers, advanceClients } from './clients'
import { moveClients } from './clientMove'
import { closeDay } from './dayClose'
import { msLeftInDay } from './clock'
import { DAY_MS, MAX_STEP_MS } from './constants'
import { ageStains, spawnAmbientDirt } from './stains'
import { ageBrokenMachines } from './wear'
import { assignStaff, workStaff } from './staff'
import { moveStaff } from './staffMove'

type System = (state: GameState, dtMs: number) => GameState

const assign: System = state => assignStaff(state)

/**
 * The whole simulation, in order. Costs are deliberately absent — money only
 * leaves the till at closing time, never by the millisecond.
 *
 * Movement runs before the phase timers so somebody who arrives during this
 * tick starts working in it, rather than idling for a frame.
 */
const SYSTEMS: System[] = [
  spawnLilD,
  spawnWalkins,
  spawnMembers,
  moveClients,
  advanceClients,
  spawnAmbientDirt,
  ageStains,
  ageBrokenMachines,
  assign,
  moveStaff,
  workStaff,
]

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
