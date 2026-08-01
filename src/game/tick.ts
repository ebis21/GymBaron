import type { GameState } from './types'
import { spawnClients, advanceClients } from './clients'
import { chargeCosts } from './economy'
import { DAY_MS, MAX_STEP_MS } from './constants'

type System = (state: GameState, dtMs: number) => GameState

/**
 * The whole simulation, in order. Adding a v2 system (marketing, contracts,
 * staff) means appending one function here.
 */
const SYSTEMS: System[] = [spawnClients, advanceClients, chargeCosts]

function step(state: GameState, dtMs: number): GameState {
  let next = state
  for (const system of SYSTEMS) next = system(next, dtMs)
  return next
}

/**
 * Advances the game by dtMs. Long gaps are split into MAX_STEP_MS slices so a
 * backgrounded tab or an offline settlement cannot leap over a client's whole
 * visit in a single jump.
 */
export function advance(state: GameState, dtMs: number): GameState {
  if (state.gameOver || dtMs <= 0) return state

  let next = state
  let remaining = dtMs

  while (remaining > 0 && !next.gameOver) {
    const slice = Math.min(remaining, MAX_STEP_MS)
    next = step(next, slice)
    next = { ...next, elapsedMs: next.elapsedMs + slice }
    remaining -= slice
  }

  return {
    ...next,
    stats: { ...next.stats, daysPassed: Math.floor(next.elapsedMs / DAY_MS) },
  }
}
