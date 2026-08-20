import { describe, it, expect } from 'vitest'
import { initialState } from './economy'
import { applyMarketing } from './marketing'
import { campaignById } from './content/campaigns'
import {
  arrivalsPerDay,
  machineCapacityPerDay,
  outlookFor,
  scanCapacityPerDay,
  servablePerDay,
} from './capacity'
import type { Decor, GameState, Machine, Staff, StaffRank } from './types'

const machine = (uid: string, type: Machine['type']): Machine => ({
  uid, type, x: 4, y: 0, rotation: 0, durability: 100, occupiedBy: null, brokenMs: 0,
})

const desk = (uid: string, y: number): Decor => ({ uid, type: 'reception', x: 0, y, rotation: 0 })

const recep = (uid: string, rank: StaffRank = 'legend', owed = 0): Staff => ({
  uid, name: 'R', role: 'reception', rank,
  x: 0, z: 0, path: [], goal: null, targetUid: null, workMs: 0, owed,
})

const gym = (over: Partial<GameState> = {}): GameState => ({
  ...initialState(1, 0), cash: 500_000, level: 20, ...over,
})

describe('scanCapacityPerDay', () => {
  it('is nothing without a desk, however many receptionists are hired', () => {
    expect(scanCapacityPerDay(gym({ decor: [], staff: [recep('r1'), recep('r2')] }))).toBe(0)
  })

  it('is nothing without a receptionist, however many desks are built', () => {
    expect(scanCapacityPerDay(gym({ decor: [desk('d1', 1), desk('d2', 3)], staff: [] }))).toBe(0)
  })

  /**
   * `pickJob` hands out one desk per person, so a fifth receptionist in a gym
   * with four counters scans nothing. Projecting otherwise would tell the
   * player their reception is fine when half of it is standing idle.
   */
  it('pairs staff to desks and ignores whoever has nowhere to stand', () => {
    const oneDesk = gym({ decor: [desk('d1', 1)], staff: [recep('r1'), recep('r2')] })
    const twoDesks = gym({ decor: [desk('d1', 1), desk('d2', 3)], staff: [recep('r1'), recep('r2')] })

    expect(twoDesks && scanCapacityPerDay(twoDesks)).toBeCloseTo(2 * scanCapacityPerDay(oneDesk), 5)
  })

  it('puts the fastest staff on the desks there are', () => {
    const decor = [desk('d1', 1)]
    const slowFirst = gym({ decor, staff: [recep('r1', 'rare'), recep('r2', 'legend')] })
    const legendOnly = gym({ decor, staff: [recep('r2', 'legend')] })

    expect(scanCapacityPerDay(slowFirst)).toBe(scanCapacityPerDay(legendOnly))
  })

  it('does not count somebody on strike over unpaid wages', () => {
    const striking = gym({ decor: [desk('d1', 1)], staff: [recep('r1', 'legend', 900)] })
    expect(scanCapacityPerDay(striking)).toBe(0)
  })
})

describe('machineCapacityPerDay', () => {
  it('is nothing on a bare floor', () => {
    expect(machineCapacityPerDay(gym({ machines: [] }))).toBe(0)
  })

  it('counts a quicker workout as more seats in the same day', () => {
    // Dumbbells run 12s against the cable crossover's 22s.
    expect(machineCapacityPerDay(gym({ machines: [machine('m1', 'dumbbells')] })))
      .toBeGreaterThan(machineCapacityPerDay(gym({ machines: [machine('m1', 'cable')] })))
  })

  it('adds up across the floor', () => {
    const one = machineCapacityPerDay(gym({ machines: [machine('m1', 'bench')] }))
    const four = machineCapacityPerDay(gym({
      machines: ['a', 'b', 'c', 'd'].map(uid => machine(uid, 'bench')),
    }))
    expect(four).toBeCloseTo(4 * one, 5)
  })
})

describe('servablePerDay', () => {
  it('is whichever of the desk and the kit runs out first', () => {
    const kitStarved = gym({
      machines: [machine('m1', 'cable')],
      decor: [desk('d1', 1)],
      staff: [recep('r1')],
    })
    expect(servablePerDay(kitStarved)).toBe(machineCapacityPerDay(kitStarved))

    const deskStarved = gym({
      machines: Array.from({ length: 40 }, (_, i) => machine(`m${i}`, 'dumbbells')),
      decor: [desk('d1', 1)],
      staff: [recep('r1', 'rare')],
    })
    expect(servablePerDay(deskStarved)).toBe(scanCapacityPerDay(deskStarved))
  })
})

describe('arrivalsPerDay', () => {
  it('compounds a prospective campaign onto whatever is already live', () => {
    const floor = Array.from({ length: 10 }, (_, i) => machine(`m${i}`, 'cable'))
    const plain = gym({ machines: floor, reputation: 60 })
    const running = applyMarketing(plain, { type: 'start', campaignId: 'billboards' })

    // Asking what a television spot would add has to account for the
    // billboards already paying for themselves alongside it.
    expect(arrivalsPerDay(running, 2.4)).toBeCloseTo(arrivalsPerDay(plain, 1.75 * 2.4), 5)
  })
})

describe('outlookFor', () => {
  const bigFloor = Array.from({ length: 30 }, (_, i) => machine(`m${i}`, 'apex-rig'))

  it('warns about the reception when the desks are the thin part', () => {
    const oneDesk = gym({
      machines: bigFloor, reputation: 100,
      decor: [desk('d1', 1)], staff: [recep('r1', 'rare')],
    })
    expect(outlookFor(oneDesk, 'tv').shortOf).toBe('reception')
  })

  it('warns about the kit when the machines are the thin part', () => {
    const thinFloor = gym({
      machines: [machine('m1', 'cable')], reputation: 100,
      decor: [desk('d1', 1), desk('d2', 3), desk('d3', 5)],
      staff: [recep('r1'), recep('r2'), recep('r3')],
    })
    expect(outlookFor(thinFloor, 'tv').shortOf).toBe('machines')
  })

  it('stays quiet when the gym can cope', () => {
    const ready = gym({
      machines: bigFloor, reputation: 40,
      decor: [desk('d1', 1), desk('d2', 3), desk('d3', 5)],
      staff: [recep('r1'), recep('r2'), recep('r3')],
    })
    expect(outlookFor(ready, 'flyers').shortOf).toBeNull()
  })

  /**
   * A queue is meant to form — a gym with nobody waiting bought too much kit —
   * so the warning has to tolerate a modest overshoot or it would fire on every
   * offer in a healthy gym and stop meaning anything.
   */
  it('tolerates a small overshoot rather than crying wolf', () => {
    const ready = gym({
      machines: bigFloor, reputation: 40,
      decor: [desk('d1', 1), desk('d2', 3), desk('d3', 5)],
      staff: [recep('r1'), recep('r2'), recep('r3')],
    })
    const { arrivals, servable } = outlookFor(ready, 'flyers')
    expect(arrivals).toBeLessThan(servable * 1.15)
  })
})

describe('what an offer is worth', () => {
  /** A gym nobody can serve: the fee is the whole of the arithmetic. */
  const shut = () => gym({ decor: [], staff: [], machines: [] })

  /** A busy, well-staffed gym with room to grow into. */
  const busy = () => gym({
    reputation: 60,
    satisfaction: 80,
    decor: [desk('d1', 1), desk('d2', 3)],
    staff: [recep('r1'), recep('r2')],
    machines: Array.from({ length: 12 }, (_, i) => machine(`m${i}`, 'bench')),
  })

  /**
   * Capacity so far below the door that the queue is already full without any
   * advertising. Extra reach buys literally nothing here, which is what makes
   * it the honest test of whether the other two axes are counted.
   */
  const saturated = () => gym({
    reputation: 100,
    satisfaction: 80,
    decor: [desk('d1', 1)],
    staff: [recep('r1', 'rare')],
    machines: [machine('m0', 'bench')],
  })

  it('is nothing but the bill when the gym can serve nobody', () => {
    expect(outlookFor(shut(), 'flyers').net).toBeCloseTo(-campaignById('flyers').dailyCost, 5)
  })

  it('pays for itself when a busy gym has room for the extra crowd', () => {
    expect(outlookFor(busy(), 'flyers').net).toBeGreaterThan(0)
  })

  it('never counts an arrival the gym could not have served', () => {
    const capped = outlookFor(saturated(), 'tv').net
    expect(capped).toBeCloseTo(-campaignById('tv').dailyCost, 5)
  })

  it('counts what a better class of client is worth on the whole crowd', () => {
    // Reach is worthless at saturation, so anything above the bare fee here
    // is the rarity table being sold rather than the queue.
    const premium = outlookFor(saturated(), 'premium').net
    expect(premium).toBeGreaterThan(-campaignById('premium').dailyCost)
  })

  it('counts the passes a referral push sells to the same crowd', () => {
    const referral = outlookFor(saturated(), 'referral').net
    expect(referral).toBeGreaterThan(-campaignById('referral').dailyCost)
  })

  it('prices an offer on top of whatever is already live', () => {
    const alone = outlookFor(busy(), 'social').net
    const stacked = outlookFor(
      applyMarketing(busy(), { type: 'start', campaignId: 'flyers' }),
      'social',
    ).net

    // Campaigns compound, so an offer bought on top of another multiplies a
    // rate that is already lifted. While there is capacity left to fill, the
    // second one is worth more than the first — that is the whole reason
    // stacking exists, and the projection has to say so.
    expect(stacked).toBeGreaterThan(alone)
  })

  it('is worth more to a gym people already like', () => {
    const unknown = outlookFor(gym({ ...busy(), reputation: 5 }), 'social').net
    const loved = outlookFor(gym({ ...busy(), reputation: 95 }), 'social').net
    expect(loved).toBeGreaterThan(unknown)
  })
})
