import { describe, expect, it } from 'vitest'
import { CAMPAIGNS, campaignById } from './campaigns'

describe('the campaign table', () => {
  it('covers every offer exactly once and in screen order', () => {
    expect(CAMPAIGNS.map(campaign => campaign.id)).toEqual([
      'flyers',
      'social',
      'billboards',
      'influencer',
      'tv',
    ])
    expect(new Set(CAMPAIGNS.map(campaign => campaign.id)).size).toBe(CAMPAIGNS.length)
  })

  it('contains whole-day, positive offers that always raise footfall', () => {
    for (const campaign of CAMPAIGNS) {
      expect(Number.isInteger(campaign.durationDays)).toBe(true)
      expect(campaign.durationDays).toBeGreaterThan(0)
      expect(campaign.dailyCost).toBeGreaterThan(0)
      expect(campaign.spawnMultiplier).toBeGreaterThan(1)
    }
  })

  it('makes each step dearer per point of traffic than the one before it', () => {
    const pricePerLift = CAMPAIGNS.map(
      campaign => campaign.dailyCost / (campaign.spawnMultiplier - 1),
    )
    for (let i = 1; i < pricePerLift.length; i += 1) {
      expect(pricePerLift[i]!).toBeGreaterThan(pricePerLift[i - 1]!)
    }
  })

  it('looks offers up from the same table the screen lists', () => {
    for (const campaign of CAMPAIGNS) expect(campaignById(campaign.id)).toBe(campaign)
  })
})
