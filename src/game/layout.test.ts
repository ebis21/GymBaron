import { describe, it, expect } from 'vitest'
import {
  tileToWorld,
  worldToTile,
  receptionStand,
  tileBehind,
  DESK_STAND_DIST,
  DOOR_X,
  HALL_W,
  TILE,
} from './layout'

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

describe('receptionStand', () => {
  const dist = (a: { x: number; z: number }, b: { x: number; z: number }) =>
    Math.hypot(a.x - b.x, a.z - b.z)

  it('stands closer to the desk than a whole tile step, at every rotation', () => {
    for (const rotation of [0, 1, 2, 3]) {
      const desk = tileToWorld(3, 2)
      const spot = receptionStand(3, 2, rotation)
      expect(dist(spot, desk)).toBeCloseTo(DESK_STAND_DIST, 5)
      expect(dist(spot, desk)).toBeLessThan(TILE)
    }
  })

  it('leaves the desk tile itself free', () => {
    for (const rotation of [0, 1, 2, 3]) {
      const spot = receptionStand(3, 2, rotation)
      expect(worldToTile(spot.x, spot.z)).not.toEqual({ x: 3, y: 2 })
    }
  })

  it('stands on the same side as the tile the attendant paths to', () => {
    for (const rotation of [0, 1, 2, 3]) {
      const spot = receptionStand(3, 2, rotation)
      expect(worldToTile(spot.x, spot.z)).toEqual(tileBehind(3, 2, rotation))
    }
  })
})
