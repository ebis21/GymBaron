import { describe, expect, it } from 'vitest'
import { DAY_MS } from './constants'
import { campaignById } from './content/campaigns'
import { initialState } from './economy'
import {
  advanceMarketing,
  applyMarketing,
  initialMarketing,
  normalizeMarketing,
  settleMarketing,
  spawnRateMultiplier,
} from './marketing'

const base = () => initialState(1, 0)
const rich = () => ({ ...base(), cash: 100_000 })
const start = (id: 'flyers' | 'social' | 'billboards' = 'flyers') =>
  applyMarketing(rich(), { type: 'start', campaignId: id })

describe('starting a campaign', () => {
  it('starts immediately without charging before the day closes', () => {
    const before = rich()
    const campaign = campaignById('social')
    const after = applyMarketing(before, { type: 'start', campaignId: 'social' })

    expect(after.marketing).toEqual({
      activeCampaignId: 'social',
      remainingMs: campaign.durationDays * DAY_MS,
      billableCampaignId: 'social',
    })
    expect(after.cash).toBe(before.cash)
    expect(after.stats.totalSpent).toBe(before.stats.totalSpent)
    expect(spawnRateMultiplier(after)).toBe(campaign.spawnMultiplier)
  })

  it('counts a midday order as the first advertised calendar day', () => {
    const campaign = campaignById('flyers')
    const midday = { ...rich(), dayMs: DAY_MS / 2 }
    const after = applyMarketing(midday, { type: 'start', campaignId: 'flyers' })

    expect(after.marketing.remainingMs).toBe(campaign.durationDays * DAY_MS - DAY_MS / 2)
  })

  it('refuses another campaign while one is running', () => {
    const running = start()
    expect(applyMarketing(running, { type: 'start', campaignId: 'social' })).toBe(running)
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

    expect(almost.marketing.activeCampaignId).toBe('flyers')
    expect(almost.marketing.remainingMs).toBe(1)
    expect(expired.marketing.activeCampaignId).toBeNull()
    expect(expired.marketing.remainingMs).toBe(0)
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
    expect(after.marketing.activeCampaignId).toBe('social')
    expect(after.marketing.billableCampaignId).toBeNull()
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

    expect(expired.marketing.activeCampaignId).toBeNull()
    expect(expired.marketing.billableCampaignId).toBe('flyers')
    expect(settled.today.marketingSpend).toBe(campaignById('flyers').dailyCost)
  })

  it('arms the next invoice when a continuing campaign enters a new day', () => {
    const afterClose = {
      ...settleMarketing(start('social')),
      dayMs: 0,
    }
    const nextDay = advanceMarketing(afterClose, 1)

    expect(nextDay.marketing.billableCampaignId).toBe('social')
  })
})

describe('reading stored marketing state', () => {
  it('defaults arbitrary input without throwing', () => {
    for (const raw of [undefined, null, 42, 'ads', { junk: true }]) {
      expect(normalizeMarketing(raw)).toEqual(initialMarketing())
    }
  })

  it('keeps a valid running campaign and its pending invoice', () => {
    expect(normalizeMarketing({
      activeCampaignId: 'billboards',
      remainingMs: 123,
      billableCampaignId: 'billboards',
    })).toEqual({
      activeCampaignId: 'billboards',
      remainingMs: 123,
      billableCampaignId: 'billboards',
    })
  })

  it('drops corrupt ids and impossible remaining time', () => {
    expect(normalizeMarketing({
      activeCampaignId: 'television',
      remainingMs: Number.POSITIVE_INFINITY,
      billableCampaignId: 'radio',
    })).toEqual(initialMarketing())
    expect(normalizeMarketing({
      activeCampaignId: 'flyers',
      remainingMs: -10,
      billableCampaignId: 'flyers',
    })).toEqual({
      activeCampaignId: null,
      remainingMs: 0,
      billableCampaignId: 'flyers',
    })
  })
})
