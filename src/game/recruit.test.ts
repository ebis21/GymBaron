import { describe, it, expect } from 'vitest'
import { ensurePool, refreshPool, rollPool, POOL_SIZE, REFRESH_PRICE } from './recruit'
import { initialState } from './economy'
import type { GameState } from './types'

const gym = (over: Partial<GameState> = {}): GameState => ({ ...initialState(7, 0), ...over })

describe('rollPool', () => {
  it('draws a full board', () => {
    expect(rollPool(gym()).candidates).toHaveLength(POOL_SIZE)
  })

  it('stamps the pool with the current day', () => {
    const s = rollPool(gym({ day: 5 }))
    expect(s.candidatesDay).toBe(5)
  })

  it('gives every candidate a name, role and rank', () => {
    for (const c of rollPool(gym()).candidates) {
      expect(c.name.length).toBeGreaterThan(0)
      expect(['reception', 'cleaner', 'repair']).toContain(c.role)
      expect(['rare', 'epic', 'legend']).toContain(c.rank)
    }
  })

  it('is reproducible from the seed', () => {
    expect(rollPool(gym()).candidates).toEqual(rollPool(gym()).candidates)
  })

  it('advances the seed so the next draw differs', () => {
    const first = rollPool(gym())
    const second = rollPool(first)
    expect(second.seed).not.toBe(first.seed)
  })

  it('makes legends much rarer than rares', () => {
    let s = gym()
    const counts = { rare: 0, epic: 0, legend: 0 }
    for (let i = 0; i < 400; i++) {
      s = rollPool(s)
      for (const c of s.candidates) counts[c.rank] += 1
    }
    expect(counts.rare).toBeGreaterThan(counts.epic)
    expect(counts.epic).toBeGreaterThan(counts.legend)
    expect(counts.legend / (counts.rare + counts.epic + counts.legend)).toBeLessThan(0.12)
  })
})

describe('ensurePool', () => {
  it('draws a board for a day that has none', () => {
    expect(ensurePool(gym({ day: 3 })).candidates).toHaveLength(POOL_SIZE)
  })

  it('leaves today\'s board alone', () => {
    const drawn = rollPool(gym({ day: 3 }))
    expect(ensurePool(drawn)).toBe(drawn)
  })

  it('redraws once the day rolls over', () => {
    const drawn = rollPool(gym({ day: 3 }))
    const tomorrow = ensurePool({ ...drawn, day: 4 })
    expect(tomorrow.candidatesDay).toBe(4)
  })
})

describe('refreshPool', () => {
  it('charges for a fresh board', () => {
    const s = refreshPool(gym({ cash: 5000 }))
    expect(s.cash).toBe(5000 - REFRESH_PRICE)
    expect(s.candidates).toHaveLength(POOL_SIZE)
  })

  it('refuses when the player cannot afford it', () => {
    const before = gym({ cash: 10 })
    expect(refreshPool(before)).toBe(before)
  })
})
