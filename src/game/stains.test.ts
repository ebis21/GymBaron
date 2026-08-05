import { describe, it, expect } from 'vitest'
import { ageStains, spawnAmbientDirt, spawnStain, wipeStain, STAIN_OLD_MS } from './stains'
import { initialState } from './economy'
import { AMBIENT_DIRT_MAX_STAINS, GRID_H, GRID_W } from './constants'
import { NEGLECT_GRACE_MS } from './neglect'
import type { GameState, Machine, Stain } from './types'

const stain = (over: Partial<Stain> = {}): Stain =>
  ({ uid: 's1', x: 2, y: 2, ageMs: 0, ...over })

const dirty = (stains: Stain[], reputation = 80): GameState =>
  ({ ...initialState(7, 0), reputation, stains })

/** A floor with the starter decor cleared, so tile occupancy is exactly what a test sets up. */
const emptyGym = (over: Partial<GameState> = {}): GameState =>
  ({ ...initialState(7, 0), decor: [], ...over })

const machine = (x: number, y: number): Machine =>
  ({ uid: `m${x}-${y}`, type: 'dumbbells', x, y, rotation: 0, durability: 100, occupiedBy: null, brokenMs: 0 })

describe('spawnStain', () => {
  it('drops a stain on the given tile', () => {
    const s = spawnStain(initialState(7, 0), 3, 1)
    expect(s.stains).toHaveLength(1)
    expect(s.stains[0]).toMatchObject({ x: 3, y: 1, ageMs: 0 })
  })

  it('never stacks two stains on one tile', () => {
    const once = spawnStain(initialState(7, 0), 3, 1)
    const twice = spawnStain(once, 3, 1)
    expect(twice.stains).toHaveLength(1)
    expect(twice).toBe(once)
  })
})

describe('ageStains', () => {
  it('ages every stain by the elapsed time', () => {
    const s = ageStains(dirty([stain()]), 1000)
    expect(s.stains[0]!.ageMs).toBe(1000)
  })

  it('costs nothing while a fresh stain is still within the grace window', () => {
    const s = ageStains(dirty([stain()]), 1000)
    expect(s.reputation).toBe(80)
  })

  it('drains reputation once a stain outstays the grace window', () => {
    const s = ageStains(dirty([stain({ ageMs: NEGLECT_GRACE_MS })]), 1000)
    expect(s.reputation).toBeLessThan(80)
  })

  it('only charges for the slice of the tick past the grace window', () => {
    // Crosses the threshold half way through: half a second billable, not one.
    const half = ageStains(dirty([stain({ ageMs: NEGLECT_GRACE_MS - 500 })]), 1000)
    const full = ageStains(dirty([stain({ ageMs: NEGLECT_GRACE_MS })]), 1000)
    expect(80 - half.reputation).toBeCloseTo((80 - full.reputation) / 2, 5)
  })

  it('drains twice as fast once a stain goes stale', () => {
    // Both are past the grace window, so this compares the two drain rates
    // rather than one draining and the other being free.
    const fresh = ageStains(dirty([stain({ ageMs: NEGLECT_GRACE_MS + 1 })]), 1000)
    const old = ageStains(dirty([stain({ ageMs: STAIN_OLD_MS + 1 })]), 1000)
    expect(80 - fresh.reputation).toBeGreaterThan(0)
    expect(80 - old.reputation).toBeCloseTo((80 - fresh.reputation) * 2, 5)
  })

  it('drains more with more stains on the floor', () => {
    const past = { ageMs: NEGLECT_GRACE_MS }
    const one = ageStains(dirty([stain({ uid: 's1', ...past })]), 1000)
    const two = ageStains(
      dirty([stain({ uid: 's1', ...past }), stain({ uid: 's2', x: 4, ...past })]),
      1000,
    )
    expect(two.reputation).toBeLessThan(one.reputation)
  })

  it('never pushes reputation below zero', () => {
    const s = ageStains(dirty([stain()], 0.1), 60_000)
    expect(s.reputation).toBe(0)
  })

  it('changes nothing on a clean floor', () => {
    const clean = dirty([])
    expect(ageStains(clean, 1000)).toBe(clean)
  })
})

describe('spawnAmbientDirt', () => {
  it('eventually spawns a stain on a clean floor', () => {
    let s = emptyGym()
    for (let i = 0; i < 500 && s.stains.length === 0; i += 1) s = spawnAmbientDirt(s, 1000)
    expect(s.stains.length).toBeGreaterThan(0)
  })

  it('is deterministic for a given seed', () => {
    let a = emptyGym()
    let b = emptyGym()
    for (let i = 0; i < 200; i += 1) {
      a = spawnAmbientDirt(a, 1000)
      b = spawnAmbientDirt(b, 1000)
    }
    expect(a).toEqual(b)
  })

  it('rolls far less often than every frame', () => {
    // A short frame's worth of dtMs should carry a tiny fraction of the
    // once-a-second odds, not the full amount re-rolled every call.
    let s = emptyGym()
    for (let i = 0; i < 500; i += 1) s = spawnAmbientDirt(s, 16)
    expect(s.stains.length).toBeLessThan(3)
  })

  it('never lands on an occupied tile', () => {
    // Every tile but (7, 5) carries a machine, so any stain that appears has
    // nowhere to go but the one free spot.
    const machines: Machine[] = []
    for (let x = 0; x < GRID_W; x += 1) {
      for (let y = 0; y < GRID_H; y += 1) {
        if (x === 7 && y === 5) continue
        machines.push(machine(x, y))
      }
    }
    let s = emptyGym({ machines })
    for (let i = 0; i < 500 && s.stains.length === 0; i += 1) s = spawnAmbientDirt(s, 1000)
    expect(s.stains).toHaveLength(1)
    expect(s.stains[0]).toMatchObject({ x: 7, y: 5 })
  })

  it('changes nothing once every tile is occupied or already stained', () => {
    const machines: Machine[] = []
    for (let x = 0; x < GRID_W; x += 1) {
      for (let y = 0; y < GRID_H; y += 1) machines.push(machine(x, y))
    }
    const full = emptyGym({ machines })
    let s = full
    for (let i = 0; i < 200; i += 1) s = spawnAmbientDirt(s, 1000)
    expect(s.stains).toHaveLength(0)
  })

  it('never spawns past the cap', () => {
    const packed = Array.from({ length: AMBIENT_DIRT_MAX_STAINS }, (_, i) =>
      stain({ uid: `s${i}`, x: i % GRID_W, y: 0 }))
    let s = emptyGym({ stains: packed })
    for (let i = 0; i < 500; i += 1) s = spawnAmbientDirt(s, 1000)
    expect(s.stains).toHaveLength(AMBIENT_DIRT_MAX_STAINS)
  })
})

describe('wipeStain', () => {
  it('removes the stain', () => {
    const s = wipeStain(dirty([stain()]), 's1')
    expect(s.stains).toHaveLength(0)
  })

  it('ignores an unknown uid', () => {
    const before = dirty([stain()])
    expect(wipeStain(before, 'nope')).toBe(before)
  })
})
