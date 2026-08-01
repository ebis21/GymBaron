import { describe, it, expect } from 'vitest'
import { settleOffline } from './offline'
import { initialState } from './economy'
import { OFFLINE_CAP_MS, DEBT_LIMIT, DAY_MS, DAILY_RENT } from './constants'

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

  it('charges rent for the time away', () => {
    const s0 = initialState(5, 0)
    expect(settleOffline(s0, DAY_MS).state.cash).toBeCloseTo(s0.cash - DAILY_RENT, 5)
  })

  it('ends the game when settlement breaches the debt limit', () => {
    const s0 = { ...initialState(5, 0), cash: DEBT_LIMIT + 1 }
    expect(settleOffline(s0, OFFLINE_CAP_MS).state.gameOver).toBe(true)
  })

  it('stamps lastSeenAt to now', () => {
    expect(settleOffline(initialState(5, 0), 50_000).state.lastSeenAt).toBe(50_000)
  })
})
