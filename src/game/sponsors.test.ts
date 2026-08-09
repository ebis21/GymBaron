import { describe, it, expect } from 'vitest'
import {
  applySponsors,
  advanceSponsors,
  canSign,
  conditionStatuses,
  currentValue,
  initialSponsors,
  normalizeSponsors,
  settleSponsors,
  signCost,
} from './sponsors'
import { STRIKES_TO_LAPSE, sponsorDeal } from './content/sponsors'
import { initialState } from './economy'
import { closeDay } from './dayClose'
import { DAY_MS } from './constants'
import type { GameState, Machine, Stain } from './types'

const base = () => initialState(5, 0)

const stain = (uid: string): Stain => ({ uid, x: 0, y: 0, ageMs: 0 })

const machine = (uid: string): Machine => ({
  uid,
  type: 'bench',
  x: 0,
  y: 0,
  rotation: 0,
  durability: 100,
  occupiedBy: null,
  brokenMs: 0,
})

const machines = (n: number): Machine[] =>
  Array.from({ length: n }, (_, i) => machine(`m${i}`))

/**
 * A gym good enough for the juice bar, on the day after signing — the ordinary
 * case every test that is not about signing or timing starts from.
 */
const holding = (over: Partial<GameState> = {}): GameState => ({
  ...base(),
  reputation: 50,
  day: 2,
  sponsors: { ...initialSponsors(), activeId: 'juice-bar', signedDay: 1 },
  ...over,
})

describe('normalizeSponsors', () => {
  it('reads nonsense as a gym that never signed anything', () => {
    for (const junk of [undefined, null, 42, 'no', []]) {
      expect(normalizeSponsors(junk)).toEqual(initialSponsors())
    }
  })

  it('keeps what a save legitimately holds', () => {
    const stored = { ...initialSponsors(), activeId: 'global', strikes: 2, signedDay: 9 }
    expect(normalizeSponsors(stored)).toEqual(stored)
  })

  /**
   * The promise that lets the board be rebalanced without a save migration: a
   * deal taken off it has to read as "no deal" rather than as a lookup that
   * throws on the next tick.
   */
  it('forgets a deal that is no longer on the board', () => {
    expect(normalizeSponsors({ activeId: 'a-brand-that-was-removed' }).activeId).toBeNull()
    expect(normalizeSponsors({ lapsed: ['juice-bar', 'gone', 'juice-bar'] }).lapsed)
      .toEqual(['juice-bar'])
  })

  it('defaults a field a stored save never had', () => {
    const old = { activeId: 'juice-bar', signedDay: 3 }
    expect(normalizeSponsors(old).worstStains).toBe(0)
    expect(normalizeSponsors(old).lastMiss).toEqual([])
  })

  it('drops a condition name it does not recognise', () => {
    expect(normalizeSponsors({ lastMiss: ['reputation', 'vibes', 7] }).lastMiss)
      .toEqual(['reputation'])
  })
})

describe('signing', () => {
  it('refuses a gym that does not yet look the part', () => {
    expect(canSign({ ...base(), reputation: 10 }, 'juice-bar')).toBe(false)
    expect(canSign({ ...base(), reputation: 20 }, 'juice-bar')).toBe(true)
  })

  /**
   * The rule that makes the ladder signable at all. Demanding a day's footfall
   * up front would leave every deal past the first unsignable before lunch,
   * because at 8:00 nobody has been served anywhere.
   */
  it('judges the signature on standing conditions alone', () => {
    const morning = { ...base(), reputation: 40, today: { ...base().today, clientsServed: 0 } }
    expect(canSign(morning, 'city-apparel')).toBe(true)
    expect(conditionStatuses(morning, 'city-apparel').find(c => c.kind === 'clientsServed')!.met)
      .toBe(false)
  })

  it('costs nothing the first time', () => {
    const signed = applySponsors({ ...base(), reputation: 50 }, { type: 'sign', id: 'juice-bar' })
    expect(signed.cash).toBe(base().cash)
    expect(signed.sponsors.activeId).toBe('juice-bar')
    expect(signed.sponsors.signedDay).toBe(signed.day)
  })

  it('replaces the running deal rather than stacking on it', () => {
    const rich = holding({ cash: 100_000, reputation: 60, machines: machines(10) })
    const swapped = applySponsors(rich, { type: 'sign', id: 'supplements' })
    expect(swapped.sponsors.activeId).toBe('supplements')
    expect(swapped.sponsors.lapsed).toEqual([])
  })

  it('does nothing when it refuses', () => {
    const poor = { ...base(), reputation: 0 }
    expect(applySponsors(poor, { type: 'sign', id: 'juice-bar' })).toBe(poor)
  })
})

describe('dropping', () => {
  it('is free and leaves no mark', () => {
    const dropped = applySponsors(holding({ sponsors: { ...initialSponsors(), activeId: 'juice-bar', strikes: 2 } }), { type: 'drop' })
    expect(dropped.sponsors.activeId).toBeNull()
    expect(dropped.sponsors.lapsed).toEqual([])
    expect(dropped.sponsors.strikes).toBe(0)
    expect(dropped.cash).toBe(base().cash)
  })

  it('does nothing when there is nothing to drop', () => {
    const none = base()
    expect(applySponsors(none, { type: 'drop' })).toBe(none)
  })
})

describe('advanceSponsors', () => {
  it('leaves a gym with no deal completely alone', () => {
    const none = { ...base(), stains: [stain('s1')] }
    expect(advanceSponsors(none, 250)).toBe(none)
  })

  it('remembers the dirtiest the floor got, not how it ended', () => {
    const dirty = advanceSponsors(holding({ stains: [stain('s1'), stain('s2')] }), 250)
    const mopped = advanceSponsors({ ...dirty, stains: [] }, 250)
    expect(mopped.sponsors.worstStains).toBe(2)
  })

  it('counts dirt on a storey nobody is looking at', () => {
    const twoFloors = holding({
      stains: [],
      floorPlans: [
        { expansion: 0, machines: [], decor: [], walls: [], stains: [], clients: [] },
        { expansion: 0, machines: [], decor: [], walls: [], stains: [stain('up')], clients: [] },
      ],
    })
    expect(currentValue(twoFloors, 'cleanliness')).toBe(1)
  })
})

describe('settleSponsors', () => {
  it('leaves a gym with no deal completely alone', () => {
    const none = base()
    expect(settleSponsors(none)).toBe(none)
  })

  /**
   * A signature at 19:00 must not be judged on the hours before it. Paying
   * nothing is fair; charging a strike for a day the brand never saw is not.
   */
  it('neither pays nor punishes on the day a deal is signed', () => {
    const today = holding({ day: 1, sponsors: { ...initialSponsors(), activeId: 'juice-bar', signedDay: 1 } })
    const settled = settleSponsors(today)
    expect(settled.today.sponsorIncome).toBe(0)
    expect(settled.sponsors.strikes).toBe(0)
    expect(settled.sponsors.activeId).toBe('juice-bar')
  })

  it('pays a day the gym cleared the bar', () => {
    const settled = settleSponsors(holding())
    const { payout } = sponsorDeal('juice-bar')
    expect(settled.today.sponsorIncome).toBe(payout)
    expect(settled.cash).toBe(base().cash + payout)
    expect(settled.stats.totalEarned).toBe(payout)
  })

  it('pays nothing and says why on a day it did not', () => {
    const settled = settleSponsors(holding({ reputation: 5 }))
    expect(settled.today.sponsorIncome).toBe(0)
    expect(settled.cash).toBe(base().cash)
    expect(settled.sponsors.strikes).toBe(1)
    expect(settled.sponsors.lastMiss).toEqual(['reputation'])
  })

  it('clears the count on a day that pays, so one bad day never adds up', () => {
    const struck = settleSponsors(holding({ reputation: 5 }))
    const recovered = settleSponsors({ ...struck, reputation: 50, today: base().today })
    expect(recovered.sponsors.strikes).toBe(0)
    expect(recovered.sponsors.lastMiss).toEqual([])
  })

  it('ends the deal on the third miss in a row', () => {
    let state = holding({ reputation: 5 })
    for (let i = 0; i < STRIKES_TO_LAPSE; i += 1) state = settleSponsors(state)

    expect(state.sponsors.activeId).toBeNull()
    expect(state.sponsors.lapsed).toEqual(['juice-bar'])
    expect(state.sponsors.lastMiss).toEqual(['reputation'])
  })

  it('judges cleanliness on the worst of the day, not the state at the close', () => {
    const messy = holding({
      reputation: 90,
      today: { ...base().today, clientsServed: 60 },
      sponsors: { ...initialSponsors(), activeId: 'global', signedDay: 1, worstStains: 4 },
      stains: [],
    })
    expect(settleSponsors(messy).today.sponsorIncome).toBe(0)
    expect(settleSponsors(messy).sponsors.lastMiss).toEqual(['cleanliness'])
  })

  it('starts the next day on the dirt actually on the floor', () => {
    const settled = settleSponsors(holding({
      stains: [stain('s1')],
      sponsors: { ...initialSponsors(), activeId: 'juice-bar', signedDay: 1, worstStains: 9 },
    }))
    expect(settled.sponsors.worstStains).toBe(1)
  })

  it('names every condition that failed, not just the first', () => {
    const bad = holding({
      reputation: 0,
      sponsors: { ...initialSponsors(), activeId: 'city-apparel', signedDay: 1 },
    })
    expect(settleSponsors(bad).sponsors.lastMiss).toEqual(['reputation', 'clientsServed'])
  })
})

describe('signing a deal back after it lapsed', () => {
  const lapsed = (): GameState => holding({
    cash: 100_000,
    sponsors: { ...initialSponsors(), activeId: null, lapsed: ['juice-bar'] },
  })

  it('charges the fee and books it as money spent', () => {
    const { resignFee } = sponsorDeal('juice-bar')
    expect(signCost(lapsed(), 'juice-bar')).toBe(resignFee)

    const resigned = applySponsors(lapsed(), { type: 'sign', id: 'juice-bar' })
    expect(resigned.cash).toBe(100_000 - resignFee)
    expect(resigned.stats.totalSpent).toBe(resignFee)
    expect(resigned.sponsors.lapsed).toEqual([])
  })

  it('refuses a gym that cannot cover the fee', () => {
    const broke = { ...lapsed(), cash: 10 }
    expect(canSign(broke, 'juice-bar')).toBe(false)
    expect(applySponsors(broke, { type: 'sign', id: 'juice-bar' })).toBe(broke)
  })
})

describe('the day the player closes', () => {
  it('puts the cheque in the till before the bill is taken', () => {
    const closed = closeDay(holding({ dayMs: DAY_MS, cash: 0 }))
    const { payout } = sponsorDeal('juice-bar')

    expect(closed.dayReport!.sponsorIncome).toBe(payout)
    // The bill came out of a till the sponsor had already filled.
    expect(closed.cash).toBe(payout - closed.dayReport!.bill)
  })

  it('leaves the receipt line at nought on a day nothing paid', () => {
    expect(closeDay(holding({ dayMs: DAY_MS, reputation: 0 })).dayReport!.sponsorIncome).toBe(0)
  })
})
