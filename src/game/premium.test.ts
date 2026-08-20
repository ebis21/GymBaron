import { describe, expect, it } from 'vitest'
import { initialState, passPrice } from './economy'
import { applyPremiumPurchase } from './premium'

const receipt = (productId: Parameters<typeof applyPremiumPurchase>[1]['productId'], transactionId: string) => ({
  productId,
  transactionId,
})

describe('premium purchase fulfillment', () => {
  it('grants consumables and never applies one transaction twice', () => {
    const base = initialState(1, 0)
    const paid = applyPremiumPurchase(base, receipt('credits_pack', 'tx-credit'))
    expect(paid.cash).toBe(base.cash + 10_000)
    expect(applyPremiumPurchase(paid, receipt('credits_pack', 'tx-credit'))).toBe(paid)

    const diamonds = applyPremiumPurchase(paid, receipt('diamonds_pack', 'tx-diamonds'))
    expect(diamonds.diamonds).toBe(25)
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
