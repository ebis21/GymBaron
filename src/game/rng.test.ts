import { describe, it, expect } from 'vitest'
import { nextRandom } from './rng'

describe('nextRandom', () => {
  it('returns a value in [0,1)', () => {
    const [v] = nextRandom(1)
    expect(v).toBeGreaterThanOrEqual(0)
    expect(v).toBeLessThan(1)
  })

  it('is deterministic for the same seed', () => {
    expect(nextRandom(42)).toEqual(nextRandom(42))
  })

  it('advances the seed so successive draws differ', () => {
    const [v1, s1] = nextRandom(42)
    const [v2] = nextRandom(s1)
    expect(v2).not.toBe(v1)
  })

  it('spreads values across the range', () => {
    let seed = 1
    let below = 0
    for (let i = 0; i < 500; i++) {
      const [v, s] = nextRandom(seed)
      seed = s
      if (v < 0.5) below++
    }
    expect(below).toBeGreaterThan(150)
    expect(below).toBeLessThan(350)
  })
})
