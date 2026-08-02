import { describe, it, expect } from 'vitest'
import { closeDay, nextDay } from './dayClose'
import { initialState, dailyCosts, passPrice } from './economy'
import { DAILY_RENT, DAY_MS, DEBT_LIMIT, MEMBER_UPKEEP } from './constants'
import type { GameState, Machine, Member } from './types'

const base = () => initialState(5, 0)

const machine = (uid: string, type: Machine['type'], occupiedBy: string | null = null): Machine => ({
  uid,
  type,
  x: 0,
  y: 0,
  rotation: 0,
  durability: 100,
  occupiedBy,
})

const member = (uid: string, joinedDay = 1): Member => ({ uid, joinedDay })

const atClosing = (over: Partial<GameState> = {}): GameState => ({
  ...base(),
  dayMs: DAY_MS,
  ...over,
})

describe('closeDay', () => {
  it('bills rent even for an empty gym', () => {
    const s = closeDay(atClosing())
    expect(s.dayReport!.bill).toBe(DAILY_RENT)
    expect(s.cash).toBe(base().cash - DAILY_RENT)
  })

  it('grows the bill with every member', () => {
    const one = closeDay(atClosing({ members: [member('p1')] })).dayReport!.bill
    const four = closeDay(
      atClosing({ members: [member('p1'), member('p2'), member('p3'), member('p4')] }),
    ).dayReport!.bill
    expect(four).toBe(one + MEMBER_UPKEEP * 3)
    expect(four).toBeGreaterThan(one)
  })

  it('adds the power draw of the floor', () => {
    expect(closeDay(atClosing({ machines: [machine('m1', 'treadmill')] })).dayReport!.power)
      .toBeGreaterThan(0)
  })

  it('never trims the bill to fit the takings', () => {
    // Everything went on machines; there is nothing left to pay with.
    const broke = atClosing({ cash: 0, machines: [machine('m1', 'cable')] })
    const s = closeDay(broke)
    expect(s.dayReport!.bill).toBe(dailyCosts(broke).total)
    expect(s.cash).toBeLessThan(0)
  })

  it('lets a bad day end in the red without ending the run', () => {
    const s = closeDay(atClosing({ cash: 10 }))
    expect(s.cash).toBeLessThan(0)
    expect(s.gameOver).toBe(false)
  })

  it('ends the run only once the debt limit is crossed', () => {
    expect(closeDay(atClosing({ cash: DEBT_LIMIT + 1 })).gameOver).toBe(true)
    expect(closeDay(atClosing({ cash: DEBT_LIMIT + DAILY_RENT })).gameOver).toBe(false)
  })

  it('collects renewals that fall due today', () => {
    const s = atClosing({ day: 8, members: [member('p1', 1)] })
    expect(closeDay(s).dayReport!.subscriptions).toBeCloseTo(passPrice(s), 5)
  })

  it('bills a member who quits this evening for the day they just used', () => {
    const s = atClosing({ day: 5, satisfaction: 0, members: [member('p1', 1)] })
    expect(closeDay(s).dayReport!.memberUpkeep).toBe(MEMBER_UPKEEP)
  })

  it('balances the receipt against the cash it reports', () => {
    const s = atClosing({ day: 8, members: [member('p1', 1)] })
    const r = closeDay(s).dayReport!
    expect(r.rent + r.power + r.memberUpkeep).toBe(r.bill)
    expect(r.cashAfter).toBeCloseTo(r.cashBefore + r.subscriptions - r.bill, 5)
  })

  it('reports the day it closed', () => {
    expect(closeDay(atClosing({ day: 4 })).dayReport!.day).toBe(4)
  })

  it('stops the clock at 20:00 and marks the day done', () => {
    const s = closeDay(atClosing())
    expect(s.dayEnded).toBe(true)
    expect(s.dayMs).toBe(DAY_MS)
    expect(s.day).toBe(1)
  })

  it('records the bill as money spent', () => {
    expect(closeDay(atClosing()).stats.totalSpent).toBe(DAILY_RENT)
  })
})

describe('nextDay', () => {
  const closed = () => closeDay(atClosing({ machines: [machine('m1', 'bench', 'c1')] }))

  it('moves the calendar on and reopens at 8:00', () => {
    const s = nextDay(closed())
    expect(s.day).toBe(2)
    expect(s.dayMs).toBe(0)
    expect(s.dayEnded).toBe(false)
  })

  it('sends everyone home and frees the machines', () => {
    const s = nextDay({
      ...closed(),
      clients: [
        { uid: 'c1', kind: 'walkin', rarity: 'common', phase: 'workout', phaseMs: 0, machineUid: 'm1', memberUid: null },
      ],
    })
    expect(s.clients).toEqual([])
    expect(s.machines[0]!.occupiedBy).toBeNull()
  })

  it('starts the ledger from zero', () => {
    const s = nextDay({
      ...closed(),
      today: { entryFees: 90, subscriptions: 200, signups: 1, clientsServed: 4, clientsLost: 1 },
    })
    expect(s.today).toEqual({
      entryFees: 0,
      subscriptions: 0,
      signups: 0,
      clientsServed: 0,
      clientsLost: 0,
    })
  })

  it('keeps the receipt so the player can still read it', () => {
    expect(nextDay(closed()).dayReport).not.toBeNull()
  })

  it('refuses to skip a day that has not closed yet', () => {
    const midday = atClosing({ dayMs: 1_000 })
    expect(nextDay(midday)).toBe(midday)
  })

  it('refuses to reopen after the run is over', () => {
    const dead = { ...closed(), gameOver: true }
    expect(nextDay(dead)).toBe(dead)
  })
})
