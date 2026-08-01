import { describe, it, expect } from 'vitest'
import { MACHINE_TYPES, machineType } from './machines'
import { START_CASH } from '../constants'

describe('machine catalogue', () => {
  it('has a machine affordable with the starting cash', () => {
    const cheapest = Math.min(...MACHINE_TYPES.map(m => m.price))
    expect(cheapest).toBeLessThanOrEqual(START_CASH)
  })

  it('unlocks at least one machine at level 1', () => {
    expect(MACHINE_TYPES.filter(m => m.minLevel === 1).length).toBeGreaterThan(0)
  })

  it('looks a machine up by id', () => {
    expect(machineType('dumbbells').name).toBe('Hantle')
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
