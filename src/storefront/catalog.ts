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
    id: 'credits_5000',
    storeProductId: 'gymbaron.credits.5000',
    suggestedPricePln: 4.99,
    kind: 'consumable',
    accent: 'gold',
    glyph: '🪙',
    title: { en: '5,000 credits', pl: '5 000 kredytów' },
    description: {
      en: 'A quick cash boost for everyday gym expenses.',
      pl: 'Szybki zastrzyk gotówki na codzienne wydatki siłowni.',
    },
  },
  {
    id: 'credits_20000',
    storeProductId: 'gymbaron.credits.20000',
    suggestedPricePln: 14.99,
    kind: 'consumable',
    accent: 'gold',
    glyph: '🪙',
    title: { en: '20,000 credits', pl: '20 000 kredytów' },
    description: {
      en: 'Cash for equipment, wages and a solid expansion.',
      pl: 'Gotówka na sprzęt, wypłaty i solidną rozbudowę.',
    },
  },
  {
    id: 'credits_100000',
    storeProductId: 'gymbaron.credits.100000',
    suggestedPricePln: 29.99,
    kind: 'consumable',
    accent: 'gold',
    glyph: '🪙',
    title: { en: '100,000 credits', pl: '100 000 kredytów' },
    description: {
      en: 'A major investment fund for the next stage of the gym.',
      pl: 'Duży fundusz inwestycyjny na kolejny etap siłowni.',
    },
  },
  {
    id: 'credits_1000000',
    storeProductId: 'gymbaron.credits.1000000',
    suggestedPricePln: 499.99,
    kind: 'consumable',
    accent: 'gold',
    glyph: '🪙',
    title: { en: '1,000,000 credits', pl: '1 000 000 kredytów' },
    description: {
      en: 'A million-credit treasury for the biggest expansion plans.',
      pl: 'Milionowy skarbiec na największe plany rozbudowy.',
    },
  },
  {
    id: 'diamonds_5',
    storeProductId: 'gymbaron.diamonds.5',
    suggestedPricePln: 3.99,
    kind: 'consumable',
    accent: 'diamond',
    glyph: '💎',
    title: { en: '5 diamonds', pl: '5 diamentów' },
    description: {
      en: 'A starter pack for the permanent diamond upgrade tracks.',
      pl: 'Pakiet startowy do stałych ulepszeń za diamenty.',
    },
  },
  {
    id: 'diamonds_15',
    storeProductId: 'gymbaron.diamonds.15',
    suggestedPricePln: 9.99,
    kind: 'consumable',
    accent: 'diamond',
    glyph: '💎',
    title: { en: '15 diamonds', pl: '15 diamentów' },
    description: {
      en: 'Premium currency for the permanent diamond upgrade tracks.',
      pl: 'Waluta premium do stałych ulepszeń za diamenty.',
    },
  },
  {
    id: 'diamonds_45',
    storeProductId: 'gymbaron.diamonds.45',
    suggestedPricePln: 29.99,
    kind: 'consumable',
    accent: 'diamond',
    glyph: '💎',
    title: { en: '45 diamonds', pl: '45 diamentów' },
    description: {
      en: 'A larger diamond reserve for permanent upgrade tracks.',
      pl: 'Większy zapas diamentów do stałych ścieżek ulepszeń.',
    },
  },
  {
    id: 'diamonds_200',
    storeProductId: 'gymbaron.diamonds.200',
    suggestedPricePln: 99.99,
    kind: 'consumable',
    accent: 'diamond',
    glyph: '💎',
    title: { en: '200 diamonds', pl: '200 diamentów' },
    description: {
      en: 'A premium diamond vault for long upgrade campaigns.',
      pl: 'Skarbiec diamentów na długie kampanie ulepszeń.',
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
] as const

export const PREMIUM_PRODUCT_COLUMNS = [
  {
    id: 'credits',
    productIds: ['credits_5000', 'credits_20000', 'credits_100000', 'credits_1000000'],
  },
  {
    id: 'diamonds',
    productIds: ['diamonds_5', 'diamonds_15', 'diamonds_45', 'diamonds_200'],
  },
  {
    id: 'boosts',
    productIds: ['luck_forever', 'double_income_forever'],
  },
  {
    id: 'extras',
    productIds: ['legendary_team', 'machines_pack'],
  },
] as const satisfies ReadonlyArray<{
  id: string
  productIds: readonly PremiumProductId[]
}>

export function premiumProduct(id: PremiumProductId): PremiumProduct {
  const product = PREMIUM_PRODUCTS.find(item => item.id === id)
  if (!product) throw new Error(`Unknown premium product: ${id}`)
  return product
}
