import { describe, it, expect } from 'vitest'
import { rollRarity } from './rarity'

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
