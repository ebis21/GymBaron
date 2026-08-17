import { describe, it, expect } from 'vitest'
import {
  entryFee, dailyCosts, gymClass, equipmentDraw, passPrice, addXp, initialState,
} from './economy'
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

  it('charges a member the discounted share of the door price', () => {
    expect(entryFee('dumbbells', 'member', 'common')).toBeCloseTo(
      entryFee('dumbbells', 'walkin', 'common') * MEMBER_DISCOUNT,
      5,
    )
  })

  it('puts the cheapest machine at 26.4 credits at the door and half that for a member', () => {
    expect(entryFee('dumbbells', 'walkin', 'common')).toBeCloseTo(26.4, 5)
    expect(entryFee('dumbbells', 'member', 'common')).toBeCloseTo(13.2, 5)
  })

  it('leaves an unknown gym exactly where it was', () => {
    expect(entryFee('dumbbells', 'walkin', 'common', 0)).toBeCloseTo(26.4, 5)
  })

  it('pays a little more at a gym everyone has heard of', () => {
    const unknown = entryFee('dumbbells', 'walkin', 'common', 0)
    const famous = entryFee('dumbbells', 'walkin', 'common', 100)
    expect(famous).toBeCloseTo(unknown * 1.25, 5)
    // Gentle on purpose: reputation nudges the price, it does not set it.
    expect(famous).toBeLessThan(unknown * 1.5)
  })

  it('charges half again for a session with a personal trainer', () => {
    const plain = entryFee('dumbbells', 'walkin', 'common', 40)
    const coached = entryFee('dumbbells', 'walkin', 'common', 40, true)
    expect(coached).toBeCloseTo(plain * 1.5, 5)
  })

  it('gives a member the trainer at their discounted rate too', () => {
    const member = entryFee('dumbbells', 'member', 'common', 0)
    expect(entryFee('dumbbells', 'member', 'common', 0, true)).toBeCloseTo(member * 1.5, 5)
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

describe('equipmentDraw', () => {
  const floorOf = (type: Machine['type'], count: number) => ({
    ...base(),
    machines: Array.from({ length: count }, (_, i) => machine(`m${i}`, type)),
  })

  it('is 1.0 in an empty hall, so bare floor pulls nobody extra in', () => {
    expect(equipmentDraw(base())).toBe(1)
  })

  it('grows with the number of machines', () => {
    expect(equipmentDraw(floorOf('bench', 6))).toBeGreaterThan(equipmentDraw(floorOf('bench', 1)))
  })

  it('grows with the quality of them, not just the count', () => {
    // The whole complaint this answers: a floor of top-end kit has to pull a
    // bigger crowd than the same number of cheap benches, or the ladder buys
    // nothing but a shorter queue.
    expect(equipmentDraw(floorOf('apex-rig', 8)))
      .toBeGreaterThan(equipmentDraw(floorOf('bench', 8)))
  })

  it('counts contract kit exactly like the starting six', () => {
    // Supplier machines resolve through the same table, so a sponsored floor
    // is simply a floor with a very high total — no special case anywhere.
    const mixed = {
      ...base(),
      machines: [machine('m1', 'cable'), machine('m2', 'ferrum-cable')],
    }
    expect(equipmentDraw(mixed)).toBeGreaterThan(equipmentDraw(floorOf('cable', 1)))
  })

  it('is monotonic — a purchase can never thin the crowd', () => {
    const before = floorOf('apex-rig', 10)
    const after = { ...before, machines: [...before.machines, machine('x', 'dumbbells')] }
    expect(equipmentDraw(after)).toBeGreaterThan(equipmentDraw(before))
  })

  it('saturates rather than running away, so the door stays servable', () => {
    // Advertising multiplies on top of this. Left uncapped, a big floor would
    // spawn a queue no payroll could scan and the surplus would leave as
    // walkouts, costing reputation — growth that punishes itself.
    expect(equipmentDraw(floorOf('apex-rig', 200))).toBeLessThan(2.6)
    expect(equipmentDraw(floorOf('apex-rig', 30))).toBeCloseTo(2.529, 3)
  })
})

describe('gymClass', () => {
  it('is 1.0 for an empty gym', () => {
    expect(gymClass(base())).toBe(1)
  })

  it('gives a single machine almost all of its own bonus', () => {
    // The curve is barely bent this early, so one machine is worth nearly the
    // straight ×2.02 it advertises.
    const s = { ...base(), machines: [machine('m1', 'cable')] }
    expect(gymClass(s)).toBeCloseTo(1.87179, 4)
  })

  it('adds each machine bonus on top of the floor, on a curve', () => {
    const s = { ...base(), machines: [machine('m1', 'dumbbells'), machine('m2', 'cable')] }
    // A straight sum would be 2.12; the bend costs a little even here.
    expect(gymClass(s)).toBeCloseTo(1.94382, 4)
    expect(gymClass(s)).toBeLessThan(1 + 0.1 + 1.02)
  })

  // The point of the curve: a floor that is already excellent gains little
  // from one more bench, so passes stop compounding with the machine count.
  it('pays less for the same machine the better the gym already is', () => {
    const small = { ...base(), machines: [machine('m1', 'bench')] }
    const big = {
      ...base(),
      machines: Array.from({ length: 12 }, (_, i) => machine(`m${i}`, 'cable')),
    }

    const gainSmall = gymClass({ ...small, machines: [...small.machines, machine('x', 'cable')] })
      - gymClass(small)
    const gainBig = gymClass({ ...big, machines: [...big.machines, machine('x', 'cable')] })
      - gymClass(big)

    expect(gainBig).toBeLessThan(gainSmall)
    expect(gainBig).toBeGreaterThan(0)
  })

  it('never runs away, however much kit is crammed in', () => {
    const huge = {
      ...base(),
      machines: Array.from({ length: 200 }, (_, i) => machine(`m${i}`, 'cable')),
    }
    // The old straight sum put this gym at ×205, and every pass in the
    // building was priced off it. The ceiling is 6, so the class stops at 7 —
    // pinned tight, because dropping it from 8 is what stops a big floor
    // being paid twice now that it also pulls a bigger crowd in.
    expect(gymClass(huge)).toBeLessThan(7)
  })

  it('rises when any machine joins, even a weak one', () => {
    const strong = { ...base(), machines: [machine('m1', 'cable')] }
    const bigger = { ...strong, machines: [...strong.machines, machine('m2', 'dumbbells')] }
    expect(gymClass(bigger)).toBeGreaterThan(gymClass(strong))
  })

  it('lets a new machine contribute rather than replace what was there', () => {
    // The player's own worked example, on the curve: a new machine adds to the
    // figure the gym already had, it does not overwrite it.
    const before = { ...base(), machines: [machine('m1', 'bike')] }
    const after = { ...before, machines: [...before.machines, machine('m2', 'bench')] }
    expect(gymClass(before)).toBeCloseTo(1.41860, 4)
    expect(gymClass(after)).toBeCloseTo(1.65082, 4)
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
    expect(passPrice(s)).toBeCloseTo(MEMBER_FEE * gymClass(s), 5)
    expect(passPrice(s)).toBeGreaterThan(MEMBER_FEE)
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

describe('entryFee — the earnings upgrade', () => {
  it('is neutral when the track has not been bought', () => {
    expect(entryFee('bench', 'walkin', 'common', 0, false, 1))
      .toBeCloseTo(entryFee('bench', 'walkin', 'common'))
  })

  it('scales the whole fee, including the trainer share', () => {
    const plain = entryFee('bench', 'walkin', 'common')
    const coached = entryFee('bench', 'walkin', 'common', 0, true)

    expect(entryFee('bench', 'walkin', 'common', 0, false, 2)).toBeCloseTo(plain * 2)
    expect(entryFee('bench', 'walkin', 'common', 0, true, 2)).toBeCloseTo(coached * 2)
  })

  it('stacks on top of the member discount and the reputation bonus', () => {
    const full = entryFee('treadmill', 'member', 'epic', 100, false)
    expect(entryFee('treadmill', 'member', 'epic', 100, false, 4)).toBeCloseTo(full * 4)
  })

  it('leaves the price of a pass alone — that is the gym class only', () => {
    const gym = { ...base(), machines: [machine('m1', 'bench')] }
    // `passPrice` takes no earnings argument at all; this pins that down.
    expect(passPrice(gym)).toBeCloseTo(MEMBER_FEE * gymClass(gym))
  })
})
