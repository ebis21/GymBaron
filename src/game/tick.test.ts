import { describe, it, expect } from 'vitest'
import { advance } from './tick'
import { initialState } from './economy'
import { DAY_MS } from './constants'

describe('advance', () => {
  it('is deterministic', () => {
    expect(advance(initialState(9, 0), 5_000)).toEqual(advance(initialState(9, 0), 5_000))
  })

  it('accumulates elapsed time', () => {
    expect(advance(initialState(9, 0), 5_000).elapsedMs).toBe(5_000)
  })

  it('counts whole days only', () => {
    expect(advance(initialState(9, 0), DAY_MS).stats.daysPassed).toBe(1)
    expect(advance(initialState(9, 0), DAY_MS - 1).stats.daysPassed).toBe(0)
  })

  it('splits a long step so results match many small steps', () => {
    let stepwise = initialState(9, 0)
    for (let i = 0; i < 10; i++) stepwise = advance(stepwise, 1_000)
    expect(advance(initialState(9, 0), 10_000).cash).toBeCloseTo(stepwise.cash, 5)
  })

  it('freezes once the game is over', () => {
    const dead = { ...initialState(9, 0), gameOver: true }
    expect(advance(dead, 10_000)).toEqual(dead)
  })

  it('handles a zero-length step', () => {
    const s = initialState(9, 0)
    expect(advance(s, 0)).toEqual(s)
  })
})
