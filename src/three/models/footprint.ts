import type { BaseMachineTypeId, DecorTypeId, MachineTypeId } from '../../game/types'
import { bySupplierMachine } from '../../game/content/suppliers'

/**
 * How much floor a thing actually takes up, as half-extents in its own local
 * space — x across the model, z front to back. Placement still works a whole
 * tile at a time, but walking does not: a pot plant blocks a pot plant's worth
 * of floor, not the two by two metres of tile it happens to stand on.
 *
 * These are read off the models in `machines.ts` and `decor.ts`, ignoring the
 * parts a person walks under — a loaded barbell hangs above head height, so it
 * is not in the way.
 */
export interface Footprint {
  hx: number
  hz: number
}

const BASE_FOOTPRINT: Record<BaseMachineTypeId, Footprint> = {
  dumbbells: { hx: 0.78, hz: 0.34 },
  bench: { hx: 0.78, hz: 0.3 },
  treadmill: { hx: 0.46, hz: 0.84 },
  latpulldown: { hx: 0.46, hz: 0.62 },
  bike: { hx: 0.42, hz: 0.72 },
  cable: { hx: 0.82, hz: 0.5 },
}

/**
 * Supplier kit is the same equipment built properly, so it stands in the same
 * amount of room as the machine it is a better version of. Deriving it rather
 * than restating it means a rung added to a catalogue cannot arrive with a
 * footprint of zero and let clients walk straight through it.
 */
export const MACHINE_FOOTPRINT: Record<MachineTypeId, Footprint> = {
  ...BASE_FOOTPRINT,
  ...bySupplierMachine(archetype => BASE_FOOTPRINT[archetype]),
}

export const DECOR_FOOTPRINT: Record<DecorTypeId, Footprint> = {
  plant: { hx: 0.36, hz: 0.36 },
  reception: { hx: 0.95, hz: 0.5 },
  locker: { hx: 0.58, hz: 0.28 },
  watercooler: { hx: 0.3, hz: 0.26 },
}
