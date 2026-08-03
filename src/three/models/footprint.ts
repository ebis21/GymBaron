import type { DecorTypeId, MachineTypeId } from '../../game/types'

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

export const MACHINE_FOOTPRINT: Record<MachineTypeId, Footprint> = {
  dumbbells: { hx: 0.78, hz: 0.34 },
  bench: { hx: 0.78, hz: 0.3 },
  treadmill: { hx: 0.46, hz: 0.84 },
  latpulldown: { hx: 0.46, hz: 0.62 },
  bike: { hx: 0.42, hz: 0.72 },
  cable: { hx: 0.82, hz: 0.5 },
}

export const DECOR_FOOTPRINT: Record<DecorTypeId, Footprint> = {
  plant: { hx: 0.36, hz: 0.36 },
  reception: { hx: 0.95, hz: 0.5 },
  locker: { hx: 0.58, hz: 0.28 },
  watercooler: { hx: 0.3, hz: 0.26 },
}
