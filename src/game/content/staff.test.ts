import { describe, it, expect } from 'vitest'
import {
  STAFF_RANKS, STAFF_ROLES, wageFor, workMsFor, speedFor, hirePriceFor, roleUnlockLevel,
  STAFF_LIMIT,
} from './staff'
import { STAFF_UNLOCK_LEVEL, TRAINER_UNLOCK_LEVEL } from '../constants'
import { REFRESH_PRICE } from '../recruit'

describe('wageFor', () => {
  it('matches the published day rates', () => {
    expect(wageFor('reception', 'rare')).toBe(400)
    expect(wageFor('reception', 'epic')).toBe(1000)
    expect(wageFor('reception', 'legend')).toBe(2000)
    expect(wageFor('cleaner', 'rare')).toBe(600)
    expect(wageFor('repair', 'legend')).toBe(4000)
  })

  /**
   * The reason the table was cut: a crew of three has to be payable out of the
   * gym that would hire it. A twenty-machine floor grosses about 21 000 a day,
   * and the old legendary crew billed 45 000 of it.
   */
  it('keeps a full legendary crew inside what a mature gym takes in a day', () => {
    const crew = wageFor('reception', 'legend')
      + wageFor('cleaner', 'legend')
      + wageFor('repair', 'legend')
    expect(crew).toBeLessThan(21_000 / 2)
  })

  it('never costs less for a higher rank', () => {
    for (const role of STAFF_ROLES) {
      expect(wageFor(role, 'epic')).toBeGreaterThan(wageFor(role, 'rare'))
      expect(wageFor(role, 'legend')).toBeGreaterThan(wageFor(role, 'epic'))
    }
  })
})

describe('workMsFor', () => {
  it('makes a higher rank strictly faster at the same job', () => {
    for (const role of STAFF_ROLES) {
      expect(workMsFor(role, 'epic')).toBeLessThan(workMsFor(role, 'rare'))
      expect(workMsFor(role, 'legend')).toBeLessThan(workMsFor(role, 'epic'))
    }
  })

  it('uses the published scan, wipe and repair times', () => {
    expect(workMsFor('reception', 'rare')).toBe(4000)
    expect(workMsFor('cleaner', 'legend')).toBe(2500)
    expect(workMsFor('repair', 'rare')).toBe(12_000)
  })
})

describe('hirePriceFor', () => {
  it('costs strictly more for a higher rank', () => {
    expect(hirePriceFor('epic')).toBeGreaterThan(hirePriceFor('rare'))
    expect(hirePriceFor('legend')).toBeGreaterThan(hirePriceFor('epic'))
  })

  it('costs more to hire somebody than to reroll the board', () => {
    expect(hirePriceFor('rare')).toBeGreaterThan(REFRESH_PRICE)
  })

  /** Signing somebody is a commitment measured in days of their own pay. */
  it('asks a few days of the wage up front, never a wall', () => {
    for (const rank of STAFF_RANKS) {
      const wage = wageFor('reception', rank)
      expect(hirePriceFor(rank)).toBeGreaterThanOrEqual(wage)
      expect(hirePriceFor(rank)).toBeLessThanOrEqual(wage * 3)
    }
  })
})

describe('speedFor', () => {
  it('walks a higher rank faster', () => {
    expect(speedFor('rare')).toBeLessThan(speedFor('epic'))
    expect(speedFor('epic')).toBeLessThan(speedFor('legend'))
  })
})

describe('roleUnlockLevel', () => {
  it('opens the trainer long before the roles that play the game for you', () => {
    expect(roleUnlockLevel('trainer')).toBe(TRAINER_UNLOCK_LEVEL)
    expect(roleUnlockLevel('trainer')).toBeLessThan(roleUnlockLevel('reception'))
  })

  it('leaves every other role on the staff unlock', () => {
    for (const role of STAFF_ROLES) {
      if (role === 'trainer') continue
      expect(roleUnlockLevel(role)).toBe(STAFF_UNLOCK_LEVEL)
    }
  })
})

describe('trainer wage', () => {
  /**
   * The trainer is priced against what a booking adds — half a door fee, worth
   * ~17 on early kit — rather than against the other roles. A dozen bookings a
   * day is about all one trainer can fit in, so a rare has to land near that.
   */
  it('pays back a rare trainer in roughly a dozen early bookings', () => {
    expect(wageFor('trainer', 'rare')).toBeLessThanOrEqual(12 * 20)
    expect(wageFor('trainer', 'rare')).toBeGreaterThan(12 * 10)
  })

  it('still costs less than any role that works the floor unattended', () => {
    for (const role of STAFF_ROLES) {
      if (role === 'trainer') continue
      expect(wageFor('trainer', 'rare')).toBeLessThan(wageFor(role, 'rare'))
    }
  })
})

describe('tables', () => {
  it('covers every role and rank', () => {
    expect(STAFF_ROLES).toHaveLength(4)
    expect(STAFF_ROLES).toContain('trainer')
    expect(STAFF_RANKS).toHaveLength(3)
    for (const role of STAFF_ROLES) {
      for (const rank of STAFF_RANKS) {
        expect(Number.isFinite(wageFor(role, rank))).toBe(true)
        expect(Number.isFinite(workMsFor(role, rank))).toBe(true)
      }
    }
  })

  it('caps the payroll at five', () => {
    expect(STAFF_LIMIT).toBe(5)
  })
})
