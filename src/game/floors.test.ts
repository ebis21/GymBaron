import { describe, expect, it } from 'vitest'
import { FLOOR_UNLOCK_COST } from './constants'
import { MAX_EXPANSION } from './content/expansion'
import { initialState } from './economy'
import {
  canSwitchFloor,
  floorAccessVisible,
  switchActiveFloor,
  unlockNextFloor,
} from './floors'
import type { Client, GameState, Machine } from './types'

const ready = (over: Partial<GameState> = {}): GameState => ({
  ...initialState(17, 0),
  expansion: MAX_EXPANSION,
  cash: FLOOR_UNLOCK_COST + 500,
  ...over,
})

const bench: Machine = {
  uid: 'm-ground',
  type: 'bench',
  x: 2,
  y: 2,
  rotation: 0,
  durability: 100,
  occupiedBy: null,
  brokenMs: 0,
}

describe('floor access', () => {
  it('does not appear before every ground-floor expansion is bought', () => {
    expect(floorAccessVisible(ready({ expansion: MAX_EXPANSION - 1 }))).toBe(false)
    expect(floorAccessVisible(ready())).toBe(true)
  })

  it('refuses the purchase before the ladder is complete or without enough cash', () => {
    const tooSmall = ready({ expansion: MAX_EXPANSION - 1 })
    const tooPoor = ready({ cash: FLOOR_UNLOCK_COST - 1 })

    expect(unlockNextFloor(tooSmall)).toBe(tooSmall)
    expect(unlockNextFloor(tooPoor)).toBe(tooPoor)
  })

  it('charges 100k once and adds an empty first floor', () => {
    const state = ready({ machines: [bench], stats: { ...ready().stats, totalSpent: 25 } })
    const unlocked = unlockNextFloor(state)

    expect(unlocked.cash).toBe(500)
    expect(unlocked.stats.totalSpent).toBe(FLOOR_UNLOCK_COST + 25)
    expect(unlocked.floorPlans).toHaveLength(2)
    expect(unlocked.floorPlans[0]!.machines).toEqual([bench])
    expect(unlocked.floorPlans[1]).toMatchObject({ expansion: 0, machines: [], decor: [] })
    expect(unlockNextFloor(unlocked)).toBe(unlocked)
  })
})

describe('switching floors', () => {
  it('keeps each floor plan independent when moving there and back', () => {
    const ground = unlockNextFloor(ready({ machines: [bench] }))
    const upstairs = switchActiveFloor(ground, 1)

    expect(upstairs.activeFloor).toBe(1)
    expect(upstairs.expansion).toBe(0)
    expect(upstairs.machines).toEqual([])

    const upstairsBench = { ...bench, uid: 'm-upstairs', x: 4 }
    const furnished = { ...upstairs, machines: [upstairsBench] }
    const back = switchActiveFloor(furnished, 0)

    expect(back.activeFloor).toBe(0)
    expect(back.machines).toEqual([bench])
    expect(back.floorPlans[1]!.machines).toEqual([upstairsBench])
  })

  it('parks current visitors on their floor instead of losing them', () => {
    const visitor = {
      uid: 'c1',
      phase: 'queue',
    } as Client
    const busy = unlockNextFloor(ready({ clients: [visitor] }))
    const upstairs = switchActiveFloor(busy, 1)

    expect(canSwitchFloor(busy, 1)).toBe(true)
    expect(upstairs.clients).toEqual([])
    expect(upstairs.floorPlans[0]!.clients).toEqual([visitor])
    expect(switchActiveFloor(upstairs, 0).clients).toEqual([visitor])
  })
})
