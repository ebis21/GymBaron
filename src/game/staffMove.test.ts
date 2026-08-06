import { describe, it, expect } from 'vitest'
import { moveStaff } from './staffMove'
import { assignStaff } from './staff'
import { initialState } from './economy'
import { tileToWorld } from './layout'
import type { Client, Decor, GameState, Machine, Staff, Stain } from './types'

const at = (x: number, y: number) => tileToWorld(x, y)

const staff = (over: Partial<Staff> = {}): Staff => ({
  uid: 'e1', name: 'Marta K.', role: 'cleaner', rank: 'legend',
  x: at(-1, 0).x, z: at(-1, 0).z, path: [], goal: null,
  targetUid: null, workMs: 0, owed: 0, ...over,
})

const gym = (over: Partial<GameState> = {}): GameState =>
  ({ ...initialState(7, 0), decor: [], ...over })

const stain: Stain = { uid: 's1', x: 5, y: 4, ageMs: 0 }

const desk = (over: Partial<Decor> = {}): Decor =>
  ({ uid: 'd1', type: 'reception', x: 1, y: 1, rotation: 0, ...over })

const machine = (over: Partial<Machine> = {}): Machine => ({
  uid: 'm1', type: 'dumbbells', x: 4, y: 2, rotation: 0,
  durability: 100, occupiedBy: null, brokenMs: 0, ...over,
})

const client = (over: Partial<Client> = {}): Client => ({
  uid: 'c1', kind: 'walkin', rarity: 'common', phase: 'workout', phaseMs: 0,
  machineUid: 'm1', memberUid: null, trainerUid: null,
  x: at(4, 2).x, z: at(4, 2).z, path: [], goal: null, ...over,
})

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

  /**
   * A striker used to stand exactly where the wage ran out — at the desk, or
   * over a stain — looking for all the world like somebody working. They walk
   * off the job instead, so a strike reads as a strike and not as a bug.
   */
  it('walks somebody on strike off the job and into the aisle', () => {
    let s = gym({
      staff: [staff({ owed: 1500, targetUid: 's1', x: at(5, 4).x, z: at(5, 4).z })],
      stains: [stain],
    })
    for (let i = 0; i < 80; i++) s = moveStaff(s, 500)
    expect(s.staff[0]!.x).toBeLessThan(at(0, 0).x)
  })

  it('leaves a striker who has already stood down alone', () => {
    let s = gym({ staff: [staff({ owed: 1500 })] })
    s = moveStaff(s, 500)
    expect(moveStaff(s, 500)).toBe(s)
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

  /**
   * The whole receptionist bug. A desk in the top row facing north has the
   * attendant's tile at y = -1, off the grid entirely: `findPath` failed, the
   * job was dropped on every single tick, and the receptionist stood in the
   * aisle for the rest of the game while the queue walked out.
   */
  it('walks a receptionist to a desk whose attendant tile is off the grid', () => {
    let s = gym({
      staff: [staff({ role: 'reception' })],
      decor: [desk({ x: 0, y: 0, rotation: 0 })],
    })

    for (let i = 0; i < 60; i++) {
      s = assignStaff(s)
      s = moveStaff(s, 500)
    }

    expect(s.staff[0]!.targetUid).toBe('d1')
    // On a tile touching the desk, not marooned in the aisle.
    const counter = at(0, 0)
    expect(Math.hypot(s.staff[0]!.x - counter.x, s.staff[0]!.z - counter.z)).toBeLessThanOrEqual(2.1)
  })

  it('keeps a settled receptionist still rather than re-planning every tick', () => {
    let s = gym({ staff: [staff({ role: 'reception' })], decor: [desk()] })
    for (let i = 0; i < 60; i++) {
      s = assignStaff(s)
      s = moveStaff(s, 500)
    }

    const settled = assignStaff(s)
    expect(settled).toBe(s)
    expect(moveStaff(settled, 500)).toBe(settled)
  })

  it('walks a trainer to the machine their client booked them for', () => {
    let s = gym({
      staff: [staff({ role: 'trainer', targetUid: 'c1' })],
      machines: [machine({ occupiedBy: 'c1' })],
      clients: [client({ trainerUid: 'e1' })],
    })
    for (let i = 0; i < 60; i++) s = moveStaff(s, 500)

    const kit = at(4, 2)
    expect(Math.hypot(s.staff[0]!.x - kit.x, s.staff[0]!.z - kit.z)).toBeLessThanOrEqual(2.1)
    expect(s.staff[0]!.targetUid).toBe('c1')
  })

  it('sends a trainer back to the aisle once their client has gone', () => {
    let s = gym({
      staff: [staff({ role: 'trainer', targetUid: 'c1', x: at(4, 1).x, z: at(4, 1).z })],
      machines: [machine()],
      clients: [],
    })
    for (let i = 0; i < 80; i++) {
      s = assignStaff(s)
      s = moveStaff(s, 500)
    }
    expect(s.staff[0]!.targetUid).toBeNull()
    expect(s.staff[0]!.x).toBeLessThan(at(0, 0).x)
  })
})
