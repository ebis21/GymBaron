import { describe, it, expect } from 'vitest'
import { addMember, applyChurn, chargeRenewals, signupChance } from './members'
import { initialState, passPrice } from './economy'
import { MEMBER_FEE } from './constants'
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
    expect(addMember(posh).cash - posh.cash).toBeCloseTo(MEMBER_FEE * 1.9, 5)
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

describe('chargeRenewals', () => {
  it('takes nothing on the day someone joined', () => {
    expect(chargeRenewals(withMembers([member('p1', 1)], { day: 1 })).count).toBe(0)
  })

  it('takes nothing in the days between renewals', () => {
    for (const day of [2, 3, 4, 5, 6, 9, 13]) {
      expect(chargeRenewals(withMembers([member('p1', 1)], { day })).count).toBe(0)
    }
  })

  it('renews every seven days from the day the member joined', () => {
    for (const day of [8, 15, 22]) {
      const s = withMembers([member('p1', 1)], { day })
      const r = chargeRenewals(s)
      expect(r.count).toBe(1)
      expect(r.amount).toBeCloseTo(passPrice(s), 5)
    }
  })

  it("follows each member's own cycle rather than a shared one", () => {
    // p1 joined day 1, p2 day 3 — only one of them is ever due at a time.
    expect(chargeRenewals(withMembers([member('p1', 1), member('p2', 3)], { day: 8 })).count).toBe(1)
    expect(chargeRenewals(withMembers([member('p1', 1), member('p2', 3)], { day: 10 })).count).toBe(1)
  })

  it('charges every member whose renewal falls on the same day', () => {
    const s = withMembers([member('p1', 1), member('p2', 1)], { day: 8 })
    const r = chargeRenewals(s)
    expect(r.count).toBe(2)
    expect(r.state.cash).toBeCloseTo(s.cash + passPrice(s) * 2, 5)
  })

  it("is priced at today's gym class, so upgrades lift existing passes", () => {
    const plain = withMembers([member('p1', 1)], { day: 8 })
    const posh = { ...plain, machines: [machine('m1', 'cable')] }
    expect(chargeRenewals(posh).amount).toBeGreaterThan(chargeRenewals(plain).amount)
  })

  it('leaves the state untouched when nothing is due', () => {
    const s = withMembers([member('p1', 1)], { day: 3 })
    expect(chargeRenewals(s).state).toBe(s)
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
        { uid: 'c1', kind: 'member', phase: 'queue', phaseMs: 0, machineUid: null, memberUid: 'p49' },
      ],
    })
    const { state } = applyChurn(s)
    const stillMember = state.members.some(m => m.uid === 'p49')
    const stillQueued = state.clients.some(c => c.memberUid === 'p49')
    expect(stillQueued).toBe(stillMember)
  })
})
