export type PremiumProductId =
  | 'credits_pack'
  | 'diamonds_pack'
  | 'machines_pack'
  | 'luck_forever'
  | 'double_income_forever'
  | 'legendary_team'

/** Receipt returned only after the native store confirms a transaction. */
export interface StorePurchaseReceipt {
  productId: PremiumProductId
  transactionId: string
}

export interface PremiumState {
  luckMultiplier: 1 | 1.5
  incomeMultiplier: 1 | 2
  ownedProductIds: PremiumProductId[]
  /** Store transaction ids already applied to this save. */
  appliedTransactionIds: string[]
}
