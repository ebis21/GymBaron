import { GRID_H, GRID_W } from '../constants'

/**
 * One rung on the floor-space ladder. The player never picks a width and a
 * depth — they buy the next room, and the room decides its own shape. Keeping
 * the sizes in a table rather than in two independent counters means there is
 * no such thing as an invalid gym: `GameState.expansion` is a single index,
 * which is also all a save has to carry.
 */
/** Names the rung for translation; the save still carries only the index. */
export type ExpansionId = 'start' | 'annex' | 'wing' | 'hall'

export interface Expansion {
  id: ExpansionId
  /** Equipment-grid width and depth once this rung is paid for. */
  w: number
  h: number
  /** Cost of moving up to this rung. Zero on the floor everyone starts with. */
  price: number
  /** Room to grow into has to be earned; a bigger floor alone earns nothing. */
  minLevel: number
}

/**
 * Growth alternates between wider and deeper so the hall never stretches into
 * a corridor. Prices climb far faster than the space does — a bigger room is
 * worth it only once the kit to fill it is already paying for itself.
 */
export const EXPANSIONS: Expansion[] = [
  { id: 'start', w: GRID_W,     h: GRID_H,     price: 0,      minLevel: 1 },
  { id: 'annex', w: GRID_W + 2, h: GRID_H,     price: 4_000,  minLevel: 4 },
  { id: 'wing',  w: GRID_W + 2, h: GRID_H + 2, price: 15_000, minLevel: 8 },
  { id: 'hall',  w: GRID_W + 4, h: GRID_H + 2, price: 45_000, minLevel: 12 },
]

/** Highest rung there is. Past it the shop has nothing left to sell. */
export const MAX_EXPANSION = EXPANSIONS.length - 1

const clampLevel = (level: number) => Math.max(0, Math.min(MAX_EXPANSION, Math.floor(level) || 0))

/**
 * The room at a given rung. Tolerates rubbish — a save hand-edited to
 * expansion 99 gets the biggest legal room rather than an undefined one, and
 * the game keeps running.
 */
export function expansionAt(level: number): Expansion {
  return EXPANSIONS[clampLevel(level)]!
}

/** What the shop is offering next, or null on the top rung. */
export function nextExpansion(level: number): Expansion | null {
  const next = clampLevel(level) + 1
  return next <= MAX_EXPANSION ? EXPANSIONS[next]! : null
}
