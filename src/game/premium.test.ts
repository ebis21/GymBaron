import { describe, expect, it } from 'vitest'
import { initialState, passPrice } from './economy'
import { applyPremiumPurchase } from './premium'

const receipt = (productId: Parameters<typeof applyPremiumPurchase>[1]['productId'], transactionId: string) => ({
  productId,
  transactionId,
})

describe('premium purchase fulfillment', () => {
  it.each([
    ['credits_5000', 5_000],
    ['credits_20000', 20_000],
    ['credits_100000', 100_000],
    ['credits_1000000', 1_000_000],
  ] as const)('grants the %s credit pack', (productId, amount) => {
    const base = initialState(1, 0)
    const paid = applyPremiumPurchase(base, receipt(productId, `tx-${productId}`))
    expect(paid.cash).toBe(base.cash + amount)
    expect(applyPremiumPurchase(paid, receipt(productId, `tx-${productId}`))).toBe(paid)
  })

  it.each([
    ['diamonds_5', 5],
    ['diamonds_15', 15],
    ['diamonds_45', 45],
    ['diamonds_200', 200],
  ] as const)('grants the %s diamond pack', (productId, amount) => {
    const base = initialState(1, 0)
    const paid = applyPremiumPurchase(base, receipt(productId, `tx-${productId}`))
    expect(paid.diamonds).toBe(amount)
    expect(applyPremiumPurchase(paid, receipt(productId, `tx-${productId}`))).toBe(paid)
  })

  it('delivers the three named Apex machines to inventory', () => {
    const paid = applyPremiumPurchase(initialState(1, 0), receipt('machines_pack', 'tx-machines'))
    expect(paid.inventory.map(item => item.kind === 'machine' ? item.type : item.kind)).toEqual([
      'apex-bench',
      'apex-treadmill',
      'apex-rig',
    ])
  })

  it('persists permanent multipliers and does not duplicate a lifetime product', () => {
    const base = initialState(1, 0)
    const lucky = applyPremiumPurchase(base, receipt('luck_forever', 'tx-luck'))
    expect(lucky.premium.luckMultiplier).toBe(1.5)

    const rich = applyPremiumPurchase(lucky, receipt('double_income_forever', 'tx-income'))
    expect(passPrice(rich)).toBeCloseTo(passPrice(lucky) * 2)

    const retried = applyPremiumPurchase(rich, receipt('double_income_forever', 'tx-income-2'))
    expect(retried.premium.ownedProductIds.filter(id => id === 'double_income_forever')).toHaveLength(1)
  })

  it('adds one legendary employee for every role, once', () => {
    const paid = applyPremiumPurchase(initialState(1, 0), receipt('legendary_team', 'tx-team'))
    expect(paid.staff.map(member => [member.role, member.rank])).toEqual([
      ['reception', 'legend'],
      ['cleaner', 'legend'],
      ['repair', 'legend'],
      ['trainer', 'legend'],
    ])
    const restored = applyPremiumPurchase(paid, receipt('legendary_team', 'tx-team-restored'))
    expect(restored.staff).toHaveLength(4)
  })
})
