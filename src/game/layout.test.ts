import { describe, it, expect } from 'vitest'
import { tileToWorld, worldToTile, DOOR_X, HALL_W } from './layout'

describe('tileToWorld', () => {
  it('round-trips through worldToTile for every grid tile', () => {
    for (let x = 0; x < 8; x++) {
      for (let y = 0; y < 6; y++) {
        const at = tileToWorld(x, y)
        expect(worldToTile(at.x, at.z)).toEqual({ x, y })
      }
    }
  })

  it('round-trips for the two aisle columns left of the grid', () => {
    for (const x of [-2, -1]) {
      const at = tileToWorld(x, 3)
      expect(worldToTile(at.x, at.z)).toEqual({ x, y: 3 })
    }
  })

  it('keeps the door inside the hall', () => {
    expect(DOOR_X).toBeGreaterThan(-HALL_W / 2)
    expect(DOOR_X).toBeLessThan(HALL_W / 2)
  })
})
