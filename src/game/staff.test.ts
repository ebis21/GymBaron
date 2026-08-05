import { describe, it, expect } from 'vitest'
import { assignStaff, workStaff, fire, hire, payArrears, onDuty, restTileFor } from './staff'
import { initialState } from './economy'
import { tileToWorld } from './layout'
import { STAFF_UNLOCK_LEVEL } from './constants'
import type { Candidate, Decor, GameState, Machine, Staff, Stain } from './types'

const at = (x: number, y: number) => tileToWorld(x, y)

const staff = (over: Partial<Staff> = {}): Staff => ({
  uid: 'e1', name: 'Marta K.', role: 'cleaner', rank: 'rare',
  x: at(-1, 0).x, z: at(-1, 0).z, path: [], goal: null,
  targetUid: null, workMs: 0, owed: 0, ...over,
})

const machine = (over: Partial<Machine> = {}): Machine => ({
  uid: 'm1', type: 'dumbbells', x: 4, y: 2, rotation: 0,
  durability: 100, occupiedBy: null, brokenMs: 0, ...over,
})

const stain = (over: Partial<Stain> = {}): Stain => ({ uid: 's1', x: 2, y: 2, ageMs: 0, ...over })

const desk = (over: Partial<Decor> = {}): Decor => ({ uid: 'd1', type: 'reception', x: 1, y: 1, rotation: 0, ...over })

const candidate = (over: Partial<Candidate> = {}): Candidate => ({
  uid: 'k1', name: 'Marta K.', role: 'cleaner', rank: 'rare', price: 1200, ...over,
})

const gym = (over: Partial<GameState> = {}): GameState => ({
  ...initialState(7, 0),
  level: STAFF_UNLOCK_LEVEL,
  ...over,
})

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

  it('sends a receptionist to the desk', () => {
    const s = assignStaff(gym({
      staff: [staff({ role: 'reception' })],
      decor: [desk()],
    }))
    expect(s.staff[0]!.targetUid).toBe('d1')
  })

  it('does not send two receptionists to the same desk', () => {
    const s = assignStaff(gym({
      staff: [staff({ uid: 'e1', role: 'reception' }), staff({ uid: 'e2', role: 'reception' })],
      decor: [desk()],
    }))
    expect(s.staff[0]!.targetUid).toBe('d1')
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

  /**
   * A repaired machine still exists, so `targetTile` used to keep returning
   * its tile and `assignStaff` read the finished job as still live — the
   * repairer stayed pinned to the first machine they fixed and never took a
   * second one.
   */
  it('releases a repairer onto the next wreck once the first is fixed', () => {
    let s = gym({
      staff: [staff({ role: 'repair', targetUid: 'm1', x: at(4, 2).x, z: at(4, 2).z })],
      machines: [machine({ durability: 0 }), machine({ uid: 'm2', x: 5, y: 2, durability: 0 })],
    })

    s = workStaff(s, 12_000)
    expect(s.machines[0]!.durability).toBe(100)

    s = assignStaff(s)
    expect(s.staff[0]!.targetUid).toBe('m2')
  })

  it('keeps a repairer on a machine that is still broken', () => {
    const s = assignStaff(gym({
      staff: [staff({ role: 'repair', targetUid: 'm1', x: at(4, 2).x, z: at(4, 2).z })],
      machines: [machine({ durability: 0 }), machine({ uid: 'm2', x: 5, y: 2, durability: 0 })],
    }))
    expect(s.staff[0]!.targetUid).toBe('m1')
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

describe('hire', () => {
  it('takes the price off cash and puts the candidate on the payroll', () => {
    const before = gym({ candidates: [candidate({ price: 900 })], cash: 2000 })
    const s = hire(before, 'k1')
    expect(s.cash).toBe(1100)
    expect(s.staff).toHaveLength(1)
    expect(s.staff[0]!.name).toBe('Marta K.')
    expect(s.candidates).toHaveLength(0)
    expect(s.stats.totalSpent).toBe(before.stats.totalSpent + 900)
  })

  it('refuses when the player cannot afford the hire', () => {
    const before = gym({ candidates: [candidate({ price: 900 })], cash: 100 })
    expect(hire(before, 'k1')).toBe(before)
  })

  it('refuses below the staff unlock level', () => {
    const before = gym({ level: STAFF_UNLOCK_LEVEL - 1, candidates: [candidate()], cash: 100_000 })
    expect(hire(before, 'k1')).toBe(before)
  })

  it('refuses an unknown candidate', () => {
    const before = gym({ candidates: [candidate()], cash: 100_000 })
    expect(hire(before, 'nope')).toBe(before)
  })

  it('refuses once the payroll is full', () => {
    const full = Array.from({ length: 5 }, (_, i) => ({
      uid: `e${i}`, name: 'X', role: 'cleaner' as const, rank: 'rare' as const,
      x: 0, z: 0, path: [], goal: null, targetUid: null, workMs: 0, owed: 0,
    }))
    const before = gym({ staff: full, candidates: [candidate()], cash: 100_000 })
    expect(hire(before, 'k1')).toBe(before)
  })

  it('refuses a receptionist when there is no desk', () => {
    const before = gym({ candidates: [candidate({ role: 'reception' })], cash: 100_000, decor: [] })
    expect(hire(before, 'k1')).toBe(before)
  })
})

describe('restTileFor', () => {
  it('parks idle staff in the aisle, out of the way', () => {
    expect(restTileFor(gym({ staff: [staff()] }), staff()).x).toBeLessThan(0)
  })
})
