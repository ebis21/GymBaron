import { describe, it, expect } from 'vitest'
import { averageRarityMultiplier, rollRarity } from './rarity'

describe('rollRarity', () => {
  it('keeps the top tiers scarce', () => {
    let seed = 7
    const counts: Record<string, number> = {}
    for (let i = 0; i < 5000; i++) {
      const [rarity, next] = rollRarity(seed)
      seed = next
      counts[rarity] = (counts[rarity] ?? 0) + 1
    }
    const total = 5000
    expect((counts.legend ?? 0) / total).toBeLessThan(0.06)
    expect((counts.influencer ?? 0) / total).toBeLessThan(0.03)
    expect((counts.common ?? 0) / total).toBeGreaterThan(0.3)
  })
})

/** Rolls a long run and reports what share of it landed on each tier. */
const distribution = (luck: number, runs = 20_000): Record<string, number> => {
  let seed = 11
  const counts: Record<string, number> = {}
  for (let i = 0; i < runs; i++) {
    const [rarity, next] = rollRarity(seed, luck)
    seed = next
    counts[rarity] = (counts[rarity] ?? 0) + 1
  }
  for (const key of Object.keys(counts)) counts[key] = counts[key]! / runs
  return counts
}

describe('rollRarity — the luck upgrade', () => {
  it('leaves the table exactly as it was at luck 1', () => {
    let plain = 7
    let lucky = 7
    for (let i = 0; i < 500; i++) {
      const [a, nextA] = rollRarity(plain)
      const [b, nextB] = rollRarity(lucky, 1)
      expect(b).toBe(a)
      plain = nextA
      lucky = nextB
    }
  })

  it('consumes exactly one number from the stream, whatever the luck', () => {
    // The seed has to advance identically or a luck purchase would silently
    // reshuffle every other roll in the simulation.
    const [, plain] = rollRarity(99)
    const [, lucky] = rollRarity(99, 4)
    expect(lucky).toBe(plain)
  })

  it('pushes the good tiers up and the common ones down', () => {
    const plain = distribution(1)
    const lucky = distribution(4)

    expect(lucky.common!).toBeLessThan(plain.common!)
    expect(lucky.epic!).toBeGreaterThan(plain.epic!)
    expect(lucky.legend!).toBeGreaterThan(plain.legend!)
    expect(lucky.influencer!).toBeGreaterThan(plain.influencer!)
  })

  it('makes INFLUENCER the commonest tier at the top of the ladder', () => {
    // The whole point of compounding by tier rather than multiplying flatly:
    // maxed luck is meant to feel like a different game, not a rounding error.
    const lucky = distribution(4)
    const best = Object.entries(lucky).sort((a, b) => b[1] - a[1])[0]!
    expect(best[0]).toBe('influencer')
    expect(lucky.influencer!).toBeGreaterThan(0.3)
  })

  it('never draws the secret tier, which has no weight', () => {
    expect(distribution(4).secret).toBeUndefined()
  })
})

describe('the average visitor', () => {
  it('is worth what the untouched weights say at the door', () => {
    // 50/40/20/6/2 against the tier multipliers, by hand.
    const expected = (50 * 1.2 + 40 * 1.6 + 20 * 2 + 6 * 2.4 + 2 * 3.2) / 118
    expect(averageRarityMultiplier(1)).toBeCloseTo(expected, 10)
  })

  it('is worth more the luckier the gym is', () => {
    const plain = averageRarityMultiplier(1)
    for (const luck of [1.5, 2, 4]) {
      expect(averageRarityMultiplier(luck)).toBeGreaterThan(plain)
    }
    expect(averageRarityMultiplier(4)).toBeGreaterThan(averageRarityMultiplier(2))
  })

  it('never counts the secret visitor, who pays through their own rules', () => {
    // Every tier at once would drag the average toward `secret`'s 1.0.
    expect(averageRarityMultiplier(1)).toBeGreaterThan(1.2)
  })
})
