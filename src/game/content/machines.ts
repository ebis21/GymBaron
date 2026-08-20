import type { MachineType, MachineTypeId } from '../types'
import { SUPPLIER_MACHINE_TYPES } from './suppliers'

/**
 * Prices are deliberately unchanged from v1. Progression comes from
 * `revenueMultiplier`, which scales both the door fee and — averaged across
 * the whole floor as the gym class — every membership pass.
 * Wear is deliberately brutal: five to ten workouts and the kit is out of
 * service. A gym with no repairer on the payroll grinds to a halt, which is
 * the whole point of hiring one.
 *
 * The multipliers lean harder on tech than they used to. The bump is graded by
 * where a machine sits on the ladder — nothing at all on the pair a gym opens
 * with, rising to a fifth more at the top of the Apex catalogue — so buying
 * better kit is worth more than buying *more* kit, and the starting hall plays
 * exactly as it always did. See `SUPPLIER_MACHINE_TYPES` for the other end of
 * the same curve.
 */
export const BASE_MACHINE_TYPES: MachineType[] = [
  { id: 'dumbbells',   price: 350,  powerPerDay: 2,  workoutMs: 12_000, satisfaction: 6,  wearPerUse: 10.0, repairCost: 90,  minLevel: 1, xpPerUse: 4,  revenueMultiplier: 1.1 },
  { id: 'bench',       price: 420,  powerPerDay: 3,  workoutMs: 15_000, satisfaction: 8,  wearPerUse: 12.5, repairCost: 110, minLevel: 1, xpPerUse: 5,  revenueMultiplier: 1.28 },
  { id: 'treadmill',   price: 600,  powerPerDay: 12, workoutMs: 20_000, satisfaction: 11, wearPerUse: 20.0, repairCost: 180, minLevel: 2, xpPerUse: 7,  revenueMultiplier: 1.56 },
  { id: 'latpulldown', price: 780,  powerPerDay: 6,  workoutMs: 18_000, satisfaction: 13, wearPerUse: 16.7, repairCost: 200, minLevel: 3, xpPerUse: 9,  revenueMultiplier: 1.79 },
  { id: 'bike',        price: 540,  powerPerDay: 9,  workoutMs: 17_000, satisfaction: 10, wearPerUse: 20.0, repairCost: 150, minLevel: 4, xpPerUse: 7,  revenueMultiplier: 1.45 },
  { id: 'cable',       price: 1200, powerPerDay: 14, workoutMs: 22_000, satisfaction: 18, wearPerUse: 14.3, repairCost: 320, minLevel: 5, xpPerUse: 13, revenueMultiplier: 2.02 },
]

/**
 * The starting six plus everything the suppliers sell. Merging them here is
 * what lets `machineType()` — and therefore the shop, the wear system, the
 * day's bill and the 3D layer — treat a contract's kit as ordinary equipment.
 * What a contract gates is buying it, not owning it: see `contracts.ts`.
 */
export const MACHINE_TYPES: MachineType[] = [...BASE_MACHINE_TYPES, ...SUPPLIER_MACHINE_TYPES]

const BY_ID = new Map<MachineTypeId, MachineType>(MACHINE_TYPES.map(m => [m.id, m]))

export function machineType(id: MachineTypeId): MachineType {
  const t = BY_ID.get(id)
  if (!t) throw new Error(`Unknown machine type: ${id}`)
  return t
}
