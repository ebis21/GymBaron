import { describe, it, expect } from 'vitest'
import { settleOffline } from './offline'
import { closeDay } from './dayClose'
import { initialState } from './economy'
import { tileToWorld } from './layout'
import { OFFLINE_CAP_MS, DEBT_LIMIT, DAY_MS, DAILY_RENT } from './constants'
import type { GameState } from './types'

describe('settleOffline', () => {
  it('reports no time away when the player just left', () => {
    expect(settleOffline(initialState(5, 1000), 1000).awayMs).toBe(0)
  })

  it('never reports negative time for a clock that moved backwards', () => {
    expect(settleOffline(initialState(5, 5000), 1000).awayMs).toBe(0)
  })

  it('caps time away at 8 hours', () => {
    expect(settleOffline(initialState(5, 0), OFFLINE_CAP_MS * 3).awayMs).toBe(OFFLINE_CAP_MS)
  })

  // The bill is no longer collected behind the player's back: a night away
  // leaves the gym at closing time with the till uncounted, and the player
  // presses the button themselves. So neither rent nor bankruptcy can land
  // while they are gone — the settlement only runs the floor, not the books.
  it('does not charge rent while the player is away', () => {
    const s0 = initialState(5, 0)
    expect(settleOffline(s0, DAY_MS).state.cash).toBeGreaterThanOrEqual(s0.cash)
    expect(settleOffline(s0, DAY_MS).state.dayEnded).toBe(false)
  })

  it('cannot end the game while the player is away', () => {
    const s0 = { ...initialState(5, 0), cash: DEBT_LIMIT + 1 }
    expect(settleOffline(s0, OFFLINE_CAP_MS).state.gameOver).toBe(false)
  })

  it('leaves the day ready to be cashed up', () => {
    const settled = settleOffline(initialState(5, 0), OFFLINE_CAP_MS).state
    const closed = closeDay(settled)
    expect(closed.dayEnded).toBe(true)
    expect(closed.cash).toBeCloseTo(settled.cash - DAILY_RENT, 5)
  })

  it('stamps lastSeenAt to now', () => {
    expect(settleOffline(initialState(5, 0), 50_000).state.lastSeenAt).toBe(50_000)
  })

  it('has staff clean up while the player is away', () => {
    const away: GameState = {
      ...initialState(7, 0),
      decor: [],
      lastSeenAt: 0,
      staff: [{
        uid: 'e1', name: 'Piotr W.', role: 'cleaner', rank: 'legend',
        x: tileToWorld(-1, 0).x, z: tileToWorld(-1, 0).z, path: [], goal: null,
        targetUid: null, workMs: 0, owed: 0,
      }],
      stains: [{ uid: 's1', x: 5, y: 4, ageMs: 0 }],
    }

    // A minute away is far more than a legendary cleaner needs to cross the hall.
    const { state } = settleOffline(away, 60_000)
    expect(state.stains).toHaveLength(0)
  })
})
