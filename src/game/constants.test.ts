import { describe, it, expect } from 'vitest'
import { GRID_W, GRID_H, DEBT_LIMIT, START_CASH } from './constants'

describe('constants', () => {
  it('defines an 8x6 grid', () => {
    expect(GRID_W).toBe(8)
    expect(GRID_H).toBe(6)
  })
  it('starts the player with 500', () => {
    expect(START_CASH).toBe(500)
  })
  it('puts the debt floor at -20000', () => {
    expect(DEBT_LIMIT).toBe(-20_000)
  })
})
