import type { PremiumProductId } from './types'

export type { PremiumProductId } from './types'

export type PremiumProductKind = 'consumable' | 'non-consumable'
export type PremiumProductAccent = 'gold' | 'diamond' | 'machine' | 'luck' | 'income' | 'staff'

export interface PremiumProduct {
  id: PremiumProductId
  /** Configure this exact identifier in App Store Connect, Play Console and RevenueCat. */
  storeProductId: string
  /** Configure this entitlement for lifetime products in RevenueCat. */
  entitlementId?: string
  /** Launch price for the Polish storefront; the UI reads the localized store price. */
  suggestedPricePln: number
  kind: PremiumProductKind
  accent: PremiumProductAccent
  glyph: string
  title: { en: string; pl: string }
  description: { en: string; pl: string }
  badge?: { en: string; pl: string }
}

/**
 * The catalogue is deliberately deterministic. Nothing bought for real money
 * opens a random box, so the player always knows exactly what they are paying
 * for and no loot-box odds disclosure is needed.
 *
 * Rewards are descriptions, not client-side fulfillment rules. A verified
 * store transaction has to be fulfilled by the backend before these products
 * may be enabled in production.
 */
export const PREMIUM_PRODUCTS: readonly PremiumProduct[] = [
  {
    id: 'credits_pack',
    storeProductId: 'gymbaron.credits.10000',
    suggestedPricePln: 4.99,
    kind: 'consumable',
    accent: 'gold',
    glyph: '🪙',
    title: { en: '10,000 credits', pl: '10 000 kredytów' },
    description: {
      en: 'A direct cash injection for equipment, wages and expansion.',
      pl: 'Zastrzyk gotówki na sprzęt, wypłaty i rozbudowę.',
    },
  },
  {
    id: 'diamonds_pack',
    storeProductId: 'gymbaron.diamonds.25',
    suggestedPricePln: 9.99,
    kind: 'consumable',
    accent: 'diamond',
    glyph: '💎',
    title: { en: '25 diamonds', pl: '25 diamentów' },
    description: {
      en: 'Premium currency for the permanent diamond upgrade tracks.',
      pl: 'Waluta premium do stałych ulepszeń za diamenty.',
    },
    badge: { en: 'Popular', pl: 'Popularne' },
  },
  {
    id: 'machines_pack',
    storeProductId: 'gymbaron.machines.premium3',
    suggestedPricePln: 14.99,
    kind: 'consumable',
    accent: 'machine',
    glyph: '🏋️',
    title: { en: '3 premium machines', pl: '3 maszyny premium' },
    description: {
      en: 'Apex Bench, Apex Treadmill and Apex Rig delivered directly to the inventory.',
      pl: 'Ławka Apex, bieżnia Apex i platforma Apex dostarczone prosto do ekwipunku.',
    },
  },
  {
    id: 'luck_forever',
    storeProductId: 'gymbaron.boost.luck.forever',
    entitlementId: 'luck_forever',
    suggestedPricePln: 19.99,
    kind: 'non-consumable',
    accent: 'luck',
    glyph: '🍀',
    title: { en: 'Lucky owner', pl: 'Szczęśliwy właściciel' },
    description: {
      en: 'A permanent extra luck multiplier, stacked with upgrades and marketing.',
      pl: 'Stały dodatkowy mnożnik szczęścia, łączony z ulepszeniami i marketingiem.',
    },
    badge: { en: 'Forever', pl: 'Na zawsze' },
  },
  {
    id: 'double_income_forever',
    storeProductId: 'gymbaron.boost.income2x.forever',
    entitlementId: 'double_income_forever',
    suggestedPricePln: 29.99,
    kind: 'non-consumable',
    accent: 'income',
    glyph: '📈',
    title: { en: 'Income ×2', pl: 'Zarobki ×2' },
    description: {
      en: 'Permanently doubles normal gym income. Transfers and rewards stay unchanged.',
      pl: 'Na stałe podwaja zwykły przychód siłowni. Przelewy i nagrody pozostają bez zmian.',
    },
    badge: { en: 'Best value', pl: 'Najlepsza wartość' },
  },
  {
    id: 'legendary_team',
    storeProductId: 'gymbaron.staff.legendary.team',
    entitlementId: 'legendary_team',
    suggestedPricePln: 39.99,
    kind: 'non-consumable',
    accent: 'staff',
    glyph: '👑',
    title: { en: 'Legendary team', pl: 'Legendarna ekipa' },
    description: {
      en: 'Four legendary employees: reception, cleaning, repair and training. No random draw.',
      pl: 'Czworo legendarnych pracowników: recepcja, sprzątanie, naprawy i trening. Bez losowania.',
    },
  },
] as const

export function premiumProduct(id: PremiumProductId): PremiumProduct {
  const product = PREMIUM_PRODUCTS.find(item => item.id === id)
  if (!product) throw new Error(`Unknown premium product: ${id}`)
  return product
}
