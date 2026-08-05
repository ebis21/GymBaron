import { describe, it, expect } from 'vitest'
import { entryFee, dailyCosts, gymClass, passPrice, addXp, initialState } from './economy'
import { machineType } from './content/machines'
import {
  DAILY_RENT,
  ENTRY_FEE_BASE,
  MEMBER_DISCOUNT,
  MEMBER_FEE,
  MEMBER_UPKEEP,
  START_CASH,
} from './constants'
import type { Machine, Member } from './types'

const base = () => initialState(1, 0)

const machine = (uid: string, type: Machine['type']): Machine => ({
  uid,
  type,
  x: 0,
  y: 0,
  rotation: 0,
  durability: 100,
  occupiedBy: null,
  brokenMs: 0,
})

const member = (uid: string, joinedDay = 1): Member => ({ uid, joinedDay })

describe('entryFee', () => {
  it('scales the base price by the machine multiplier', () => {
    expect(entryFee('dumbbells', 'walkin', 'common')).toBeCloseTo(
      ENTRY_FEE_BASE * machineType('dumbbells').revenueMultiplier * 1.2,
      5,
    )
  })

  it('pays more on better kit', () => {
    expect(entryFee('cable', 'walkin', 'common')).toBeGreaterThan(
      entryFee('dumbbells', 'walkin', 'common'),
    )
  })

  it('charges a member a tenth of the door price', () => {
    expect(entryFee('dumbbells', 'member', 'common')).toBeCloseTo(
      entryFee('dumbbells', 'walkin', 'common') * MEMBER_DISCOUNT,
      5,
    )
  })

  it('puts the cheapest machine at 26.4 credits at the door and 2.64 for a member', () => {
    expect(entryFee('dumbbells', 'walkin', 'common')).toBeCloseTo(26.4, 5)
    expect(entryFee('dumbbells', 'member', 'common')).toBeCloseTo(2.64, 5)
  })

  it('scales up with rarity, from common to influencer', () => {
    const common = entryFee('dumbbells', 'walkin', 'common')
    const rare = entryFee('dumbbells', 'walkin', 'rare')
    const epic = entryFee('dumbbells', 'walkin', 'epic')
    const legend = entryFee('dumbbells', 'walkin', 'legend')
    const influencer = entryFee('dumbbells', 'walkin', 'influencer')
    expect(rare).toBeGreaterThan(common)
    expect(epic).toBeGreaterThan(rare)
    expect(legend).toBeGreaterThan(epic)
    expect(influencer).toBeGreaterThan(legend)
    expect(influencer).toBeCloseTo(common * (3.2 / 1.2), 5)
  })
})

describe('gymClass', () => {
  it('is 1.0 for an empty gym', () => {
    expect(gymClass(base())).toBe(1)
  })

  it('is the multiplier itself for a single machine', () => {
    const s = { ...base(), machines: [machine('m1', 'cable')] }
    expect(gymClass(s)).toBeCloseTo(1.9, 5)
  })

  it('adds each machine bonus on top of the floor', () => {
    const s = { ...base(), machines: [machine('m1', 'dumbbells'), machine('m2', 'cable')] }
    expect(gymClass(s)).toBeCloseTo(1 + 0.1 + 0.9, 5)
  })

  it('rises when any machine joins, even a weak one', () => {
    const strong = { ...base(), machines: [machine('m1', 'cable')] }
    const bigger = { ...strong, machines: [...strong.machines, machine('m2', 'dumbbells')] }
    expect(gymClass(bigger)).toBeGreaterThan(gymClass(strong))
  })

  it('turns a 1.4 gym into a 1.65 gym when a 1.25 machine arrives', () => {
    // The player's own worked example: a new machine contributes its bonus,
    // it does not replace the figure the gym already had.
    const before = { ...base(), machines: [machine('m1', 'bike')] }
    const after = { ...before, machines: [...before.machines, machine('m2', 'bench')] }
    expect(gymClass(before)).toBeCloseTo(1.4, 5)
    expect(gymClass(after)).toBeCloseTo(1.65, 5)
  })

  it('never drops below 1.0', () => {
    expect(gymClass(base())).toBe(1)
  })
})

describe('passPrice', () => {
  it('is the face value at an empty gym', () => {
    expect(passPrice(base())).toBe(MEMBER_FEE)
  })

  it('rises with the gym class', () => {
    const s = { ...base(), machines: [machine('m1', 'cable')] }
    expect(passPrice(s)).toBeCloseTo(MEMBER_FEE * 1.9, 5)
  })
})

describe('dailyCosts', () => {
  it('is just rent for an empty gym with no members', () => {
    expect(dailyCosts(base()).total).toBe(DAILY_RENT)
  })

  it('adds the power draw of every machine', () => {
    const s = { ...base(), machines: [machine('m1', 'treadmill')] }
    expect(dailyCosts(s).power).toBe(machineType('treadmill').powerPerDay)
  })

  it('grows with every member', () => {
    const one = dailyCosts({ ...base(), members: [member('p1')] }).total
    const three = dailyCosts({
      ...base(),
      members: [member('p1'), member('p2'), member('p3')],
    }).total
    expect(one).toBe(DAILY_RENT + MEMBER_UPKEEP)
    expect(three).toBe(DAILY_RENT + MEMBER_UPKEEP * 3)
    expect(three).toBeGreaterThan(one)
  })

  it('breaks down into parts that sum to the total', () => {
    const s = { ...base(), machines: [machine('m1', 'cable')], members: [member('p1')] }
    const c = dailyCosts(s)
    expect(c.rent + c.power + c.memberUpkeep).toBe(c.total)
  })
})

describe('initialState', () => {
  it('opens an empty gym on day one with the starting float', () => {
    const s = base()
    expect(s.cash).toBe(START_CASH)
    expect(s.machines).toEqual([])
    expect(s.members).toEqual([])
    expect(s.day).toBe(1)
    expect(s.dayMs).toBe(0)
    expect(s.dayEnded).toBe(false)
  })
})

describe('addXp', () => {
  it('levels up once the threshold is crossed', () => {
    expect(addXp(base(), 100).level).toBe(2)
  })
  it('carries the remainder into the new level', () => {
    const s = addXp(base(), 130)
    expect(s.level).toBe(2)
    expect(s.xp).toBe(30)
  })
  it('handles several levels in one award', () => {
    expect(addXp(base(), 250).level).toBe(3)
  })
  it('does not level up below the threshold', () => {
    expect(addXp(base(), 99).level).toBe(1)
  })
})
