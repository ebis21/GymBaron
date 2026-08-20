import { describe, expect, it } from 'vitest'
import { DAY_MS } from './constants'
import { campaignById } from './content/campaigns'
import { closeDay, nextDay } from './dayClose'
import { initialState } from './economy'
import { advance } from './tick'
import type { Machine, Member } from './types'
import {
  advanceMarketing,
  applyMarketing,
  initialMarketing,
  marketingLuck,
  marketingSignupBoost,
  normalizeMarketing,
  settleMarketing,
  spawnRateMultiplier,
  unmetRequirement,
} from './marketing'
import type { CampaignId } from './content/campaigns'

const base = () => initialState(1, 0)
const rich = () => ({ ...base(), cash: 100_000 })
const start = (id: CampaignId = 'flyers') =>
  applyMarketing(rich(), { type: 'start', campaignId: id })

const manyMachines = (count: number): Machine[] =>
  Array.from({ length: count }, (_, i) => ({
    uid: `m${i}`,
    type: 'bench' as const,
    x: i,
    y: 0,
    rotation: 0 as const,
    durability: 100,
    occupiedBy: null,
    brokenMs: 0,
  }))

const manyMembers = (count: number): Member[] =>
  Array.from({ length: count }, (_, i) => ({ uid: `p${i}`, joinedDay: 1 }))

/** A gym with the standing the premium offer asks for. */
const famous = () => ({ ...rich(), reputation: 60 })
/** A gym with the membership the referral offer asks for. */
const popular = () => ({ ...rich(), members: manyMembers(20) })

describe('starting a campaign', () => {
  it('starts immediately without charging before the day closes', () => {
    const before = rich()
    const campaign = campaignById('social')
    const after = applyMarketing(before, { type: 'start', campaignId: 'social' })

    expect(after.marketing).toEqual({
      running: [{ id: 'social', remainingMs: campaign.durationDays * DAY_MS }],
      billable: ['social'],
    })
    expect(after.cash).toBe(before.cash)
    expect(after.stats.totalSpent).toBe(before.stats.totalSpent)
    expect(spawnRateMultiplier(after)).toBe(campaign.spawnMultiplier)
  })

  it('counts a midday order as the first advertised calendar day', () => {
    const campaign = campaignById('flyers')
    const midday = { ...rich(), dayMs: DAY_MS / 2 }
    const after = applyMarketing(midday, { type: 'start', campaignId: 'flyers' })

    expect(after.marketing.running[0]!.remainingMs).toBe(campaign.durationDays * DAY_MS - DAY_MS / 2)
  })

  it('refuses to re-order an offer that is already live', () => {
    const running = start()
    expect(applyMarketing(running, { type: 'start', campaignId: 'flyers' })).toBe(running)
  })

  it('runs several offers side by side and compounds them', () => {
    const both = applyMarketing(start('billboards'), { type: 'start', campaignId: 'tv' })

    expect(both.marketing.running.map(r => r.id)).toEqual(['billboards', 'tv'])
    expect(spawnRateMultiplier(both)).toBeCloseTo(
      campaignById('billboards').spawnMultiplier * campaignById('tv').spawnMultiplier,
      10,
    )
  })

  it('prices the first invoice against everything that would then be live', () => {
    // Enough for the television spot on its own, but not on top of billboards.
    const tv = campaignById('tv').dailyCost
    const tight = { ...applyMarketing(rich(), { type: 'start', campaignId: 'billboards' }), cash: tv }
    expect(applyMarketing(tight, { type: 'start', campaignId: 'tv' })).toBe(tight)
  })

  it('refuses when the first daily bill is not covered', () => {
    const poor = { ...base(), cash: campaignById('flyers').dailyCost - 1 }
    expect(applyMarketing(poor, { type: 'start', campaignId: 'flyers' })).toBe(poor)
  })

  it('refuses after closing and after game over', () => {
    const closing = { ...rich(), dayMs: DAY_MS }
    const ended = { ...rich(), dayEnded: true }
    const over = { ...rich(), gameOver: true }

    expect(applyMarketing(closing, { type: 'start', campaignId: 'flyers' })).toBe(closing)
    expect(applyMarketing(ended, { type: 'start', campaignId: 'flyers' })).toBe(ended)
    expect(applyMarketing(over, { type: 'start', campaignId: 'flyers' })).toBe(over)
  })
})

describe('the campaign clock', () => {
  it('runs down during open hours and expires at the advertised close', () => {
    const running = start('flyers')
    const afterFirstDay = advanceMarketing(running, DAY_MS)
    const almost = advanceMarketing(afterFirstDay, DAY_MS - 1)
    const expired = advanceMarketing(almost, 1)

    expect(almost.marketing.running).toEqual([{ id: 'flyers', remainingMs: 1 }])
    expect(expired.marketing.running).toEqual([])
    expect(spawnRateMultiplier(expired)).toBe(1)
  })

  it('does not spend campaign time after the doors close', () => {
    const closing = { ...start(), dayMs: DAY_MS }
    expect(advanceMarketing(closing, 60_000)).toBe(closing)
  })

  it('leaves an idle gym alone', () => {
    const idle = base()
    expect(advanceMarketing(idle, 1_000)).toBe(idle)
    expect(spawnRateMultiplier(idle)).toBe(1)
  })
})

describe('daily settlement', () => {
  it('takes one daily fee and books both ledgers', () => {
    const running = start('social')
    const cost = campaignById('social').dailyCost
    const after = settleMarketing(running)

    expect(after.cash).toBe(running.cash - cost)
    expect(after.today.marketingSpend).toBe(running.today.marketingSpend + cost)
    expect(after.stats.totalSpent).toBe(running.stats.totalSpent + cost)
    expect(after.marketing.running.map(r => r.id)).toEqual(['social'])
    expect(after.marketing.billable).toEqual([])
  })

  it('cannot charge the same day twice', () => {
    const once = settleMarketing(start())
    expect(settleMarketing(once)).toBe(once)
  })

  it('keeps the final invoice after the clock expires', () => {
    const running = start('flyers')
    const afterFirstDay = advanceMarketing(running, DAY_MS)
    const expired = advanceMarketing(afterFirstDay, DAY_MS)
    const settled = settleMarketing(expired)

    expect(expired.marketing.running).toEqual([])
    expect(expired.marketing.billable).toEqual(['flyers'])
    expect(settled.today.marketingSpend).toBe(campaignById('flyers').dailyCost)
  })

  it('arms the next invoice when a continuing campaign enters a new day', () => {
    const afterClose = {
      ...settleMarketing(start('social')),
      dayMs: 0,
    }
    const nextDay = advanceMarketing(afterClose, 1)

    expect(nextDay.marketing.billable).toEqual(['social'])
  })

  it('bills every advertised closing and then disappears from the receipt', () => {
    const cost = campaignById('flyers').dailyCost
    let state = start('flyers')

    for (let day = 0; day < 2; day += 1) {
      state = advance(state, DAY_MS)
      state = closeDay(state)
      expect(state.dayReport?.marketingSpend).toBe(cost)
      state = nextDay(state)
    }

    state = closeDay(advance(state, DAY_MS))
    expect(state.dayReport?.marketingSpend).toBe(0)
    expect(spawnRateMultiplier(state)).toBe(1)
  })
})

describe('reading stored marketing state', () => {
  it('defaults arbitrary input without throwing', () => {
    for (const raw of [undefined, null, 42, 'ads', { junk: true }]) {
      expect(normalizeMarketing(raw)).toEqual(initialMarketing())
    }
  })

  it('keeps every valid running campaign and its pending invoices', () => {
    expect(normalizeMarketing({
      running: [{ id: 'billboards', remainingMs: 123 }, { id: 'tv', remainingMs: 456 }],
      billable: ['billboards', 'tv'],
    })).toEqual({
      running: [{ id: 'billboards', remainingMs: 123 }, { id: 'tv', remainingMs: 456 }],
      billable: ['billboards', 'tv'],
    })
  })

  /**
   * The single-campaign shape this feature shipped with. A save written before
   * offers could stack is a perfectly good save; reading it as a one-entry list
   * is the whole of the upgrade, and is why there is no version bump.
   */
  it('reads a save from before campaigns could stack', () => {
    expect(normalizeMarketing({
      activeCampaignId: 'billboards',
      remainingMs: 123,
      billableCampaignId: 'billboards',
    })).toEqual({
      running: [{ id: 'billboards', remainingMs: 123 }],
      billable: ['billboards'],
    })
  })

  it('drops corrupt ids and impossible remaining time', () => {
    expect(normalizeMarketing({
      running: [{ id: 'television', remainingMs: 5 }, { id: 'flyers', remainingMs: -10 }],
      billable: ['radio'],
    })).toEqual(initialMarketing())
  })

  it('caps a runaway clock at what the offer actually sells', () => {
    const max = campaignById('social').durationDays * DAY_MS
    expect(normalizeMarketing({
      running: [{ id: 'social', remainingMs: max * 99 }],
      billable: [],
    })).toEqual({ running: [{ id: 'social', remainingMs: max }], billable: [] })
  })

  it('never lets one offer hold two clocks, which would bill it twice', () => {
    expect(normalizeMarketing({
      running: [{ id: 'flyers', remainingMs: 10 }, { id: 'flyers', remainingMs: 20 }],
      billable: ['flyers', 'flyers'],
    })).toEqual({ running: [{ id: 'flyers', remainingMs: 10 }], billable: ['flyers'] })
  })
})

describe('what a campaign buys beyond footfall', () => {
  it('leaves the rarity table and the desk alone when nothing is running', () => {
    expect(marketingLuck(base())).toBe(1)
    expect(marketingSignupBoost(base())).toBe(1)
  })

  it('bends the rarity table only for the offer that pays for it', () => {
    const premium = { ...famous(), cash: 100_000 }
    const running = applyMarketing(premium, { type: 'start', campaignId: 'premium' })

    expect(marketingLuck(running)).toBe(campaignById('premium').clientLuck)
    expect(marketingSignupBoost(running)).toBe(1)
  })

  it('lifts conversion only for the offer that pays for it', () => {
    const running = applyMarketing(popular(), { type: 'start', campaignId: 'referral' })

    expect(marketingSignupBoost(running)).toBe(campaignById('referral').signupBoost)
    expect(marketingLuck(running)).toBe(1)
  })

  it('compounds both axes across everything live at once', () => {
    const ready = { ...famous(), members: popular().members, cash: 100_000 }
    const two = applyMarketing(
      applyMarketing(ready, { type: 'start', campaignId: 'premium' }),
      { type: 'start', campaignId: 'referral' },
    )

    expect(two.marketing.running.map(r => r.id)).toEqual(['premium', 'referral'])
    expect(marketingLuck(two)).toBe(campaignById('premium').clientLuck)
    expect(marketingSignupBoost(two)).toBe(campaignById('referral').signupBoost)
  })
})

describe('offers the gym has not earned yet', () => {
  it('names the bar a locked offer is short of', () => {
    expect(unmetRequirement(rich(), 'flyers')).toBe(null)
    expect(unmetRequirement(rich(), 'premium')).toBe('reputation')
    expect(unmetRequirement(rich(), 'referral')).toBe('members')
    expect(unmetRequirement(rich(), 'national')).toBe('reputation')
  })

  it('checks the bars in the order the screen lists them', () => {
    const reputable = { ...rich(), reputation: 80 }
    expect(unmetRequirement(reputable, 'national')).toBe('machines')
  })

  it('clears once the gym meets the bar', () => {
    expect(unmetRequirement(famous(), 'premium')).toBe(null)
    expect(unmetRequirement(popular(), 'referral')).toBe(null)
  })

  it('counts machines on every floor, not only the one on screen', () => {
    const ground = rich().floorPlans[0]!
    const upstairs = {
      ...rich(),
      reputation: 80,
      activeFloor: 0,
      machines: manyMachines(12),
      floorPlans: [ground, { ...ground, machines: manyMachines(12) }],
    }
    expect(unmetRequirement(upstairs, 'national')).toBe(null)
  })

  it('refuses to start an offer the gym has not unlocked', () => {
    const locked = rich()
    expect(applyMarketing(locked, { type: 'start', campaignId: 'premium' })).toBe(locked)
  })

  it('starts the same offer once the bar is cleared', () => {
    const after = applyMarketing(famous(), { type: 'start', campaignId: 'premium' })
    expect(after.marketing.running.map(r => r.id)).toEqual(['premium'])
  })
})
