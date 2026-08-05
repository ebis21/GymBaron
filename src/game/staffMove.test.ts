import { describe, it, expect } from 'vitest'
import { moveStaff } from './staffMove'
import { initialState } from './economy'
import { tileToWorld } from './layout'
import type { GameState, Staff, Stain } from './types'

const at = (x: number, y: number) => tileToWorld(x, y)

const staff = (over: Partial<Staff> = {}): Staff => ({
  uid: 'e1', name: 'Marta K.', role: 'cleaner', rank: 'legend',
  x: at(-1, 0).x, z: at(-1, 0).z, path: [], goal: null,
  targetUid: null, workMs: 0, owed: 0, ...over,
})

const gym = (over: Partial<GameState> = {}): GameState =>
  ({ ...initialState(7, 0), decor: [], ...over })

const stain: Stain = { uid: 's1', x: 5, y: 4, ageMs: 0 }

describe('moveStaff', () => {
  it('walks a cleaner toward the stain it was given', () => {
    const before = gym({ staff: [staff({ targetUid: 's1' })], stains: [stain] })
    const after = moveStaff(before, 500)
    const target = at(5, 4)

    const wasAway = Math.hypot(before.staff[0]!.x - target.x, before.staff[0]!.z - target.z)
    const nowAway = Math.hypot(after.staff[0]!.x - target.x, after.staff[0]!.z - target.z)
    expect(nowAway).toBeLessThan(wasAway)
  })

  it('eventually arrives at the stain', () => {
    let s = gym({ staff: [staff({ targetUid: 's1' })], stains: [stain] })
    for (let i = 0; i < 60; i++) s = moveStaff(s, 500)

    const target = at(5, 4)
    expect(Math.hypot(s.staff[0]!.x - target.x, s.staff[0]!.z - target.z)).toBeLessThan(0.2)
  })

  it('sends an idle employee to the aisle', () => {
    let s = gym({ staff: [staff({ x: at(6, 3).x, z: at(6, 3).z })] })
    for (let i = 0; i < 80; i++) s = moveStaff(s, 500)
    expect(s.staff[0]!.x).toBeLessThan(at(0, 0).x)
  })

  it('does not move somebody on strike', () => {
    const before = gym({ staff: [staff({ owed: 1500, targetUid: 's1' })], stains: [stain] })
    expect(moveStaff(before, 1000)).toBe(before)
  })

  it('drops a job it cannot reach instead of stalling', () => {
    const walled = gym({
      staff: [staff({ targetUid: 's1' })],
      stains: [{ uid: 's1', x: 3, y: 3, ageMs: 0 }],
      walls: [
        { uid: 'w1', x: 3, y: 3, side: 'n' },
        { uid: 'w2', x: 3, y: 4, side: 'n' },
        { uid: 'w3', x: 3, y: 3, side: 'w' },
        { uid: 'w4', x: 4, y: 3, side: 'w' },
      ],
    })
    expect(moveStaff(walled, 500).staff[0]!.targetUid).toBeNull()
  })

  it('walks a repairer onto the broken machine tile itself', () => {
    let s = gym({
      staff: [staff({ role: 'repair', targetUid: 'm1' })],
      machines: [{
        uid: 'm1', type: 'dumbbells', x: 3, y: 2, rotation: 0,
        durability: 0, occupiedBy: null, brokenMs: 0,
      }],
    })
    for (let i = 0; i < 60; i++) s = moveStaff(s, 500)

    const target = at(3, 2)
    expect(Math.hypot(s.staff[0]!.x - target.x, s.staff[0]!.z - target.z)).toBeLessThan(0.2)
  })

  it('walks a cleaner onto a stain sitting on a blocked machine tile', () => {
    // Stains spawn on the machine's own tile in real play, so the tile is
    // occupied and blocked — exactly the case that used to make findPath
    // return null and drop the job every tick.
    let s = gym({
      staff: [staff({ role: 'cleaner', targetUid: 's1' })],
      stains: [{ uid: 's1', x: 3, y: 2, ageMs: 0 }],
      machines: [{
        uid: 'm1', type: 'dumbbells', x: 3, y: 2, rotation: 0,
        durability: 100, occupiedBy: null, brokenMs: 0,
      }],
    })
    for (let i = 0; i < 60; i++) s = moveStaff(s, 500)

    const target = at(3, 2)
    expect(Math.hypot(s.staff[0]!.x - target.x, s.staff[0]!.z - target.z)).toBeLessThan(0.2)
    expect(s.staff[0]!.targetUid).toBe('s1')
  })
})
