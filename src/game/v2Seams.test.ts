import { describe, it, expect } from 'vitest'
import { deserialize } from './save'
import { initialState, emptyLedger } from './economy'
import { SAVE_VERSION } from './constants'
import { advance } from './tick'
import { closeDay } from './dayClose'
import { DAY_MS } from './constants'
import { initialMarketing, normalizeMarketing } from './marketing'
import { initialContracts, normalizeContracts } from './contracts'
import { initialSponsors, normalizeSponsors } from './sponsors'

/**
 * The contract between the three v2 branches and the trunk they share.
 *
 * Owned by whoever is coordinating the split, not by any one feature branch.
 * If a change to advertising, contracts or sponsors makes one of these fail,
 * the fix is in the feature — not here. These are the promises that let three
 * people build three economies in the same file tree without meeting.
 */
describe('v2 seam', () => {
  it('reserves a sealed sub-state per system', () => {
    const s = initialState(1, 0)
    expect(s.marketing).toEqual(initialMarketing())
    expect(s.contracts).toEqual(initialContracts())
    expect(s.sponsors).toEqual(initialSponsors())
  })

  it('opens the three ledger lines at zero', () => {
    expect(emptyLedger().marketingSpend).toBe(0)
    expect(emptyLedger().contractFees).toBe(0)
    expect(emptyLedger().sponsorIncome).toBe(0)
  })

  it('carries a version 8 gym forward rather than wiping it', () => {
    const v8 = JSON.stringify({
      ...initialState(7, 0),
      version: 8,
      cash: 12_345,
      day: 12,
      marketing: undefined,
      contracts: undefined,
      sponsors: undefined,
      today: { ...emptyLedger(), entryFees: 400 },
    })

    const loaded = deserialize(v8, 0)

    expect(loaded.cash).toBe(12_345)
    expect(loaded.day).toBe(12)
    expect(loaded.version).toBe(SAVE_VERSION)
    expect(loaded.marketing).toEqual(initialMarketing())
    expect(loaded.contracts).toEqual(initialContracts())
    expect(loaded.sponsors).toEqual(initialSponsors())
  })

  /**
   * The promise that spares all three branches a save migration each: a gym
   * stored before a feature grew a field still loads, with that field at its
   * default. Break this and every schema change costs a version bump — and a
   * queue at `save.ts`.
   */
  it('repairs a sub-state a stored save never had', () => {
    const damaged = JSON.stringify({
      ...initialState(7, 0),
      cash: 999,
      marketing: undefined,
      contracts: null,
      sponsors: 'nonsense',
    })

    const loaded = deserialize(damaged, 0)

    expect(loaded.cash).toBe(999)
    expect(loaded.marketing).toEqual(initialMarketing())
    expect(loaded.contracts).toEqual(initialContracts())
    expect(loaded.sponsors).toEqual(initialSponsors())
  })

  it('defaults a ledger line rather than printing NaN on the receipt', () => {
    const damaged = JSON.stringify({
      ...initialState(7, 0),
      today: { ...emptyLedger(), sponsorIncome: undefined },
    })

    expect(deserialize(damaged, 0).today.sponsorIncome).toBe(0)
  })

  it('normalises anything at all into a usable sub-state', () => {
    for (const normalize of [normalizeMarketing, normalizeContracts, normalizeSponsors]) {
      expect(() => normalize(undefined)).not.toThrow()
      expect(() => normalize(42)).not.toThrow()
      expect(() => normalize({ junk: true })).not.toThrow()
    }
  })

  it('runs all three systems inside the simulation without disturbing it', () => {
    const before = initialState(3, 0)
    const after = advance(before, 250)
    expect(after.marketing).toEqual(before.marketing)
    expect(after.contracts).toEqual(before.contracts)
    expect(after.sponsors).toEqual(before.sponsors)
  })

  it('prints all three lines on the receipt', () => {
    const closed = closeDay({ ...initialState(3, 0), dayMs: DAY_MS })
    const report = closed.dayReport
    expect(report).not.toBeNull()
    expect(report!.marketingSpend).toBe(0)
    expect(report!.contractFees).toBe(0)
    expect(report!.sponsorIncome).toBe(0)
  })
})
