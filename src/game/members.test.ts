import { describe, it, expect } from 'vitest'
import {
  addMember, applyChurn, chargeRenewals, daysToPayday, isPayday, signupChance,
} from './members'
import { gymClass, initialState, passPrice } from './economy'
import { BILLING_PERIOD_DAYS, MEMBER_FEE } from './constants'
import type { GameState, Machine, Member } from './types'

const base = () => initialState(3, 0)

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

const member = (uid: string, joinedDay: number): Member => ({ uid, joinedDay })

const withMembers = (members: Member[], over: Partial<GameState> = {}): GameState => ({
  ...base(),
  members,
  ...over,
})

describe('signupChance', () => {
  it('rises with satisfaction', () => {
    expect(signupChance(100)).toBeGreaterThan(signupChance(0))
  })

  it('never reaches certainty, and never reaches zero', () => {
    expect(signupChance(100)).toBeLessThan(1)
    expect(signupChance(0)).toBeGreaterThan(0)
  })
})

describe('addMember', () => {
  it('banks the first pass the moment someone signs up', () => {
    const s = addMember(base())
    expect(s.members).toHaveLength(1)
    expect(s.cash).toBe(base().cash + MEMBER_FEE)
    expect(s.today.subscriptions).toBe(MEMBER_FEE)
    expect(s.today.signups).toBe(1)
    expect(s.stats.membersJoined).toBe(1)
  })

  it('prices that first pass at the gym class', () => {
    const posh: GameState = { ...base(), machines: [machine('m1', 'cable')] }
    expect(addMember(posh).cash - posh.cash).toBeCloseTo(MEMBER_FEE * gymClass(posh), 5)
  })

  it('stamps the member with the day they joined', () => {
    const s = addMember({ ...base(), day: 12 })
    expect(s.members[0]!.joinedDay).toBe(12)
  })

  it('gives every member a distinct id', () => {
    const s = addMember(addMember(base()))
    expect(s.members[0]!.uid).not.toBe(s.members[1]!.uid)
  })
})

describe('isPayday', () => {
  it('falls every seventh day', () => {
    expect([7, 14, 21, 70].every(isPayday)).toBe(true)
  })

  it('falls on no other day', () => {
    expect([1, 2, 3, 4, 5, 6, 8, 13, 15, 20].some(isPayday)).toBe(false)
  })
})

describe('daysToPayday', () => {
  it('counts down across the week and reads zero on payday', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(daysToPayday)).toEqual([6, 5, 4, 3, 2, 1, 0])
  })

  it('starts the count again the morning after', () => {
    expect(daysToPayday(8)).toBe(BILLING_PERIOD_DAYS - 1)
  })
})

describe('chargeRenewals', () => {
  it('takes nothing on a day that is not payday', () => {
    for (const day of [1, 2, 3, 4, 5, 6, 8, 13]) {
      expect(chargeRenewals(withMembers([member('p1', 1)], { day })).count).toBe(0)
    }
  })

  it('collects every pass in the building on payday', () => {
    for (const day of [7, 14, 21]) {
      const s = withMembers([member('p1', 1), member('p2', 3), member('p3', 6)], { day })
      const r = chargeRenewals(s)
      expect(r.count).toBe(3)
      expect(r.amount).toBeCloseTo(passPrice(s) * 3, 5)
      expect(r.state.cash).toBeCloseTo(s.cash + passPrice(s) * 3, 5)
    }
  })

  it('bills the whole gym on one shared week, whenever each member joined', () => {
    // Joining on different days no longer buys a different billing date: the
    // gym's week is the gym's week.
    const spread = withMembers([member('p1', 1), member('p2', 4), member('p3', 6)], { day: 7 })
    expect(chargeRenewals(spread).count).toBe(3)
    expect(chargeRenewals({ ...spread, day: 8 }).count).toBe(0)
  })

  it('spares anyone who joined on payday itself, having just paid at the desk', () => {
    const s = withMembers([member('p1', 1), member('p2', 7)], { day: 7 })
    expect(chargeRenewals(s).count).toBe(1)
  })

  it("is priced at today's gym class, so upgrades lift existing passes", () => {
    const plain = withMembers([member('p1', 1)], { day: 7 })
    const posh = { ...plain, machines: [machine('m1', 'cable')] }
    expect(chargeRenewals(posh).amount).toBeGreaterThan(chargeRenewals(plain).amount)
  })

  it('banks the collection as income rather than conjuring it', () => {
    const s = withMembers([member('p1', 1)], { day: 7 })
    const r = chargeRenewals(s)
    expect(r.state.today.subscriptions).toBeCloseTo(r.amount, 5)
    expect(r.state.stats.totalEarned).toBeCloseTo(s.stats.totalEarned + r.amount, 5)
  })

  it('leaves the state untouched when nothing is due', () => {
    const midweek = withMembers([member('p1', 1)], { day: 3 })
    expect(chargeRenewals(midweek).state).toBe(midweek)
    const emptyGym = withMembers([], { day: 7 })
    expect(chargeRenewals(emptyGym).state).toBe(emptyGym)
  })

  /**
   * The point of the whole change: a week's income arrives as one sum the
   * player can see, not as a nightly dribble hidden in the signup line.
   */
  it('lands a full membership as a single payday rather than a trickle', () => {
    const crowd = Array.from({ length: 30 }, (_, i) => member(`p${i}`, 1))
    const week = [7, 8, 9, 10, 11, 12, 13].map(day =>
      chargeRenewals(withMembers(crowd, { day })).amount,
    )
    const total = week.reduce((a, b) => a + b, 0)
    expect(week[0]).toBe(total)
    expect(week.slice(1)).toEqual([0, 0, 0, 0, 0, 0])
  })
})

describe('applyChurn', () => {
  const crowd = (n: number, joinedDay = 1) =>
    Array.from({ length: n }, (_, i) => member(`p${i}`, joinedDay))

  it('loses nobody from an empty membership', () => {
    expect(applyChurn(base()).churn).toBe(0)
  })

  it('loses more members when satisfaction is low', () => {
    const happy = withMembers(crowd(50), { day: 5, satisfaction: 100 })
    const miserable = withMembers(crowd(50), { day: 5, satisfaction: 0 })
    expect(applyChurn(miserable).churn).toBeGreaterThan(applyChurn(happy).churn)
  })

  it('spares anyone who signed up today', () => {
    expect(applyChurn(withMembers(crowd(50, 5), { day: 5, satisfaction: 0 })).churn).toBe(0)
  })

  it('drops the leavers from the roster and counts them', () => {
    const s = withMembers(crowd(50), { day: 5, satisfaction: 0 })
    const { state, churn } = applyChurn(s)
    expect(churn).toBeGreaterThan(0)
    expect(state.members).toHaveLength(50 - churn)
    expect(state.stats.membersLost).toBe(churn)
  })

  it('never removes more members than exist', () => {
    const s = withMembers(crowd(1), { day: 5, satisfaction: 0 })
    expect(applyChurn(s).state.members.length).toBeGreaterThanOrEqual(0)
  })

  it('sends a departing member home rather than leaving them in the queue', () => {
    const s = withMembers(crowd(50), {
      day: 5,
      satisfaction: 0,
      clients: [
        { uid: 'c1', kind: 'member', rarity: 'common', phase: 'queue', phaseMs: 0, machineUid: null, memberUid: 'p49', trainerUid: null, x: 0, z: 0, path: [], goal: null },
      ],
    })
    const { state } = applyChurn(s)
    const stillMember = state.members.some(m => m.uid === 'p49')
    const stillQueued = state.clients.some(c => c.memberUid === 'p49')
    expect(stillQueued).toBe(stillMember)
  })
})

describe('signupChance — the luck upgrade', () => {
  it('is unchanged when the track has not been bought', () => {
    for (const satisfaction of [0, 25, 50, 75, 100]) {
      expect(signupChance(satisfaction, 1)).toBeCloseTo(signupChance(satisfaction))
    }
  })

  it('converts better at the middling satisfaction a real gym runs at', () => {
    expect(signupChance(40, 4)).toBeGreaterThan(signupChance(40, 1))
    expect(signupChance(60, 2)).toBeGreaterThan(signupChance(60, 1))
  })

  it('never breaks the ceiling that keeps membership income in check', () => {
    for (const satisfaction of [0, 25, 50, 75, 100]) {
      for (const luck of [1, 1.5, 2, 3, 4, 99]) {
        expect(signupChance(satisfaction, luck)).toBeLessThanOrEqual(0.24)
      }
    }
  })

  it('cannot be dragged below the unupgraded odds by a nonsense luck value', () => {
    expect(signupChance(50, 0)).toBeCloseTo(signupChance(50, 1))
    expect(signupChance(50, -3)).toBeCloseTo(signupChance(50, 1))
  })
})
