import { describe, expect, it } from 'vitest'
import { advanceClients } from './clients'
import { PATIENCE_MS } from './constants'
import { addXp, initialState } from './economy'
import type { Client, GameState } from './types'
import {
  buyDiamondUpgrade,
  dailyDiamondReward,
  diamondUpgradeCost,
  queuePatienceMs,
  repairPrice,
  xpMultiplier,
} from './diamondUpgrades'

const base = (): GameState => initialState(17, 0)

const queuedClient = (): Client => ({
  uid: 'c1', kind: 'walkin', rarity: 'common', phase: 'queue', phaseMs: 0,
  machineUid: null, memberUid: null, trainerUid: null, x: 0, z: 0,
  path: [], goal: null,
})

describe('diamond upgrades', () => {
  it('charges the configured cost and increments one level', () => {
    const state = { ...base(), diamonds: 5 }
    const next = buyDiamondUpgrade(state, 'queue_patience')
    expect(next.diamonds).toBe(0)
    expect(next.diamondUpgrades.queue_patience).toBe(1)
    expect(diamondUpgradeCost(next, 'queue_patience')).toBe(8)
  })

  it('refuses unaffordable, maxed and post-game purchases', () => {
    const poor = { ...base(), diamonds: 4 }
    expect(buyDiamondUpgrade(poor, 'queue_patience')).toBe(poor)
    const maxed = {
      ...base(), diamonds: 100,
      diamondUpgrades: { ...base().diamondUpgrades, queue_patience: 3 },
    }
    expect(diamondUpgradeCost(maxed, 'queue_patience')).toBeNull()
    expect(buyDiamondUpgrade(maxed, 'queue_patience')).toBe(maxed)
    const over = { ...base(), diamonds: 100, gameOver: true }
    expect(buyDiamondUpgrade(over, 'xp_boost')).toBe(over)
  })
})

describe('diamond upgrade effects', () => {
  it('stacks queue patience on top of the cash track', () => {
    const upgraded: GameState = {
      ...base(),
      upgrades: { ...base().upgrades, patience: 1 },
      diamondUpgrades: { ...base().diamondUpgrades, queue_patience: 2 },
    }
    expect(queuePatienceMs(upgraded)).toBe(30_000 * 1.2)
  })

  it('uses upgraded patience in the client simulation', () => {
    const upgraded: GameState = {
      ...base(),
      diamondUpgrades: { ...base().diamondUpgrades, queue_patience: 1 },
      clients: [queuedClient()],
    }
    expect(advanceClients(upgraded, PATIENCE_MS + 1).clients).toHaveLength(1)
    expect(advanceClients(upgraded, queuePatienceMs(upgraded) + 1).clients).toHaveLength(0)
  })

  it('discounts repair prices and boosts XP plus level diamonds', () => {
    const upgraded: GameState = {
      ...base(),
      diamondUpgrades: { queue_patience: 0, repair_discount: 2, xp_boost: 2 },
    }
    expect(repairPrice(upgraded, 111)).toBe(89)
    expect(xpMultiplier(upgraded)).toBe(1.2)
    const next = addXp(upgraded, 250)
    expect(next.level).toBe(4)
    expect(next.xp).toBe(0)
    expect(next.diamonds).toBe(3)
  })
})

describe('daily diamond reward', () => {
  it('awards the expected satisfaction tiers with real footfall', () => {
    expect(dailyDiamondReward({
      ...base(), satisfaction: 75, today: { ...base().today, clientsServed: 10 },
    })).toBe(1)
    expect(dailyDiamondReward({
      ...base(), satisfaction: 90, today: { ...base().today, clientsServed: 20 },
    })).toBe(2)
    expect(dailyDiamondReward({
      ...base(), satisfaction: 100, today: { ...base().today, clientsServed: 9 },
    })).toBe(0)
  })
})
