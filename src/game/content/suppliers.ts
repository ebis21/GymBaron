import type { MachineType } from '../types'

/**
 * The suppliers and their catalogues.
 *
 * OWNER: `feat/v2-equipment-contracts`. Nobody else edits this file.
 *
 * Every machine a contract unlocks is declared here, and `MachineTypeId` in
 * `types.ts` is `BaseMachineTypeId | SupplierMachineTypeId` — so widening the
 * union is a change to this file alone. The compiler then walks the owner
 * through every table that has to grow to match (`STANCES`,
 * `MACHINE_FOOTPRINT`, the model `BUILDERS`, `t.content.machines`), which is
 * exactly the checklist that would otherwise be discovered at runtime as a
 * blank label or a missing mesh.
 */
export type SupplierId = string

/**
 * Machines a contract unlocks. Starts as `never`, which leaves `MachineTypeId`
 * exactly the six the game shipped with — the owner replaces it with a union
 * of their own ids.
 */
export type SupplierMachineTypeId = never

export interface Supplier {
  id: SupplierId
  /**
   * The five rungs this supplier sells, weakest first. The design brief is
   * explicit that a contract is a ladder rather than a menu: each entry has to
   * beat the one before it.
   */
  catalogue: MachineType[]
}

/** Empty until the owner fills it in; the shop falls back to the base six. */
export const SUPPLIERS: Supplier[] = []

/**
 * Flattened catalogue, merged into `MACHINE_TYPES` so that `machineType()`
 * resolves supplier kit exactly like the starting equipment. Nothing
 * downstream needs to know where a machine came from.
 */
export const SUPPLIER_MACHINE_TYPES: MachineType[] = SUPPLIERS.flatMap(s => s.catalogue)
