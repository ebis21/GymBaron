import { describe, it, expect } from 'vitest'
import {
  type ConditionKind,
  SPONSORS,
  STRIKES_TO_LAPSE,
  isSponsorId,
  isStanding,
  sponsorDeal,
} from './sponsors'

const kindsOf = (index: number): ConditionKind[] =>
  SPONSORS[index]!.conditions.map(c => c.kind)

describe('the sponsorship board', () => {
  it('names every deal exactly once', () => {
    expect(new Set(SPONSORS.map(s => s.id)).size).toBe(SPONSORS.length)
  })

  it('is a ladder rather than a menu', () => {
    const payouts = SPONSORS.map(s => s.payout)
    expect(payouts).toEqual([...payouts].sort((a, b) => a - b))
    expect(new Set(payouts).size).toBe(payouts.length)
  })

  /**
   * The shape the design fixed: legible at the bottom, a juggling act at the
   * top. A deal that quietly grew a fourth condition would break that promise
   * without breaking anything else, so it is pinned here.
   */
  it('asks for more as it pays more', () => {
    expect(SPONSORS.map(s => s.conditions.length)).toEqual([1, 2, 2, 3, 3])
  })

  it('never measures the same thing twice in one deal', () => {
    for (const deal of SPONSORS) {
      expect(new Set(kindsOf(SPONSORS.indexOf(deal))).size).toBe(deal.conditions.length)
    }
  })

  /**
   * Signing is judged on standing conditions alone. A deal made entirely of
   * daily ones could be signed by any gym at all, which would make the bottom
   * of the ladder indistinguishable from the top on the morning it is signed.
   */
  it('gives every deal something that can be judged at signing', () => {
    for (const deal of SPONSORS) {
      expect(deal.conditions.some(c => isStanding(c.kind))).toBe(true)
    }
  })

  it('keeps every bar inside what the game can actually reach', () => {
    for (const deal of SPONSORS) {
      for (const condition of deal.conditions) {
        expect(condition.value).toBeGreaterThan(0)
        if (condition.kind === 'reputation') expect(condition.value).toBeLessThanOrEqual(100)
      }
    }
  })

  it('prices a second chance at four days of the deal', () => {
    for (const deal of SPONSORS) expect(deal.resignFee).toBe(deal.payout * 4)
  })

  it('reads back a stored id and refuses anything else', () => {
    expect(isSponsorId('juice-bar')).toBe(true)
    expect(isSponsorId('a-brand-that-was-removed')).toBe(false)
    expect(isSponsorId(undefined)).toBe(false)
    expect(isSponsorId(7)).toBe(false)
  })

  it('throws on a lookup the guard should have caught', () => {
    expect(() => sponsorDeal('juice-bar')).not.toThrow()
    // @ts-expect-error — the guard is what stops this reaching here in real code
    expect(() => sponsorDeal('nobody')).toThrow()
  })

  it('ends a deal on the third miss, not the first', () => {
    expect(STRIKES_TO_LAPSE).toBe(3)
  })
})
