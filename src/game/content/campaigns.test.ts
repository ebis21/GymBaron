import { describe, expect, it } from 'vitest'
import { CAMPAIGNS, campaignById, isPureReach } from './campaigns'

describe('the campaign table', () => {
  it('covers every offer exactly once and in screen order', () => {
    expect(CAMPAIGNS.map(campaign => campaign.id)).toEqual([
      'flyers',
      'referral',
      'social',
      'billboards',
      'premium',
      'openDay',
      'influencer',
      'tv',
      'national',
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

  it('lists the offers cheapest first, so the screen reads as a ladder', () => {
    const costs = CAMPAIGNS.map(campaign => campaign.dailyCost)
    for (let i = 1; i < costs.length; i += 1) {
      expect(costs[i]!).toBeGreaterThan(costs[i - 1]!)
    }
  })

  it('makes each pure-reach step dearer per point of traffic than the one before it', () => {
    const pricePerLift = CAMPAIGNS
      .filter(isPureReach)
      .map(campaign => campaign.dailyCost / (campaign.spawnMultiplier - 1))

    expect(pricePerLift.length).toBeGreaterThan(1)
    for (let i = 1; i < pricePerLift.length; i += 1) {
      expect(pricePerLift[i]!).toBeGreaterThan(pricePerLift[i - 1]!)
    }
  })

  it('buys something other than reach with every offer that breaks the ladder', () => {
    // The ladder rule above only governs offers whose whole value is footfall.
    // Anything exempted from it has to be paying for a second axis, or it is
    // simply mispriced against its neighbours.
    for (const campaign of CAMPAIGNS.filter(c => !isPureReach(c))) {
      const extra = (campaign.clientLuck ?? 1) > 1 ||
        (campaign.signupBoost ?? 1) > 1 ||
        campaign.durationDays === 1
      expect(extra).toBe(true)
    }
  })

  it('states every unlock as a bar the gym can actually clear', () => {
    for (const campaign of CAMPAIGNS) {
      if (!campaign.requires) continue
      const { reputation, machines, members } = campaign.requires

      expect(Object.keys(campaign.requires).length).toBeGreaterThan(0)
      if (reputation !== undefined) {
        expect(reputation).toBeGreaterThan(0)
        expect(reputation).toBeLessThanOrEqual(100)
      }
      if (machines !== undefined) expect(Number.isInteger(machines) && machines > 0).toBe(true)
      if (members !== undefined) expect(Number.isInteger(members) && members > 0).toBe(true)
    }
  })

  it('leaves the opening offers unlocked, so a new gym has something to buy', () => {
    expect(campaignById('flyers').requires).toBeUndefined()
    expect(campaignById('social').requires).toBeUndefined()
  })

  it('looks offers up from the same table the screen lists', () => {
    for (const campaign of CAMPAIGNS) expect(campaignById(campaign.id)).toBe(campaign)
  })
})
