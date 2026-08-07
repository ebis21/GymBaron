import { describe, it, expect } from 'vitest'
import { initialState } from './economy'
import {
  buyUpgrade,
  cleanHoldMs,
  earningsMult,
  luckMult,
  patienceMs,
  repairHoldMs,
  upgradeLevel,
  upgradeValue,
} from './upgrades'
import {
  type UpgradeId,
  UPGRADES,
  UPGRADE_IDS,
  emptyUpgrades,
  maxLevel,
  nextUpgrade,
  upgradeTrack,
  upgradeValueAt,
} from './content/upgrades'
import { PATIENCE_MS } from './constants'

const base = () => initialState(1, 0)

/** A gym with money to burn, so a purchase is never refused for being poor. */
const rich = () => ({ ...base(), cash: 10_000_000 })

/** Buys every rung of one track, so the top of the ladder can be inspected. */
const maxed = (id: UpgradeId) => {
  let state = rich()
  for (let i = 0; i < maxLevel(id); i += 1) state = buyUpgrade(state, id)
  return state
}

describe('the upgrade tables', () => {
  it('covers every id exactly once', () => {
    expect(UPGRADE_IDS).toHaveLength(UPGRADES.length)
    expect(new Set(UPGRADE_IDS).size).toBe(UPGRADES.length)
    expect(Object.keys(emptyUpgrades()).sort()).toEqual([...UPGRADE_IDS].sort())
  })

  it('matches the ladders the design fixed', () => {
    expect(upgradeTrack('cleaning').levels.map(l => l.value)).toEqual([2500, 2000, 1500, 1000, 500])
    expect(upgradeTrack('repair').levels.map(l => l.value))
      .toEqual([5500, 5000, 4500, 4000, 3500, 3000, 2000])
    expect(upgradeTrack('earnings').levels.map(l => l.value))
      .toEqual([1.2, 1.4, 1.6, 1.8, 2.0, 3.0, 4.0])
    expect(upgradeTrack('luck').levels.map(l => l.value)).toEqual([1.5, 2.0, 3.0, 4.0])
    expect(upgradeTrack('patience').levels.map(l => l.value)).toEqual([30_000, 35_000, 42_000, 50_000])
  })

  it('starts every track at the value the unupgraded game already had', () => {
    expect(upgradeTrack('cleaning').base).toBe(3000)
    // Raised from the 5s the game used to hold, so the first rung buys something.
    expect(upgradeTrack('repair').base).toBe(6000)
    expect(upgradeTrack('earnings').base).toBe(1)
    expect(upgradeTrack('luck').base).toBe(1)
    expect(upgradeTrack('patience').base).toBe(PATIENCE_MS)
  })

  it('never charges less for a higher rung', () => {
    for (const track of UPGRADES) {
      const prices = track.levels.map(l => l.price)
      for (let i = 1; i < prices.length; i += 1) expect(prices[i]!).toBeGreaterThan(prices[i - 1]!)
    }
  })

  it('always moves a track in the direction that helps the player', () => {
    // Times shrink; multipliers grow. Either way a purchase is never a downgrade.
    for (const track of UPGRADES) {
      const values = [track.base, ...track.levels.map(l => l.value)]
      const improving = track.id === 'cleaning' || track.id === 'repair'
        ? (a: number, b: number) => b < a
        : (a: number, b: number) => b > a

      for (let i = 1; i < values.length; i += 1) {
        expect(improving(values[i - 1]!, values[i]!)).toBe(true)
      }
    }
  })
})

describe('upgradeValueAt', () => {
  it('returns the base at level zero', () => {
    for (const track of UPGRADES) expect(upgradeValueAt(track.id, 0)).toBe(track.base)
  })

  it('clamps a level from outside the ladder rather than returning undefined', () => {
    for (const track of UPGRADES) {
      const top = track.levels[track.levels.length - 1]!.value
      expect(upgradeValueAt(track.id, 99)).toBe(top)
      expect(upgradeValueAt(track.id, -4)).toBe(track.base)
    }
  })
})

describe('nextUpgrade', () => {
  it('offers the first rung to a gym that has bought nothing', () => {
    expect(nextUpgrade('cleaning', 0)).toEqual(upgradeTrack('cleaning').levels[0])
  })

  it('offers nothing at the top of the ladder', () => {
    for (const track of UPGRADES) expect(nextUpgrade(track.id, maxLevel(track.id))).toBeNull()
  })
})

describe('buyUpgrade', () => {
  it('takes the price, raises the level, and books the spend', () => {
    const before = rich()
    const price = upgradeTrack('cleaning').levels[0]!.price

    const after = buyUpgrade(before, 'cleaning')

    expect(upgradeLevel(after, 'cleaning')).toBe(1)
    expect(after.cash).toBe(before.cash - price)
    expect(after.stats.totalSpent).toBe(before.stats.totalSpent + price)
  })

  it('applies the new value immediately', () => {
    expect(cleanHoldMs(base())).toBe(3000)
    expect(cleanHoldMs(buyUpgrade(rich(), 'cleaning'))).toBe(2500)
  })

  it('leaves the other tracks alone', () => {
    const after = buyUpgrade(rich(), 'luck')
    expect(upgradeLevel(after, 'luck')).toBe(1)
    for (const id of UPGRADE_IDS.filter(i => i !== 'luck')) {
      expect(upgradeLevel(after, id)).toBe(0)
    }
  })

  it('refuses when the cash is not there, changing nothing', () => {
    const poor = { ...base(), cash: 10 }
    expect(buyUpgrade(poor, 'cleaning')).toBe(poor)
  })

  it('refuses at the top of the ladder, changing nothing', () => {
    for (const id of UPGRADE_IDS) {
      const top = maxed(id)
      expect(upgradeLevel(top, id)).toBe(maxLevel(id))
      expect(buyUpgrade(top, id)).toBe(top)
    }
  })

  it('refuses once the gym is lost', () => {
    const over = { ...rich(), gameOver: true }
    expect(buyUpgrade(over, 'earnings')).toBe(over)
  })
})

describe('reading a corrupt save', () => {
  it('treats a missing track as unbought rather than spreading NaN', () => {
    // A hand-edited save, or one written by a build that did not have the track.
    const broken = { ...base(), upgrades: {} as Record<UpgradeId, number> }

    expect(upgradeLevel(broken, 'earnings')).toBe(0)
    expect(earningsMult(broken)).toBe(1)
    expect(Number.isFinite(upgradeValue(broken, 'luck'))).toBe(true)
  })
})

describe('the named readers', () => {
  it('report the unupgraded game by default', () => {
    const state = base()
    expect(cleanHoldMs(state)).toBe(3000)
    expect(repairHoldMs(state)).toBe(6000)
    expect(earningsMult(state)).toBe(1)
    expect(luckMult(state)).toBe(1)
    expect(patienceMs(state)).toBe(PATIENCE_MS)
  })

  it('report the top of each ladder once it is bought out', () => {
    expect(cleanHoldMs(maxed('cleaning'))).toBe(500)
    expect(repairHoldMs(maxed('repair'))).toBe(2000)
    expect(earningsMult(maxed('earnings'))).toBe(4)
    expect(luckMult(maxed('luck'))).toBe(4)
    expect(patienceMs(maxed('patience'))).toBe(50_000)
  })
})
