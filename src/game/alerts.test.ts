import { describe, it, expect } from 'vitest'
import { countOf, gymAlerts, nearestAlert } from './alerts'
import { initialState } from './economy'
import { tileToWorld } from './layout'
import { NEGLECT_GRACE_MS } from './neglect'
import type { GameState, Machine, Stain } from './types'

const machine = (over: Partial<Machine> = {}): Machine => ({
  uid: 'm1',
  type: 'dumbbells',
  x: 2,
  y: 2,
  rotation: 0,
  durability: 100,
  occupiedBy: null,
  brokenMs: 0,
  ...over,
})

const stain = (over: Partial<Stain> = {}): Stain => ({ uid: 's1', x: 4, y: 1, ageMs: 0, ...over })

const gym = (over: Partial<GameState> = {}): GameState =>
  ({ ...initialState(7, 0), machines: [], decor: [], stains: [], ...over })

describe('gymAlerts', () => {
  it('reports nothing for a gym that is working and clean', () => {
    expect(gymAlerts(gym({ machines: [machine()] }))).toEqual([])
  })

  it('reports a machine only once it is actually out of service', () => {
    const worn = gymAlerts(gym({ machines: [machine({ durability: 1 })] }))
    expect(worn).toEqual([])

    const dead = gymAlerts(gym({ machines: [machine({ durability: 0 })] }))
    expect(dead).toHaveLength(1)
    expect(dead[0]).toMatchObject({ kind: 'broken', uid: 'm1', x: 2, y: 2 })
  })

  it('puts broken kit ahead of every mess, however stale the mess is', () => {
    const alerts = gymAlerts(
      gym({
        machines: [machine({ durability: 0, brokenMs: 10 })],
        stains: [stain({ ageMs: 120_000 })],
      }),
    )

    expect(alerts.map(a => a.kind)).toEqual(['broken', 'dirty'])
  })

  it('puts the oldest first within a kind', () => {
    const alerts = gymAlerts(
      gym({
        stains: [
          stain({ uid: 'fresh', ageMs: 1_000 }),
          stain({ uid: 'stale', x: 5, ageMs: 40_000 }),
        ],
      }),
    )

    expect(alerts.map(a => a.uid)).toEqual(['stale', 'fresh'])
  })

  it('flags only what is past the grace window as already costing', () => {
    const alerts = gymAlerts(
      gym({
        machines: [machine({ durability: 0, brokenMs: NEGLECT_GRACE_MS })],
        stains: [stain({ ageMs: NEGLECT_GRACE_MS - 1 })],
      }),
    )

    expect(alerts.map(a => a.costing)).toEqual([true, false])
  })
})

describe('countOf', () => {
  it('counts each kind apart', () => {
    const alerts = gymAlerts(
      gym({
        machines: [machine({ durability: 0 }), machine({ uid: 'm2', x: 3, durability: 0 })],
        stains: [stain()],
      }),
    )

    expect(countOf(alerts, 'broken')).toBe(2)
    expect(countOf(alerts, 'dirty')).toBe(1)
  })
})

describe('nearestAlert', () => {
  it('picks the closest of the asked-for kind, not the oldest', () => {
    const alerts = gymAlerts(
      gym({
        stains: [
          stain({ uid: 'stale-far', x: 6, y: 4, ageMs: 90_000 }),
          stain({ uid: 'fresh-near', x: 1, y: 1, ageMs: 500 }),
        ],
      }),
    )

    const near = nearestAlert(alerts, 'dirty', tileToWorld(1, 1))
    expect(near?.alert.uid).toBe('fresh-near')
    expect(near?.distance).toBeCloseTo(0)
  })

  it('ignores the other kind entirely', () => {
    const alerts = gymAlerts(
      gym({
        machines: [machine({ durability: 0, x: 6, y: 5 })],
        stains: [stain({ x: 0, y: 0 })],
      }),
    )

    expect(nearestAlert(alerts, 'broken', tileToWorld(0, 0))?.alert.uid).toBe('m1')
  })

  it('returns null when nothing of that kind is on the floor', () => {
    expect(nearestAlert(gymAlerts(gym()), 'dirty', { x: 0, z: 0 })).toBeNull()
  })

  it('answers with the target in world units, so the caller need not convert', () => {
    const alerts = gymAlerts(gym({ stains: [stain({ x: 4, y: 1 })] }))
    expect(nearestAlert(alerts, 'dirty', { x: 0, z: 0 })?.at).toEqual(tileToWorld(4, 1))
  })
})
