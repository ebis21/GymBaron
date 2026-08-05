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
}

/** Stacks on top of the machine's own multiplier when the door fee is charged. */
export const RARITY_MULTIPLIER: Record<ClientRarity, number> = {
  common: 1.2,
  rare: 1.6,
  epic: 2.0,
  legend: 2.4,
  influencer: 3.2,
}

/** Relative odds of a walk-in landing on each rarity — weights, not percentages. */
const RARITY_WEIGHT: Record<ClientRarity, number> = {
  common: 50,
  rare: 40,
  epic: 20,
  legend: 6,
  influencer: 2,
}

const TOTAL_WEIGHT = CLIENT_RARITIES.reduce((sum, r) => sum + RARITY_WEIGHT[r], 0)

/** Draws a rarity from the weighted table, threading the seed like the rest of the engine. */
export function rollRarity(seed: number): [ClientRarity, number] {
  const [roll, next] = nextRandom(seed)
  const target = roll * TOTAL_WEIGHT

  let acc = 0
  for (const rarity of CLIENT_RARITIES) {
    acc += RARITY_WEIGHT[rarity]
    if (target < acc) return [rarity, next]
  }
  return [CLIENT_RARITIES[CLIENT_RARITIES.length - 1]!, next]
}
