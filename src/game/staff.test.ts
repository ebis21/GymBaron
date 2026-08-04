import { describe, it, expect } from 'vitest'
import { assignStaff, workStaff, fire, payArrears, onDuty, restTileFor } from './staff'
import { initialState } from './economy'
import { tileToWorld } from './layout'
import type { GameState, Machine, Staff, Stain } from './types'

const at = (x: number, y: number) => tileToWorld(x, y)

const staff = (over: Partial<Staff> = {}): Staff => ({
  uid: 'e1', name: 'Marta K.', role: 'cleaner', rank: 'rare',
  x: at(-1, 0).x, z: at(-1, 0).z, path: [], goal: null,
  targetUid: null, workMs: 0, owed: 0, ...over,
})

const machine = (over: Partial<Machine> = {}): Machine => ({
  uid: 'm1', type: 'dumbbells', x: 4, y: 2, rotation: 0,
  durability: 100, occupiedBy: null, ...over,
})

const stain = (over: Partial<Stain> = {}): Stain => ({ uid: 's1', x: 2, y: 2, ageMs: 0, ...over })

const gym = (over: Partial<GameState> = {}): GameState => ({ ...initialState(7, 0), ...over })

describe('onDuty', () => {
  it('counts a paid employee as working', () => {
    expect(onDuty(staff())).toBe(true)
  })

  it('counts an unpaid employee as on strike', () => {
    expect(onDuty(staff({ owed: 1500 }))).toBe(false)
  })
})

describe('assignStaff', () => {
  it('sends a cleaner to the oldest stain, not the nearest', () => {
    const s = assignStaff(gym({
      staff: [staff()],
      stains: [stain({ uid: 'near', x: 0, y: 0, ageMs: 0 }), stain({ uid: 'old', x: 7, y: 5, ageMs: 9000 })],
    }))
    expect(s.staff[0]!.targetUid).toBe('old')
  })

  it('sends a repairer to a broken machine', () => {
    const s = assignStaff(gym({
      staff: [staff({ role: 'repair' })],
      machines: [machine({ durability: 0 })],
    }))
    expect(s.staff[0]!.targetUid).toBe('m1')
  })

  it('leaves a repairer idle when nothing is broken', () => {
    const s = assignStaff(gym({ staff: [staff({ role: 'repair' })], machines: [machine()] }))
    expect(s.staff[0]!.targetUid).toBeNull()
  })

  it('never assigns work to somebody on strike', () => {
    const s = assignStaff(gym({ staff: [staff({ owed: 1500 })], stains: [stain()] }))
    expect(s.staff[0]!.targetUid).toBeNull()
  })

  it('does not send two cleaners to the same stain', () => {
    const s = assignStaff(gym({
      staff: [staff({ uid: 'e1' }), staff({ uid: 'e2' })],
      stains: [stain()],
    }))
    expect(s.staff[1]!.targetUid).toBeNull()
  })
})

describe('workStaff', () => {
  it('wipes a stain after the rank work time', () => {
    // A rare cleaner standing on the stain needs 6000 ms.
    let s = gym({
      staff: [staff({ targetUid: 's1', x: at(2, 2).x, z: at(2, 2).z })],
      stains: [stain()],
    })
    s = workStaff(s, 6000)
    expect(s.stains).toHaveLength(0)
  })

  it('does not finish early', () => {
    let s = gym({
      staff: [staff({ targetUid: 's1', x: at(2, 2).x, z: at(2, 2).z })],
      stains: [stain()],
    })
    s = workStaff(s, 3000)
    expect(s.stains).toHaveLength(1)
  })

  it('does not work from across the room', () => {
    let s = gym({
      staff: [staff({ targetUid: 's1', x: at(7, 5).x, z: at(7, 5).z })],
      stains: [stain()],
    })
    s = workStaff(s, 60_000)
    expect(s.stains).toHaveLength(1)
  })

  it('restores a machine to full and charges nothing', () => {
    const before = gym({
      staff: [staff({ role: 'repair', targetUid: 'm1', x: at(4, 2).x, z: at(4, 2).z })],
      machines: [machine({ durability: 0 })],
      cash: 500,
    })
    const s = workStaff(before, 12_000)
    expect(s.machines[0]!.durability).toBe(100)
    expect(s.cash).toBe(500)
  })
})

describe('fire', () => {
  it('removes a paid employee', () => {
    const s = fire(gym({ staff: [staff()] }), 'e1')
    expect(s.staff).toHaveLength(0)
  })

  it('refuses to release somebody still owed wages', () => {
    const before = gym({ staff: [staff({ owed: 1500 })] })
    expect(fire(before, 'e1')).toBe(before)
  })
})

describe('payArrears', () => {
  it('clears the debt and puts them back to work', () => {
    const s = payArrears(gym({ staff: [staff({ owed: 1500 })], cash: 5000 }), 'e1')
    expect(s.staff[0]!.owed).toBe(0)
    expect(s.cash).toBe(3500)
    expect(onDuty(s.staff[0]!)).toBe(true)
  })

  it('does nothing when the player cannot cover it', () => {
    const before = gym({ staff: [staff({ owed: 1500 })], cash: 100 })
    expect(payArrears(before, 'e1')).toBe(before)
  })
})

describe('restTileFor', () => {
  it('parks idle staff in the aisle, out of the way', () => {
    expect(restTileFor(gym({ staff: [staff()] }), staff()).x).toBeLessThan(0)
  })
})
