import type { BaseMachineTypeId, MachineType } from '../types'

/**
 * The suppliers and their catalogues.
 *
 * OWNER: `feat/v2-equipment-contracts`. Nobody else edits this file.
 *
 * Every machine a contract unlocks is declared here, and `MachineTypeId` in
 * `types.ts` is `BaseMachineTypeId | SupplierMachineTypeId` — so widening the
 * union is a change to this file alone.
 *
 * The point of the whole feature is that the game's only revenue lever,
 * `revenueMultiplier`, currently stops at the cable crossover's 1.9. Fill the
 * floor with those and there is nothing left to buy. This is the ladder that
 * carries on: ten rungs from 2.1 to 6.2, each one strictly better earning than
 * the last and strictly dearer, gated behind contracts the player has to keep
 * paying for.
 */
export type SupplierId = 'ferrum' | 'apex'

/**
 * Machines a contract unlocks. Prefixed by supplier so an id says where it
 * came from without a lookup, which matters in save files and in the shop.
 */
export type SupplierMachineTypeId =
  | 'ferrum-rack' | 'ferrum-bench' | 'ferrum-bike' | 'ferrum-pulldown' | 'ferrum-cable'
  | 'apex-bench' | 'apex-treadmill' | 'apex-pulldown' | 'apex-cable' | 'apex-rig'

export interface Supplier {
  id: SupplierId
  /** Paid once, at signing. The real cost of the deal. */
  signingFee: number
  /**
   * Charged every day the contract is held, whether or not the player buys
   * anything. A catalogue left unused is a bill, which is what stops the
   * player from signing everything the moment they can afford the fee.
   */
  dailyFee: number
  minLevel: number
  /** Contract that has to be signed first, or null for the first rung. */
  requires: SupplierId | null
  /**
   * The five rungs this supplier sells, weakest first. `suppliers.test.ts`
   * holds the ladder to rising earnings and rising prices in this order.
   */
  catalogue: MachineType[]
}

/**
 * Ferrum Works — a regional steel shop that will talk to anybody with a
 * repairer on the payroll. Cheap to sign and cheap to hold, and the kit
 * earns roughly double what the starting six do.
 *
 * It does not last any longer. Every machine in the game breaks inside five to
 * ten workouts — that invariant is what makes a repairer worth a wage, and
 * `machines.test.ts` enforces it across this catalogue too. So the ladder buys
 * takings, never peace: the better the kit, the dearer the repair bill it runs
 * up at the same rate.
 */
const FERRUM: Supplier = {
  id: 'ferrum',
  signingFee: 4_000,
  dailyFee: 60,
  minLevel: 6,
  requires: null,
  catalogue: [
    { id: 'ferrum-rack',     price: 2_400, powerPerDay: 4,  workoutMs: 13_000, satisfaction: 20, wearPerUse: 11.0,  repairCost: 380, minLevel: 6, xpPerUse: 15, revenueMultiplier: 2.1 },
    { id: 'ferrum-bench',    price: 3_200, powerPerDay: 5,  workoutMs: 16_000, satisfaction: 23, wearPerUse: 12.5,  repairCost: 460, minLevel: 6, xpPerUse: 17, revenueMultiplier: 2.4 },
    { id: 'ferrum-bike',     price: 4_100, powerPerDay: 16, workoutMs: 18_000, satisfaction: 26, wearPerUse: 14.3, repairCost: 560, minLevel: 7, xpPerUse: 19, revenueMultiplier: 2.7 },
    { id: 'ferrum-pulldown', price: 5_400, powerPerDay: 9,  workoutMs: 19_000, satisfaction: 29, wearPerUse: 12.5, repairCost: 700, minLevel: 7, xpPerUse: 22, revenueMultiplier: 3.0 },
    { id: 'ferrum-cable',    price: 7_200, powerPerDay: 18, workoutMs: 22_000, satisfaction: 33, wearPerUse: 16.7, repairCost: 900, minLevel: 8, xpPerUse: 26, revenueMultiplier: 3.4 },
  ],
}

/**
 * Apex Athletic — a national brand that only supplies gyms already running a
 * Ferrum contract. The kit earns like nothing else in the game and
 * bleeds money to match: the top rung draws more power per day than the
 * starting six combined, breaks in five workouts flat, and costs three and a
 * half thousand to put right each time. A gym running Apex kit without a
 * repairer on the payroll stops inside an afternoon. Late-game money has to
 * have somewhere to go, and this is it.
 */
const APEX: Supplier = {
  id: 'apex',
  signingFee: 22_000,
  dailyFee: 320,
  minLevel: 10,
  requires: 'ferrum',
  catalogue: [
    { id: 'apex-bench',     price: 11_000, powerPerDay: 8,  workoutMs: 16_000, satisfaction: 38, wearPerUse: 14.3, repairCost: 1_300, minLevel: 10, xpPerUse: 30, revenueMultiplier: 3.9 },
    { id: 'apex-treadmill', price: 15_000, powerPerDay: 34, workoutMs: 20_000, satisfaction: 42, wearPerUse: 16.7, repairCost: 1_700, minLevel: 11, xpPerUse: 34, revenueMultiplier: 4.4 },
    { id: 'apex-pulldown',  price: 19_500, powerPerDay: 12, workoutMs: 19_000, satisfaction: 46, wearPerUse: 14.3, repairCost: 2_100, minLevel: 12, xpPerUse: 38, revenueMultiplier: 4.9 },
    { id: 'apex-cable',     price: 26_000, powerPerDay: 24, workoutMs: 22_000, satisfaction: 52, wearPerUse: 16.7, repairCost: 2_800, minLevel: 13, xpPerUse: 44, revenueMultiplier: 5.5 },
    { id: 'apex-rig',       price: 36_000, powerPerDay: 30, workoutMs: 24_000, satisfaction: 60, wearPerUse: 20.0, repairCost: 3_600, minLevel: 14, xpPerUse: 52, revenueMultiplier: 6.2 },
  ],
}

/** In signing order — the screen lists them as a ladder, because they are one. */
export const SUPPLIERS: Supplier[] = [FERRUM, APEX]

/**
 * Which of the starting six each piece of supplier kit is a better version of.
 *
 * This is not a shortcut around the art: supplier kit *is* the same equipment
 * built properly, so it reads as the same silhouette on the floor and a client
 * uses it the same way. The 3D model, the footprint, the stance and the shop
 * icon are all derived from the archetype through this map, which means adding
 * a rung to a catalogue cannot leave a machine with no mesh — the failure this
 * feature was most likely to ship.
 *
 * Names are the deliberate exception. Those are declared by hand in
 * `t.content.machines`, because a name is the one thing that cannot be derived
 * and the one thing a player would notice missing.
 */
const ARCHETYPE: Record<SupplierMachineTypeId, BaseMachineTypeId> = {
  'ferrum-rack': 'dumbbells',
  'ferrum-bench': 'bench',
  'ferrum-bike': 'bike',
  'ferrum-pulldown': 'latpulldown',
  'ferrum-cable': 'cable',
  'apex-bench': 'bench',
  'apex-treadmill': 'treadmill',
  'apex-pulldown': 'latpulldown',
  'apex-cable': 'cable',
  'apex-rig': 'cable',
}

export const archetypeOf = (id: SupplierMachineTypeId): BaseMachineTypeId => ARCHETYPE[id]

/**
 * Builds one entry per piece of supplier kit from whatever the archetype
 * already has. Every `Record<MachineTypeId, …>` in the 3D layer is assembled
 * this way, so the six hand-written entries stay hand-written and the ten
 * derived ones cannot fall out of step with them.
 */
export function bySupplierMachine<T>(
  make: (archetype: BaseMachineTypeId, id: SupplierMachineTypeId) => T,
): Record<SupplierMachineTypeId, T> {
  const ids = Object.keys(ARCHETYPE) as SupplierMachineTypeId[]
  return Object.fromEntries(ids.map(id => [id, make(ARCHETYPE[id], id)])) as Record<
    SupplierMachineTypeId,
    T
  >
}

/**
 * Flattened catalogue, merged into `MACHINE_TYPES` so that `machineType()`
 * resolves supplier kit exactly like the starting equipment. Nothing
 * downstream needs to know where a machine came from.
 */
export const SUPPLIER_MACHINE_TYPES: MachineType[] = SUPPLIERS.flatMap(s => s.catalogue)

const OWNER = new Map<string, SupplierId>(
  SUPPLIERS.flatMap(s => s.catalogue.map(m => [m.id, s.id] as const)),
)

/** Which contract unlocks a machine, or null for the six that need none. */
export function supplierOf(id: string): SupplierId | null {
  return OWNER.get(id) ?? null
}

export function supplier(id: SupplierId): Supplier {
  const found = SUPPLIERS.find(s => s.id === id)
  if (!found) throw new Error(`Unknown supplier: ${id}`)
  return found
}
