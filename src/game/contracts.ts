import type { GameState, MachineTypeId } from './types'
import { MACHINE_TYPES } from './content/machines'
import { SUPPLIERS } from './content/suppliers'

/**
 * Equipment contracts: a deal with a supplier that opens their catalogue.
 *
 * OWNER: `feat/v2-equipment-contracts`. Nobody else edits this file.
 *
 * The rule the design turns on: signing a contract never takes anything away.
 * Kit already on the floor stays, and the shop keeps everything it sold
 * before — a contract only adds five more machines to what can be bought, each
 * one better than the last. The player climbs a supplier's ladder rather than
 * swapping horses.
 */
export interface ContractState {
  /**
   * Extended by the owner. Everything the feature remembers lives in here —
   * never as a new field on `GameState`.
   */
  readonly placeholder?: never
}

export const initialContracts = (): ContractState => ({})

/**
 * Fills in whatever a stored sub-state is missing, so the feature never needs
 * a save migration of its own. See `normalizeMarketing` for the reasoning.
 */
export function normalizeContracts(raw: unknown): ContractState {
  const base = initialContracts()
  if (typeof raw !== 'object' || raw === null) return base
  return { ...base, ...(raw as ContractState) }
}

export type ContractAction = { type: 'noop' }

export function applyContracts(state: GameState, action: ContractAction): GameState {
  switch (action.type) {
    case 'noop':
      return state
  }
}

/** Per-tick advance — contract terms running down, deliveries landing. */
export function advanceContracts(state: GameState, _dtMs: number): GameState {
  return state
}

/**
 * Day settlement. Charges whatever the signed contracts cost per day and
 * records it in `today.contractFees`, which is what the receipt prints.
 */
export function settleContracts(state: GameState): GameState {
  return state
}

/**
 * Everything the shop may sell right now: the base catalogue plus the rungs
 * unlocked by contracts the player has actually signed. The shop screen reads
 * this rather than `MACHINE_TYPES`, so a locked supplier's kit is invisible
 * until the deal is done.
 */
export function availableMachines(_state: GameState): MachineTypeId[] {
  return MACHINE_TYPES.map(m => m.id)
}

/** Whether one specific machine is unlocked for purchase. */
export function machineUnlocked(state: GameState, type: MachineTypeId): boolean {
  return availableMachines(state).includes(type)
}

/** Every supplier the player could ever sign, in the order the screen lists them. */
export const suppliers = () => SUPPLIERS
