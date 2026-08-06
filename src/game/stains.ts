import type { GameState, Stain } from './types'
import type { Tile } from './layout'
import { isClosingTime } from './clock'
import { gridH, gridW } from './layout'
import { walkable } from './pathfind'
import { nextRandom } from './rng'
import { NEGLECT_GRACE_MS } from './neglect'
import {
  AMBIENT_DIRT_CHANCE,
  AMBIENT_DIRT_INTERVAL_MS,
  AMBIENT_DIRT_MAX_STAINS,
} from './constants'

/**
 * Odds a finished workout leaves a mess behind. Down from 0.18: with a busy
 * floor that meant a stain every few workouts on top of the ambient dirt, and
 * the player spent the day mopping instead of running a gym.
 */
export const STAIN_CHANCE = 0.07

/** Past this age a stain reads as neglect and costs double. */
export const STAIN_OLD_MS = 30_000

/**
 * A single fresh stain used to cost more reputation in ~4s than an entire
 * finished workout earns (REP_GAIN_ON_WORKOUT = 1.5) — one mess would tank
 * the gym's draw before a player could even notice it. These rates keep a
 * lone stain a minor, catch-it-when-you-can nuisance; neglecting the floor
 * (several stains, or one gone stale) is what actually adds up.
 */
export const REP_DRAIN_FRESH = 0.05
export const REP_DRAIN_OLD = 0.1

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/**
 * One tile holds at most one stain — a busy machine leaves a mess, not a pile
 * of them, and stacking would let a single popular treadmill sink the whole
 * gym's reputation on its own.
 */
export function spawnStain(state: GameState, x: number, y: number): GameState {
  if (state.stains.some(s => s.x === x && s.y === y)) return state

  const stain: Stain = { uid: `s${state.nextUid}`, x, y, ageMs: 0 }
  return { ...state, nextUid: state.nextUid + 1, stains: [...state.stains, stain] }
}

/**
 * Dirt tracked in from footfall across the whole floor, independent of any
 * machine. `AMBIENT_DIRT_CHANCE` is the odds over a full
 * `AMBIENT_DIRT_INTERVAL_MS` window, scaled down by how much of that window
 * this call actually covers — the same trick `spawnWalkins` uses — so a
 * frame-by-frame caller sees "roughly once a second" odds rather than that
 * chance re-rolled on every frame. Picks uniformly among walkable,
 * unoccupied, currently clean tiles on the equipment grid, and stops once the
 * floor already carries `AMBIENT_DIRT_MAX_STAINS` messes so a neglected gym
 * can't spiral past a fair ceiling.
 *
 * Footfall needs feet: once the doors are shut and the last visitor has gone,
 * an empty hall stops making its own mess. Otherwise the after-hours stretch —
 * which is exactly when the player is rearranging the room and can do nothing
 * about it — would quietly keep dirtying the floor they just mopped.
 */
export function spawnAmbientDirt(state: GameState, dtMs: number): GameState {
  if (state.stains.length >= AMBIENT_DIRT_MAX_STAINS) return state
  if (isClosingTime(state.dayMs) && state.clients.length === 0) return state

  const chance = Math.min(1, AMBIENT_DIRT_CHANCE * (dtMs / AMBIENT_DIRT_INTERVAL_MS))
  const [roll, seed] = nextRandom(state.seed)
  const rolled = { ...state, seed }
  if (roll >= chance) return rolled

  const candidates: Tile[] = []
  for (let x = 0; x < gridW(); x += 1) {
    for (let y = 0; y < gridH(); y += 1) {
      if (walkable(rolled, x, y) && !rolled.stains.some(s => s.x === x && s.y === y)) {
        candidates.push({ x, y })
      }
    }
  }
  if (candidates.length === 0) return rolled

  const [pick, seed2] = nextRandom(rolled.seed)
  const tile = candidates[Math.min(candidates.length - 1, Math.floor(pick * candidates.length))]!
  return spawnStain({ ...rolled, seed: seed2 }, tile.x, tile.y)
}

/**
 * Ages the mess and charges reputation for it. A fresh spill is free for
 * `NEGLECT_GRACE_MS` — nobody judges a gym for a stain that appeared seconds
 * ago — and only starts costing once it has plainly been left. A stale one
 * costs double, so ignoring the floor compounds rather than settling into a
 * flat penalty.
 */
export function ageStains(state: GameState, dtMs: number): GameState {
  if (state.stains.length === 0) return state

  let drain = 0

  const stains = state.stains.map(s => {
    const ageMs = s.ageMs + dtMs
    // Only the slice of this tick past the grace window is billable, so a
    // stain that appears mid-tick is not charged for the whole tick.
    const billableMs = Math.max(0, Math.min(dtMs, ageMs - NEGLECT_GRACE_MS))
    drain += (ageMs > STAIN_OLD_MS ? REP_DRAIN_OLD : REP_DRAIN_FRESH) * (billableMs / 1000)
    return { ...s, ageMs }
  })

  return { ...state, stains, reputation: clamp(state.reputation - drain, 0, 100) }
}

export function wipeStain(state: GameState, uid: string): GameState {
  if (!state.stains.some(s => s.uid === uid)) return state
  return { ...state, stains: state.stains.filter(s => s.uid !== uid) }
}
