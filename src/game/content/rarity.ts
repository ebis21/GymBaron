import type { ClientRarity } from '../types'
import { nextRandom } from '../rng'

export const CLIENT_RARITIES: ClientRarity[] = ['common', 'rare', 'epic', 'legend', 'influencer']

/**
 * Shown over a client's head and on their card. Deliberately the raw tier
 * names rather than a translation: they are the same words the tag in the room
 * is printed with, and a player reads the two as one thing.
 */
export const RARITY_LABEL: Record<ClientRarity, string> = {
  common: 'COMMON',
  rare: 'RARE',
  epic: 'EPIC',
  legend: 'LEGEND',
  influencer: 'INFLUENCER',
  secret: 'SECRET',
}

/** Stacks on top of the machine's own multiplier when the door fee is charged. */
export const RARITY_MULTIPLIER: Record<ClientRarity, number> = {
  common: 1.2,
  rare: 1.6,
  epic: 2.0,
  legend: 2.4,
  influencer: 3.2,
  // Secret visitors settle at the desk through their own rules.
  secret: 1,
}

/** Relative odds of a walk-in landing on each rarity — weights, not percentages. */
const RARITY_WEIGHT: Record<ClientRarity, number> = {
  common: 50,
  rare: 40,
  epic: 20,
  legend: 6,
  influencer: 2,
  secret: 0,
}

/**
 * How luck bends the table: each tier's weight is multiplied by `luck` raised
 * to that tier's index, so common is untouched, rare scales with luck, epic
 * with luck squared, and so on up.
 *
 * A flat multiplier on everything above common was tried first and lifted the
 * average rarity multiplier by only 11% at luck ×4.0 — less than a single rung
 * of `earnings` costing a fraction as much. Compounding by tier is what makes
 * luck read as luck: at ×4.0 the weights become 50/160/320/384/512, the average
 * multiplier goes 1.57 → 2.47, and INFLUENCER turns into the *commonest* tier
 * rather than a once-an-hour event.
 */
const luckedWeight = (rarity: ClientRarity, index: number, luck: number): number =>
  RARITY_WEIGHT[rarity] * Math.pow(luck, index)

/**
 * What the average walk-in is worth at the door, at a given luck, as a plain
 * multiplier on the base fee. The same weights `rollRarity` draws from, read
 * as an expectation rather than sampled — which is what a projection wants,
 * since a screen cannot roll a die on the player's behalf.
 *
 * `secret` carries weight 0, so the named visitor never dilutes the figure.
 */
export function averageRarityMultiplier(luck = 1): number {
  const weights = CLIENT_RARITIES.map((r, i) => luckedWeight(r, i, luck))
  const total = weights.reduce((sum, w) => sum + w, 0)
  if (total === 0) return 1

  return CLIENT_RARITIES
    .reduce((sum, r, i) => sum + weights[i]! * RARITY_MULTIPLIER[r], 0) / total
}

/**
 * Draws a rarity from the weighted table, threading the seed like the rest of
 * the engine. `luck` defaults to the unupgraded table, so every existing caller
 * and test keeps the distribution it always had.
 */
export function rollRarity(seed: number, luck = 1): [ClientRarity, number] {
  const [roll, next] = nextRandom(seed)

  const weights = CLIENT_RARITIES.map((r, i) => luckedWeight(r, i, luck))
  const total = weights.reduce((sum, w) => sum + w, 0)
  const target = roll * total

  let acc = 0
  for (let i = 0; i < CLIENT_RARITIES.length; i += 1) {
    acc += weights[i]!
    if (target < acc) return [CLIENT_RARITIES[i]!, next]
  }
  return [CLIENT_RARITIES[CLIENT_RARITIES.length - 1]!, next]
}
