import type { GameState, MachineTypeId } from './types'
import { BASE_MACHINE_TYPES } from './content/machines'
import { SUPPLIERS, supplier, type Supplier, type SupplierId } from './content/suppliers'

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
 *
 * A contract gates *buying*, never owning. That is why cancelling one is safe
 * to offer: the daily fee stops, the catalogue closes, and every machine the
 * player already paid for carries on earning exactly as before.
 */
export interface ContractState {
  /** Supplier ids the gym is currently paying for, in signing order. */
  signed: SupplierId[]
}

export const initialContracts = (): ContractState => ({ signed: [] })

const KNOWN = new Set<string>(SUPPLIERS.map(s => s.id))

const isSupplierId = (v: unknown): v is SupplierId =>
  typeof v === 'string' && KNOWN.has(v)

/**
 * Fills in whatever a stored sub-state is missing, so the feature never needs
 * a save migration of its own. See `normalizeMarketing` for the reasoning.
 *
 * Unknown supplier ids are dropped rather than kept: a contract with a firm
 * that has been rebalanced out of the game would otherwise sit in the save
 * charging a fee that `supplier()` can no longer price, and throw at the day's
 * close. Losing the deal is the mild failure; a gym that cannot shut up shop
 * is not.
 */
export function normalizeContracts(raw: unknown): ContractState {
  if (typeof raw !== 'object' || raw === null) return initialContracts()

  const stored = (raw as ContractState).signed
  if (!Array.isArray(stored)) return initialContracts()

  return { signed: [...new Set(stored.filter(isSupplierId))] }
}

export type ContractAction =
  | { type: 'sign'; supplier: SupplierId }
  | { type: 'cancel'; supplier: SupplierId }

/** Whether the gym is currently paying for a given supplier's catalogue. */
export const signed = (state: GameState, id: SupplierId): boolean =>
  state.contracts.signed.includes(id)

/**
 * Why a contract cannot be signed right now, or null if it can. Both the
 * reducer and the screen read this, so the button's reason for being disabled
 * and the reducer's reason for refusing can never drift apart.
 */
export type ContractBlocker = 'signed' | 'level' | 'requires' | 'cash'

export function blockedBy(state: GameState, id: SupplierId): ContractBlocker | null {
  const deal = supplier(id)
  if (signed(state, id)) return 'signed'
  if (state.level < deal.minLevel) return 'level'
  if (deal.requires !== null && !signed(state, deal.requires)) return 'requires'
  if (state.cash < deal.signingFee) return 'cash'
  return null
}

function signContract(state: GameState, id: SupplierId): GameState {
  if (blockedBy(state, id) !== null) return state

  const deal = supplier(id)
  return {
    ...state,
    cash: state.cash - deal.signingFee,
    contracts: { signed: [...state.contracts.signed, id] },
    stats: { ...state.stats, totalSpent: state.stats.totalSpent + deal.signingFee },
  }
}

/**
 * Ends a deal. Deliberately cheap and deliberately reversible: the signing fee
 * is the real cost of a catalogue, so a player who has bought what they wanted
 * should be able to stop paying rent on the privilege. Signing again costs the
 * fee again, which is what keeps that from being free.
 */
function cancelContract(state: GameState, id: SupplierId): GameState {
  if (!signed(state, id)) return state

  return {
    ...state,
    contracts: { signed: state.contracts.signed.filter(held => held !== id) },
  }
}

export function applyContracts(state: GameState, action: ContractAction): GameState {
  switch (action.type) {
    case 'sign':
      return signContract(state, action.supplier)
    case 'cancel':
      return cancelContract(state, action.supplier)
  }
}

/** Nothing about a contract changes by the millisecond; the day is its clock. */
export function advanceContracts(state: GameState, _dtMs: number): GameState {
  return state
}

/**
 * Day settlement. Charges every contract the gym holds, whether or not it
 * bought anything from them — which is the pressure that makes signing a
 * decision rather than a formality.
 *
 * The bill is never trimmed to fit the takings, for the same reason the rent
 * is not: a fee you can dodge by being broke is not a fee.
 */
export function settleContracts(state: GameState): GameState {
  const held = state.contracts.signed
  if (held.length === 0) return state

  const fees = held.reduce((total, id) => total + supplier(id).dailyFee, 0)

  return {
    ...state,
    cash: state.cash - fees,
    today: { ...state.today, contractFees: state.today.contractFees + fees },
    stats: { ...state.stats, totalSpent: state.stats.totalSpent + fees },
  }
}

/**
 * Everything the shop may sell right now: the starting six plus the rungs
 * unlocked by contracts the player has actually signed. The shop reads this
 * rather than `MACHINE_TYPES`, so an unsigned supplier's kit is invisible
 * rather than dangled out of reach.
 */
export function availableMachines(state: GameState): MachineTypeId[] {
  const base = BASE_MACHINE_TYPES.map(m => m.id)
  const unlocked = SUPPLIERS.filter(s => signed(state, s.id)).flatMap(s =>
    s.catalogue.map(m => m.id),
  )
  return [...base, ...unlocked]
}

/** Whether one specific machine is unlocked for purchase. */
export function machineUnlocked(state: GameState, type: MachineTypeId): boolean {
  return availableMachines(state).includes(type)
}

/** Every supplier the player could ever sign, in the order the screen lists them. */
export const suppliers = (): Supplier[] => SUPPLIERS
