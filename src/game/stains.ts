import type { GameState, Stain } from './types'

/** Odds a finished workout leaves a mess behind. */
export const STAIN_CHANCE = 0.18

/** Past this age a stain reads as neglect and costs double. */
export const STAIN_OLD_MS = 30_000

export const REP_DRAIN_FRESH = 0.4
export const REP_DRAIN_OLD = 0.8

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
 * Ages the mess and charges reputation for it. A stale stain costs double, so
 * ignoring the floor compounds rather than settling into a flat penalty.
 */
export function ageStains(state: GameState, dtMs: number): GameState {
  if (state.stains.length === 0) return state

  const seconds = dtMs / 1000
  let drain = 0

  const stains = state.stains.map(s => {
    const ageMs = s.ageMs + dtMs
    drain += (ageMs > STAIN_OLD_MS ? REP_DRAIN_OLD : REP_DRAIN_FRESH) * seconds
    return { ...s, ageMs }
  })

  return { ...state, stains, reputation: clamp(state.reputation - drain, 0, 100) }
}

export function wipeStain(state: GameState, uid: string): GameState {
  if (!state.stains.some(s => s.uid === uid)) return state
  return { ...state, stains: state.stains.filter(s => s.uid !== uid) }
}
