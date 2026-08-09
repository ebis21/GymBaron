import type { GameState } from './types'
import { spawnLilD, spawnWalkins, spawnMembers, advanceClients } from './clients'
import { moveClients } from './clientMove'
import { msLeftInDay } from './clock'
import { syncRoomSize } from './layout'
import { CLOSING_DRAIN_MS, DAY_MS, MAX_STEP_MS } from './constants'
import { ageStains, spawnAmbientDirt } from './stains'
import { ageBrokenMachines } from './wear'
import { assignStaff, workStaff } from './staff'
import { moveStaff } from './staffMove'
import { advanceMarketing } from './marketing'
import { advanceContracts } from './contracts'
import { advanceSponsors } from './sponsors'

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
  // The three v2 systems run last, after the floor has settled for this slice,
  // so a campaign or a deal always reads the room as it actually ended up.
  // Each is one line here and a whole file of its own — see `marketing.ts`.
  advanceMarketing,
  advanceContracts,
  advanceSponsors,
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
 * The clock never spills past 20:00, but the day does not end there. Closing
 * time only shuts the door: `acceptingArrivals` turns nobody new away in, the
 * hands on the clock stop, and the simulation keeps running so the last
 * workouts finish, the cleaner catches up, and the player can rearrange the
 * room in peace. The day is settled by `closeDay`, and only the player calls
 * that — as only `nextDay` starts the next one.
 *
 * The one thing that still has to be bounded is how much after-hours time a
 * single call may burn, or an eight-hour offline return would simulate an
 * eight-hour night at an empty gym. `CLOSING_DRAIN_MS` is that bound: enough
 * for the floor to empty itself, and no more.
 */
export function advance(state: GameState, dtMs: number): GameState {
  if (state.gameOver || state.dayEnded || dtMs <= 0) return state

  // Everything downstream — walkability, placement, where the door is — reads
  // the room from a module register rather than threading the size through
  // thirty call sites. This is the one place that has to keep it honest.
  syncRoomSize(state)

  let next = state
  let remaining = Math.min(dtMs, msLeftInDay(state.dayMs) + CLOSING_DRAIN_MS)

  while (remaining > 0 && !next.gameOver) {
    const slice = Math.min(remaining, MAX_STEP_MS)
    next = step(next, slice)
    next = {
      ...next,
      elapsedMs: next.elapsedMs + slice,
      // Stops dead at closing: the clock reads 20:00 for the whole of the
      // after-hours stretch rather than ticking on into the night.
      dayMs: Math.min(DAY_MS, next.dayMs + slice),
    }
    remaining -= slice
  }

  return next
}
