import { describe, it, expect } from 'vitest'
import { spawnClients, advanceClients, scanClient } from './clients'
import { initialState } from './economy'
import { PATIENCE_MS } from './constants'
import type { GameState, Machine } from './types'

const machine = (over: Partial<Machine> = {}): Machine =>
  ({ uid: 'm1', type: 'dumbbells', x: 0, y: 0, durability: 100, occupiedBy: null, ...over })

const gym = (): GameState => ({ ...initialState(7, 0), machines: [machine()] })

describe('spawnClients', () => {
  it('never spawns into a gym with no machines', () => {
    let s = initialState(7, 0)
    for (let i = 0; i < 200; i++) s = spawnClients(s, 1000)
    expect(s.clients).toHaveLength(0)
  })

  it('never spawns when every machine is broken', () => {
    let s: GameState = { ...gym(), machines: [machine({ durability: 0 })] }
    for (let i = 0; i < 200; i++) s = spawnClients(s, 1000)
    expect(s.clients).toHaveLength(0)
  })

  it('eventually spawns when a free working machine exists', () => {
    let s = gym()
    for (let i = 0; i < 300 && s.clients.length === 0; i++) s = spawnClients(s, 1000)
    expect(s.clients.length).toBeGreaterThan(0)
  })

  it('is deterministic for a given seed', () => {
    let a = gym(); let b = gym()
    for (let i = 0; i < 50; i++) { a = spawnClients(a, 1000); b = spawnClients(b, 1000) }
    expect(a).toEqual(b)
  })
})

describe('queue patience', () => {
  it('drops an unscanned client after PATIENCE_MS and hurts reputation', () => {
    const s0: GameState = { ...gym(), reputation: 50,
      clients: [{ uid: 'c1', phase: 'queue', phaseMs: 0, machineUid: null }] }
    const s = advanceClients(s0, PATIENCE_MS + 1)
    expect(s.clients).toHaveLength(0)
    expect(s.stats.clientsLost).toBe(1)
    expect(s.reputation).toBeLessThan(50)
  })

  it('keeps a client who still has patience', () => {
    const s0: GameState = { ...gym(),
      clients: [{ uid: 'c1', phase: 'queue', phaseMs: 0, machineUid: null }] }
    expect(advanceClients(s0, PATIENCE_MS - 1).clients).toHaveLength(1)
  })

  it('never drives reputation below zero', () => {
    let s: GameState = { ...gym(), reputation: 0,
      clients: [{ uid: 'c1', phase: 'queue', phaseMs: 0, machineUid: null }] }
    s = advanceClients(s, PATIENCE_MS + 1)
    expect(s.reputation).toBeGreaterThanOrEqual(0)
  })
})

describe('scanClient', () => {
  it('charges the fee and puts the client on a machine', () => {
    const s0: GameState = { ...gym(),
      clients: [{ uid: 'c1', phase: 'queue', phaseMs: 0, machineUid: null }] }
    const s = scanClient(s0, 'c1')
    expect(s.cash).toBeGreaterThan(s0.cash)
    expect(s.stats.totalEarned).toBeGreaterThan(0)
    expect(s.clients[0]!.phase).toBe('workout')
    expect(s.clients[0]!.machineUid).toBe('m1')
    expect(s.machines[0]!.occupiedBy).toBe('c1')
  })

  it('resets the phase timer when the client starts training', () => {
    const s0: GameState = { ...gym(),
      clients: [{ uid: 'c1', phase: 'queue', phaseMs: 5000, machineUid: null }] }
    expect(scanClient(s0, 'c1').clients[0]!.phaseMs).toBe(0)
  })

  it('is a no-op when every machine is busy', () => {
    const s0: GameState = { ...gym(),
      machines: [machine({ occupiedBy: 'other' })],
      clients: [{ uid: 'c1', phase: 'queue', phaseMs: 0, machineUid: null }] }
    const s = scanClient(s0, 'c1')
    expect(s.clients[0]!.phase).toBe('queue')
    expect(s.cash).toBe(s0.cash)
  })

  it('is a no-op when the only machine is broken', () => {
    const s0: GameState = { ...gym(),
      machines: [machine({ durability: 0 })],
      clients: [{ uid: 'c1', phase: 'queue', phaseMs: 0, machineUid: null }] }
    expect(scanClient(s0, 'c1').clients[0]!.phase).toBe('queue')
  })

  it('ignores an unknown client id', () => {
    const s0 = gym()
    expect(scanClient(s0, 'nope')).toEqual(s0)
  })

  it('ignores a client who is already training', () => {
    const s0: GameState = { ...gym(),
      clients: [{ uid: 'c1', phase: 'workout', phaseMs: 0, machineUid: 'm1' }] }
    expect(scanClient(s0, 'c1')).toEqual(s0)
  })
})

describe('workout completion', () => {
  it('frees the machine, wears it, and pays out satisfaction and xp', () => {
    const s0: GameState = { ...gym(), satisfaction: 50,
      machines: [machine({ occupiedBy: 'c1' })],
      clients: [{ uid: 'c1', phase: 'workout', phaseMs: 0, machineUid: 'm1' }] }
    const s = advanceClients(s0, 99_000)
    expect(s.clients).toHaveLength(0)
    expect(s.machines[0]!.occupiedBy).toBeNull()
    expect(s.machines[0]!.durability).toBeLessThan(100)
    expect(s.stats.clientsServed).toBe(1)
    expect(s.xp + (s.level - 1) * 100).toBeGreaterThan(0)
  })

  it('does not finish a workout early', () => {
    const s0: GameState = { ...gym(),
      machines: [machine({ occupiedBy: 'c1' })],
      clients: [{ uid: 'c1', phase: 'workout', phaseMs: 0, machineUid: 'm1' }] }
    expect(advanceClients(s0, 1_000).clients).toHaveLength(1)
  })

  it('takes a machine out of service at zero durability without going negative', () => {
    const s0: GameState = { ...gym(),
      machines: [machine({ occupiedBy: 'c1', durability: 0.1 })],
      clients: [{ uid: 'c1', phase: 'workout', phaseMs: 0, machineUid: 'm1' }] }
    expect(advanceClients(s0, 99_000).machines[0]!.durability).toBe(0)
  })

  it('never drives satisfaction above 100', () => {
    const s0: GameState = { ...gym(), satisfaction: 99,
      machines: [machine({ occupiedBy: 'c1' })],
      clients: [{ uid: 'c1', phase: 'workout', phaseMs: 0, machineUid: 'm1' }] }
    expect(advanceClients(s0, 99_000).satisfaction).toBeLessThanOrEqual(100)
  })
})
