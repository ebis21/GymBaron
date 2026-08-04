import { describe, it, expect } from 'vitest'
import { stepAlongPath } from './walk'
import { tileToWorld } from './layout'

const at = (x: number, y: number) => tileToWorld(x, y)

describe('stepAlongPath', () => {
  it('stands still with no path and no distance to the end', () => {
    const start = at(0, 0)
    const r = stepAlongPath(start, [], start, 2, 1000)
    expect(r.arrived).toBe(true)
    expect(r.pos).toEqual(start)
  })

  it('moves toward the next tile without overshooting it', () => {
    const start = at(0, 0)
    const goal = at(3, 0)
    // Tiles are 2 units apart; 0.5 units of travel stays inside the first leg.
    const r = stepAlongPath(start, [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }], goal, 0.5, 1000)
    expect(r.pos.x).toBeCloseTo(start.x + 0.5)
    expect(r.path).toHaveLength(3)
    expect(r.arrived).toBe(false)
  })

  it('consumes several waypoints when the budget covers them', () => {
    const start = at(0, 0)
    const goal = at(3, 0)
    // 5 units of budget crosses two whole 2-unit legs and starts a third.
    const r = stepAlongPath(start, [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }], goal, 5, 1000)
    expect(r.path).toHaveLength(1)
    expect(r.arrived).toBe(false)
  })

  it('lands exactly on the end point and reports arrival', () => {
    const start = at(0, 0)
    const goal = at(2, 0)
    const r = stepAlongPath(start, [{ x: 1, y: 0 }, { x: 2, y: 0 }], goal, 100, 1000)
    expect(r.arrived).toBe(true)
    expect(r.pos.x).toBeCloseTo(goal.x)
    expect(r.pos.z).toBeCloseTo(goal.z)
    expect(r.path).toHaveLength(0)
  })

  it('finishes on an end point that is not a tile centre', () => {
    const start = at(0, 0)
    const offset = { x: at(1, 0).x + 0.4, z: at(1, 0).z - 0.3 }
    const r = stepAlongPath(start, [{ x: 1, y: 0 }], offset, 100, 1000)
    expect(r.arrived).toBe(true)
    expect(r.pos.x).toBeCloseTo(offset.x)
    expect(r.pos.z).toBeCloseTo(offset.z)
  })

  it('never moves on a zero or negative time step', () => {
    const start = at(0, 0)
    const r = stepAlongPath(start, [{ x: 1, y: 0 }], at(1, 0), 2, 0)
    expect(r.pos).toEqual(start)
    expect(r.arrived).toBe(false)
  })
})
