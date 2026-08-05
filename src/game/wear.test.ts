import { describe, it, expect } from 'vitest'
import { ageBrokenMachines } from './wear'
import { NEGLECT_GRACE_MS } from './neglect'
import { initialState } from './economy'
import type { GameState, Machine } from './types'

const machine = (over: Partial<Machine> = {}): Machine => ({
  uid: 'm1', type: 'dumbbells', x: 4, y: 2, rotation: 0,
  durability: 0, occupiedBy: null, brokenMs: 0, ...over,
})

const gym = (machines: Machine[], reputation = 80): GameState =>
  ({ ...initialState(7, 0), reputation, machines })

describe('ageBrokenMachines', () => {
  it('runs the broken-for clock on kit that is out of service', () => {
    const s = ageBrokenMachines(gym([machine()]), 1000)
    expect(s.machines[0]!.brokenMs).toBe(1000)
  })

  it('costs nothing while the wreck is still inside the grace window', () => {
    const s = ageBrokenMachines(gym([machine()]), 1000)
    expect(s.reputation).toBe(80)
  })

  it('drains reputation once the wreck outstays the grace window', () => {
    const s = ageBrokenMachines(gym([machine({ brokenMs: NEGLECT_GRACE_MS })]), 1000)
    expect(s.reputation).toBeLessThan(80)
  })

  it('only charges for the slice of the tick past the grace window', () => {
    const half = ageBrokenMachines(gym([machine({ brokenMs: NEGLECT_GRACE_MS - 500 })]), 1000)
    const full = ageBrokenMachines(gym([machine({ brokenMs: NEGLECT_GRACE_MS })]), 1000)
    expect(80 - half.reputation).toBeCloseTo((80 - full.reputation) / 2, 5)
  })

  it('drains more with more wrecks on the floor', () => {
    const past = { brokenMs: NEGLECT_GRACE_MS }
    const one = ageBrokenMachines(gym([machine(past)]), 1000)
    const two = ageBrokenMachines(gym([machine(past), machine({ uid: 'm2', ...past })]), 1000)
    expect(two.reputation).toBeLessThan(one.reputation)
  })

  it('leaves a working machine alone', () => {
    const s = ageBrokenMachines(gym([machine({ durability: 100 })]), 1000)
    expect(s.reputation).toBe(80)
    expect(s.machines[0]!.brokenMs).toBe(0)
  })

  /** The clock is derived, so a repair clears it with no bookkeeping at the call site. */
  it('resets the clock when a machine is repaired', () => {
    const s = ageBrokenMachines(gym([machine({ durability: 100, brokenMs: 90_000 })]), 1000)
    expect(s.machines[0]!.brokenMs).toBe(0)
  })

  it('hands the full grace window back after a repair', () => {
    let s = gym([machine({ durability: 100, brokenMs: 90_000 })])
    s = ageBrokenMachines(s, 1000)
    s = { ...s, machines: [{ ...s.machines[0]!, durability: 0 }] }
    s = ageBrokenMachines(s, 1000)
    expect(s.reputation).toBe(80)
  })

  it('never pushes reputation below zero', () => {
    const s = ageBrokenMachines(gym([machine({ brokenMs: NEGLECT_GRACE_MS })], 0.1), 60_000)
    expect(s.reputation).toBe(0)
  })
})
