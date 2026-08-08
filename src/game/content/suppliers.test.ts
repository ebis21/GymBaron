import { describe, it, expect } from 'vitest'
import { SUPPLIERS, SUPPLIER_MACHINE_TYPES, supplierOf } from './suppliers'
import { BASE_MACHINE_TYPES, MACHINE_TYPES } from './machines'

const bestBase = Math.max(...BASE_MACHINE_TYPES.map(m => m.revenueMultiplier))

describe('supplier catalogues', () => {
  it('gives every contract five machines to sell', () => {
    expect(SUPPLIERS.length).toBeGreaterThan(0)
    for (const supplier of SUPPLIERS) {
      expect(supplier.catalogue).toHaveLength(5)
    }
  })

  /**
   * The promise the feature is built on: a contract is a ladder, not a menu.
   * A rung that does not out-earn the one below it is a rung nobody would
   * ever climb to, and the player would have to read six numbers to find that
   * out for themselves.
   */
  it('never steps down — each rung out-earns the one before it', () => {
    const ladder = SUPPLIERS.flatMap(s => s.catalogue)
    for (let i = 1; i < ladder.length; i++) {
      expect(ladder[i]!.revenueMultiplier).toBeGreaterThan(ladder[i - 1]!.revenueMultiplier)
    }
  })

  it('starts above the best kit the gym could already buy', () => {
    const first = SUPPLIERS[0]!.catalogue[0]!
    expect(first.revenueMultiplier).toBeGreaterThan(bestBase)
  })

  /** A rung that earns more must cost more, or the ladder has a free step. */
  it('charges more for every rung it climbs', () => {
    const ladder = SUPPLIERS.flatMap(s => s.catalogue)
    for (let i = 1; i < ladder.length; i++) {
      expect(ladder[i]!.price).toBeGreaterThan(ladder[i - 1]!.price)
    }
  })

  it('resolves supplier kit through the ordinary machine table', () => {
    for (const machine of SUPPLIER_MACHINE_TYPES) {
      expect(MACHINE_TYPES).toContainEqual(machine)
    }
  })

  it('leaves the starting six unclaimed by any supplier', () => {
    for (const machine of BASE_MACHINE_TYPES) {
      expect(supplierOf(machine.id)).toBeNull()
    }
  })

  it('traces every piece of supplier kit back to the contract that unlocks it', () => {
    for (const supplier of SUPPLIERS) {
      for (const machine of supplier.catalogue) {
        expect(supplierOf(machine.id)).toBe(supplier.id)
      }
    }
  })
})
