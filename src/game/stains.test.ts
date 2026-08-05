import { describe, it, expect } from 'vitest'
import { ageStains, spawnStain, wipeStain, STAIN_OLD_MS } from './stains'
import { initialState } from './economy'
import type { GameState, Stain } from './types'

const stain = (over: Partial<Stain> = {}): Stain =>
  ({ uid: 's1', x: 2, y: 2, ageMs: 0, ...over })

const dirty = (stains: Stain[], reputation = 80): GameState =>
  ({ ...initialState(7, 0), reputation, stains })

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

  it('drains reputation while a stain sits there', () => {
    const s = ageStains(dirty([stain()]), 1000)
    expect(s.reputation).toBeLessThan(80)
  })

  it('drains twice as fast once a stain goes stale', () => {
    const fresh = ageStains(dirty([stain({ ageMs: 0 })]), 1000)
    const old = ageStains(dirty([stain({ ageMs: STAIN_OLD_MS + 1 })]), 1000)
    expect(80 - old.reputation).toBeGreaterThan(80 - fresh.reputation)
  })

  it('drains more with more stains on the floor', () => {
    const one = ageStains(dirty([stain({ uid: 's1' })]), 1000)
    const two = ageStains(dirty([stain({ uid: 's1' }), stain({ uid: 's2', x: 4 })]), 1000)
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
