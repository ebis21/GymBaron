import { describe, expect, it } from 'vitest'
import { advanceClients } from './clients'
import { PATIENCE_MS } from './constants'
import { addXp, initialState } from './economy'
import type { Client, GameState } from './types'
import {
  buyUpgrade,
  dailyDiamondReward,
  queuePatienceMs,
  repairPrice,
  upgradeCost,
  xpMultiplier,
} from './upgrades'

const base = (): GameState => initialState(17, 0)

const queuedClient = (): Client => ({
  uid: 'c1',
  kind: 'walkin',
  rarity: 'common',
  phase: 'queue',
  phaseMs: 0,
  machineUid: null,
  memberUid: null,
  trainerUid: null,
  x: 0,
  z: 0,
  path: [],
  goal: null,
})

describe('diamond upgrades', () => {
  it('charges the configured cost and increments one level', () => {
    const state = { ...base(), diamonds: 5 }
    const next = buyUpgrade(state, 'queue_patience')

    expect(next.diamonds).toBe(0)
    expect(next.upgrades.queue_patience).toBe(1)
    expect(upgradeCost(next, 'queue_patience')).toBe(8)
  })

  it('refuses an unaffordable purchase without making a copy', () => {
    const state = { ...base(), diamonds: 4 }
    expect(buyUpgrade(state, 'queue_patience')).toBe(state)
  })

  it('stops at the third level', () => {
    const state: GameState = {
      ...base(),
      diamonds: 100,
      upgrades: { ...base().upgrades, queue_patience: 3 },
    }
    expect(upgradeCost(state, 'queue_patience')).toBeNull()
    expect(buyUpgrade(state, 'queue_patience')).toBe(state)
  })

  it('cannot be bought after game over', () => {
    const state = { ...base(), diamonds: 100, gameOver: true }
    expect(buyUpgrade(state, 'xp_boost')).toBe(state)
  })
})

describe('upgrade effects', () => {
  it('adds ten percent queue patience per level', () => {
    const upgraded: GameState = {
      ...base(),
      upgrades: { ...base().upgrades, queue_patience: 2 },
    }
    expect(queuePatienceMs(upgraded)).toBe(PATIENCE_MS * 1.2)
  })

  it('uses upgraded patience in the client simulation', () => {
    const upgraded: GameState = {
      ...base(),
      upgrades: { ...base().upgrades, queue_patience: 1 },
      clients: [queuedClient()],
    }

    expect(advanceClients(upgraded, PATIENCE_MS + 1).clients).toHaveLength(1)
    expect(advanceClients(upgraded, queuePatienceMs(upgraded) + 1).clients).toHaveLength(0)
  })

  it('discounts repair prices by ten percent per level and rounds up', () => {
    const upgraded: GameState = {
      ...base(),
      upgrades: { ...base().upgrades, repair_discount: 2 },
    }
    expect(repairPrice(upgraded, 111)).toBe(89)
  })

  it('boosts XP and grants one diamond for every crossed level', () => {
    const upgraded: GameState = {
      ...base(),
      upgrades: { ...base().upgrades, xp_boost: 2 },
    }
    const next = addXp(upgraded, 250)

    expect(xpMultiplier(upgraded)).toBe(1.2)
    expect(next.level).toBe(4)
    expect(next.xp).toBe(0)
    expect(next.diamonds).toBe(3)
  })
})

describe('daily diamond reward', () => {
  it('awards one diamond for a very good day with enough visitors', () => {
    const state: GameState = {
      ...base(),
      satisfaction: 75,
      today: { ...base().today, clientsServed: 10 },
    }
    expect(dailyDiamondReward(state)).toBe(1)
  })

  it('awards two diamonds only for the top tier', () => {
    const state: GameState = {
      ...base(),
      satisfaction: 90,
      today: { ...base().today, clientsServed: 20 },
    }
    expect(dailyDiamondReward(state)).toBe(2)
  })

  it('requires both satisfaction and real footfall', () => {
    const state: GameState = {
      ...base(),
      satisfaction: 100,
      today: { ...base().today, clientsServed: 9 },
    }
    expect(dailyDiamondReward(state)).toBe(0)
  })
})
