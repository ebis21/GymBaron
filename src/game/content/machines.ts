import type { MachineType, MachineTypeId } from '../types'

/**
 * Prices are deliberately unchanged from v1. Progression comes from
 * `revenueMultiplier`, which scales both the door fee and — averaged across
 * the whole floor as the gym class — every membership pass.
 * Wear is deliberately brutal: five to ten workouts and the kit is out of
 * service. A gym with no repairer on the payroll grinds to a halt, which is
 * the whole point of hiring one.
 */
export const MACHINE_TYPES: MachineType[] = [
  { id: 'dumbbells',   price: 350,  powerPerDay: 2,  workoutMs: 12_000, satisfaction: 6,  wearPerUse: 10.0, repairCost: 90,  minLevel: 1, xpPerUse: 4,  revenueMultiplier: 1.1 },
  { id: 'bench',       price: 420,  powerPerDay: 3,  workoutMs: 15_000, satisfaction: 8,  wearPerUse: 12.5, repairCost: 110, minLevel: 1, xpPerUse: 5,  revenueMultiplier: 1.25 },
  { id: 'treadmill',   price: 600,  powerPerDay: 12, workoutMs: 20_000, satisfaction: 11, wearPerUse: 20.0, repairCost: 180, minLevel: 2, xpPerUse: 7,  revenueMultiplier: 1.5 },
  { id: 'latpulldown', price: 780,  powerPerDay: 6,  workoutMs: 18_000, satisfaction: 13, wearPerUse: 16.7, repairCost: 200, minLevel: 3, xpPerUse: 9,  revenueMultiplier: 1.7 },
  { id: 'bike',        price: 540,  powerPerDay: 9,  workoutMs: 17_000, satisfaction: 10, wearPerUse: 20.0, repairCost: 150, minLevel: 4, xpPerUse: 7,  revenueMultiplier: 1.4 },
  { id: 'cable',       price: 1200, powerPerDay: 14, workoutMs: 22_000, satisfaction: 18, wearPerUse: 14.3, repairCost: 320, minLevel: 5, xpPerUse: 13, revenueMultiplier: 1.9 },
]

const BY_ID = new Map<MachineTypeId, MachineType>(MACHINE_TYPES.map(m => [m.id, m]))

export function machineType(id: MachineTypeId): MachineType {
  const t = BY_ID.get(id)
  if (!t) throw new Error(`Unknown machine type: ${id}`)
  return t
}
