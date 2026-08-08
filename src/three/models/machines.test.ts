import { describe, it, expect } from 'vitest'
import { MACHINE_TYPES } from '../../game/content/machines'
import { buildMachine } from './machines'
import { stanceFor } from './stance'
import { MACHINE_FOOTPRINT } from './footprint'

/**
 * The failure this feature was most likely to ship: a contract unlocks a
 * machine, the player buys it, and it lands on the floor as nothing at all —
 * no mesh, no footprint, nobody able to stand on it. The `Record<MachineTypeId,
 * …>` types make that a compile error, and these make it a test failure too,
 * because a table can satisfy the type while holding a placeholder.
 */
describe('every machine is a real object on the floor', () => {
  for (const machine of MACHINE_TYPES) {
    it(`builds ${machine.id}`, () => {
      const model = buildMachine(machine.id)
      expect(model.children.length).toBeGreaterThan(0)
    })

    it(`gives ${machine.id} floor space and somewhere to stand`, () => {
      const footprint = MACHINE_FOOTPRINT[machine.id]
      expect(footprint.hx).toBeGreaterThan(0)
      expect(footprint.hz).toBeGreaterThan(0)
      expect(stanceFor(machine.id).pose).toBeTypeOf('function')
    })
  }
})
