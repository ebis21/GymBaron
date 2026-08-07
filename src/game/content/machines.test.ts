import { describe, it, expect } from 'vitest'
import { MACHINE_TYPES, machineType } from './machines'
import { START_CASH } from '../constants'
import { en } from '../../i18n/en'
import { pl } from '../../i18n/pl'

describe('machine catalogue', () => {
  it('has a machine affordable with the starting cash', () => {
    const cheapest = Math.min(...MACHINE_TYPES.map(m => m.price))
    expect(cheapest).toBeLessThanOrEqual(START_CASH)
  })

  it('unlocks at least one machine at level 1', () => {
    expect(MACHINE_TYPES.filter(m => m.minLevel === 1).length).toBeGreaterThan(0)
  })

  it('looks a machine up by id', () => {
    expect(machineType('dumbbells').price).toBe(350)
  })

  it('names every machine in both languages', () => {
    for (const m of MACHINE_TYPES) {
      expect(en.content.machines[m.id]).toBeTruthy()
      expect(pl.content.machines[m.id]).toBeTruthy()
    }
  })

  it('throws on an unknown id', () => {
    // @ts-expect-error deliberately invalid id
    expect(() => machineType('nope')).toThrow()
  })

  it('gives every machine sane economics', () => {
    for (const m of MACHINE_TYPES) {
      expect(m.price).toBeGreaterThan(0)
      expect(m.workoutMs).toBeGreaterThan(0)
      expect(m.wearPerUse).toBeGreaterThan(0)
      expect(m.repairCost).toBeGreaterThan(0)
      expect(m.minLevel).toBeGreaterThanOrEqual(1)
    }
  })

  it('has unique ids', () => {
    expect(new Set(MACHINE_TYPES.map(m => m.id)).size).toBe(MACHINE_TYPES.length)
  })
})

describe('durability budget', () => {
  it('breaks every machine within ten workouts', () => {
    for (const type of MACHINE_TYPES) {
      const uses = Math.ceil(100 / type.wearPerUse)
      expect(uses, `${type.id} lasts too long`).toBeLessThanOrEqual(10)
      expect(uses, `${type.id} breaks too fast`).toBeGreaterThanOrEqual(5)
    }
  })

  it('wears the cheap kit slower than the expensive kit', () => {
    const dumbbells = MACHINE_TYPES.find(m => m.id === 'dumbbells')!
    const treadmill = MACHINE_TYPES.find(m => m.id === 'treadmill')!
    expect(dumbbells.wearPerUse).toBeLessThan(treadmill.wearPerUse)
  })
})
