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

  it('tracks the position inside the day', () => {
    expect(advance(initialState(9, 0), 5_000).dayMs).toBe(5_000)
  })

  it('never runs the clock past closing time', () => {
    const s = advance(initialState(9, 0), DAY_MS * 5)
    expect(s.dayMs).toBe(DAY_MS)
    expect(s.day).toBe(1)
  })

  it('shuts the door at 20:00 without ending the day', () => {
    const after = advance(initialState(9, 0), DAY_MS)
    // Closing time is the player's cue, not an ambush: the gym stays live so
    // they can rebuild, and only `closeDay` settles the till.
    expect(after.dayEnded).toBe(false)
    expect(after.dayReport).toBeNull()
    expect(after.dayMs).toBe(DAY_MS)
  })

  it('admits nobody new after closing time', () => {
    let s = advance(initialState(9, 0), DAY_MS)
    const inside = s.clients.length
    // Long enough that the spawn roll would certainly have fired by now.
    for (let i = 0; i < 60; i += 1) s = advance(s, 1_000)
    expect(s.clients.length).toBeLessThanOrEqual(inside)
  })

  it('keeps a closed day frozen', () => {
    const closed = { ...advance(initialState(9, 0), DAY_MS), dayEnded: true }
    expect(advance(closed, 60_000)).toEqual(closed)
  })

  it('leaves cash alone all day', () => {
    const midday = advance(initialState(9, 0), DAY_MS - 1)
    expect(midday.dayEnded).toBe(false)
    expect(midday.cash).toBeGreaterThanOrEqual(initialState(9, 0).cash)
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
