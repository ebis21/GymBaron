import { describe, it, expect } from 'vitest'
import { entryFee, dailyCosts, chargeCosts, addXp, initialState } from './economy'
import { DAY_MS, DAILY_RENT, DEBT_LIMIT, START_CASH } from './constants'
import type { Machine } from './types'

const base = () => initialState(1, 0)
const treadmill: Machine = { uid: 'm1', type: 'treadmill', x: 0, y: 0, durability: 100, occupiedBy: null }

describe('entryFee', () => {
  it('is cheapest at zero reputation and dearest at full', () => {
    expect(entryFee(0)).toBeLessThan(entryFee(100))
  })
  it('is always positive', () => {
    expect(entryFee(0)).toBeGreaterThan(0)
  })
  it('clamps out-of-range reputation', () => {
    expect(entryFee(-50)).toBe(entryFee(0))
    expect(entryFee(500)).toBe(entryFee(100))
  })
})

describe('dailyCosts', () => {
  it('is just rent for an empty gym', () => {
    expect(dailyCosts(base())).toBe(DAILY_RENT)
  })
  it('grows when a machine is added', () => {
    expect(dailyCosts({ ...base(), machines: [treadmill] })).toBeGreaterThan(DAILY_RENT)
  })
})

describe('chargeCosts', () => {
  it('charges a full day over DAY_MS', () => {
    expect(chargeCosts(base(), DAY_MS).cash).toBeCloseTo(START_CASH - DAILY_RENT, 5)
  })

  it('pro-rates a partial day', () => {
    expect(chargeCosts(base(), DAY_MS / 2).cash).toBeCloseTo(START_CASH - DAILY_RENT / 2, 5)
  })

  it('does not mutate its input', () => {
    const s = base()
    chargeCosts(s, DAY_MS)
    expect(s.cash).toBe(START_CASH)
  })

  it('lets cash go negative without ending the game', () => {
    const s = chargeCosts({ ...base(), cash: 10 }, DAY_MS)
    expect(s.cash).toBeLessThan(0)
    expect(s.gameOver).toBe(false)
  })

  it('ends the game below the debt limit', () => {
    expect(chargeCosts({ ...base(), cash: DEBT_LIMIT + 1 }, DAY_MS).gameOver).toBe(true)
  })

  it('does not end the game exactly at the debt limit', () => {
    const s = chargeCosts({ ...base(), cash: DEBT_LIMIT + DAILY_RENT }, DAY_MS)
    expect(s.cash).toBeCloseTo(DEBT_LIMIT, 5)
    expect(s.gameOver).toBe(false)
  })

  it('records what was spent', () => {
    expect(chargeCosts(base(), DAY_MS).stats.totalSpent).toBeCloseTo(DAILY_RENT, 5)
  })
})

describe('addXp', () => {
  it('levels up once the threshold is crossed', () => {
    expect(addXp(base(), 100).level).toBe(2)
  })
  it('carries the remainder into the new level', () => {
    const s = addXp(base(), 130)
    expect(s.level).toBe(2)
    expect(s.xp).toBe(30)
  })
  it('handles several levels in one award', () => {
    expect(addXp(base(), 250).level).toBe(3)
  })
  it('does not level up below the threshold', () => {
    expect(addXp(base(), 99).level).toBe(1)
  })
})
