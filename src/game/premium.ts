import { addToInventory } from './build'
import { staffDoorPoint } from './layout'
import type { GameState, StaffRole } from './types'
import { premiumProduct } from '../storefront/catalog'
import type {
  PremiumState,
  StorePurchaseReceipt,
} from '../storefront/types'

export const initialPremiumState = (): PremiumState => ({
  luckMultiplier: 1,
  incomeMultiplier: 1,
  ownedProductIds: [],
  appliedTransactionIds: [],
})

const remember = (state: GameState, receipt: StorePurchaseReceipt): GameState => ({
  ...state,
  premium: {
    ...state.premium,
    appliedTransactionIds: [
      ...state.premium.appliedTransactionIds,
      receipt.transactionId,
    ],
  },
})

const own = (state: GameState, receipt: StorePurchaseReceipt): GameState => {
  if (state.premium.ownedProductIds.includes(receipt.productId)) return remember(state, receipt)
  return {
    ...state,
    premium: {
      ...state.premium,
      ownedProductIds: [...state.premium.ownedProductIds, receipt.productId],
      appliedTransactionIds: [
        ...state.premium.appliedTransactionIds,
        receipt.transactionId,
      ],
    },
  }
}

function addLegendaryTeam(state: GameState): GameState {
  const door = staffDoorPoint()
  const team: Array<{ name: string; role: StaffRole }> = [
    { name: 'Avery B.', role: 'reception' },
    { name: 'Morgan B.', role: 'cleaner' },
    { name: 'Riley B.', role: 'repair' },
    { name: 'Jordan B.', role: 'trainer' },
  ]
  let nextUid = state.nextUid
  const staff = team.map(member => ({
    uid: `s${nextUid++}`,
    name: member.name,
    role: member.role,
    rank: 'legend' as const,
    targetUid: null,
    workMs: 0,
    owed: 0,
    x: door.x,
    z: door.z,
    path: [],
    goal: null,
  }))
  return { ...state, nextUid, staff: [...state.staff, ...staff] }
}

/**
 * Applies a store-confirmed purchase exactly once. The reducer is deliberately
 * pure and persisted with the rest of the save, so a retry after an app crash
 * cannot mint a second reward for the same transaction.
 */
export function applyPremiumPurchase(
  state: GameState,
  receipt: StorePurchaseReceipt,
): GameState {
  if (!receipt.transactionId || state.premium.appliedTransactionIds.includes(receipt.transactionId)) {
    return state
  }

  // Reject identifiers outside the checked catalogue before touching a save.
  const product = premiumProduct(receipt.productId)

  if (product.kind === 'non-consumable' && state.premium.ownedProductIds.includes(product.id)) {
    return remember(state, receipt)
  }

  switch (receipt.productId) {
    case 'credits_pack':
      return remember({ ...state, cash: state.cash + 10_000 }, receipt)
    case 'diamonds_pack':
      return remember({ ...state, diamonds: state.diamonds + 25 }, receipt)
    case 'machines_pack': {
      let next = state
      for (const type of ['apex-bench', 'apex-treadmill', 'apex-rig'] as const) {
        next = addToInventory(next, { kind: 'machine', type })
      }
      return remember(next, receipt)
    }
    case 'luck_forever': {
      const owned = own(state, receipt)
      return { ...owned, premium: { ...owned.premium, luckMultiplier: 1.5 } }
    }
    case 'double_income_forever': {
      const owned = own(state, receipt)
      return { ...owned, premium: { ...owned.premium, incomeMultiplier: 2 } }
    }
    case 'legendary_team':
      return own(addLegendaryTeam(state), receipt)
  }
}
