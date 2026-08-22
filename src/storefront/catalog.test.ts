import { describe, expect, it } from 'vitest'
import { PREMIUM_PRODUCT_COLUMNS, PREMIUM_PRODUCTS, premiumProduct } from './catalog'

describe('premium store catalogue', () => {
  it('contains every requested product exactly once', () => {
    expect(PREMIUM_PRODUCTS.map(product => product.id)).toEqual([
      'credits_5000',
      'credits_20000',
      'credits_100000',
      'credits_1000000',
      'diamonds_5',
      'diamonds_15',
      'diamonds_45',
      'diamonds_200',
      'luck_forever',
      'double_income_forever',
      'legendary_team',
      'machines_pack',
    ])
    expect(new Set(PREMIUM_PRODUCTS.map(product => product.storeProductId)).size).toBe(12)
    expect(PREMIUM_PRODUCT_COLUMNS.flatMap(column => column.productIds)).toEqual(PREMIUM_PRODUCTS.map(product => product.id))
  })

  it('marks restorable boosts and content as non-consumable', () => {
    expect(premiumProduct('luck_forever').kind).toBe('non-consumable')
    expect(premiumProduct('double_income_forever').kind).toBe('non-consumable')
    expect(premiumProduct('credits_5000').kind).toBe('consumable')
    expect(premiumProduct('legendary_team').kind).toBe('non-consumable')
    expect(PREMIUM_PRODUCTS.filter(product => product.kind === 'non-consumable').map(product => product.entitlementId))
      .toEqual(['luck_forever', 'double_income_forever', 'legendary_team'])
  })

  it('pins the approved Polish launch price ladder', () => {
    expect(PREMIUM_PRODUCTS.map(product => product.suggestedPricePln)).toEqual([
      4.99,
      14.99,
      29.99,
      499.99,
      3.99,
      9.99,
      29.99,
      99.99,
      19.99,
      29.99,
      39.99,
      14.99,
    ])
  })

  it('does not describe any paid reward as random', () => {
    const copy = PREMIUM_PRODUCTS
      .flatMap(product => [product.description.en, product.description.pl])
      .join(' ')
      .toLowerCase()
    expect(copy).not.toContain('random machine')
    expect(copy).not.toContain('losowa maszyna')
  })
})
