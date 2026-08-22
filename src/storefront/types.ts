export type PremiumProductId =
  | 'credits_5000'
  | 'credits_20000'
  | 'credits_100000'
  | 'credits_1000000'
  | 'diamonds_5'
  | 'diamonds_15'
  | 'diamonds_45'
  | 'diamonds_200'
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
