import { describe, it, expect } from 'vitest'
import { spawnWalkins, spawnMembers, advanceClients, scanClient } from './clients'
import { initialState } from './economy'
import { MAX_QUEUE, PATIENCE_MS } from './constants'
import type { Client, GameState, Machine, Member } from './types'

const machine = (over: Partial<Machine> = {}): Machine =>
  ({ uid: 'm1', type: 'dumbbells', x: 0, y: 0, rotation: 0, durability: 100, occupiedBy: null, ...over })

const client = (over: Partial<Client> = {}): Client => ({
  uid: 'c1',
  kind: 'walkin',
  phase: 'queue',
  phaseMs: 0,
  machineUid: null,
  memberUid: null,
  ...over,
})

const member = (uid: string, joinedDay = 1): Member => ({ uid, joinedDay })

const gym = (): GameState => ({ ...initialState(7, 0), machines: [machine()] })

describe('spawnWalkins', () => {
  it('never spawns into a gym with no machines', () => {
    let s = initialState(7, 0)
    for (let i = 0; i < 200; i++) s = spawnWalkins(s, 1000)
    expect(s.clients).toHaveLength(0)
  })

  it('never spawns when every machine is broken', () => {
    let s: GameState = { ...gym(), machines: [machine({ durability: 0 })] }
    for (let i = 0; i < 200; i++) s = spawnWalkins(s, 1000)
    expect(s.clients).toHaveLength(0)
  })

  it('eventually spawns when a free working machine exists', () => {
    let s = gym()
    for (let i = 0; i < 300 && s.clients.length === 0; i++) s = spawnWalkins(s, 1000)
    expect(s.clients.length).toBeGreaterThan(0)
  })

  it('spawns passers-by, never members', () => {
    let s = gym()
    for (let i = 0; i < 300; i++) s = spawnWalkins(s, 1000)
    expect(s.clients.every(c => c.kind === 'walkin')).toBe(true)
  })

  it('stops at the queue cap', () => {
    let s = gym()
    for (let i = 0; i < 2000; i++) s = spawnWalkins(s, 1000)
    expect(s.clients.filter(c => c.phase === 'queue').length).toBeLessThanOrEqual(MAX_QUEUE)
  })

  it('is deterministic for a given seed', () => {
    let a = gym(); let b = gym()
    for (let i = 0; i < 50; i++) { a = spawnWalkins(a, 1000); b = spawnWalkins(b, 1000) }
    expect(a).toEqual(b)
  })
})

describe('spawnMembers', () => {
  it('does nothing when there are no members', () => {
    let s = gym()
    for (let i = 0; i < 300; i++) s = spawnMembers(s, 1000)
    expect(s.clients).toHaveLength(0)
  })

  it('eventually brings a member in, tagged and traceable to the pass', () => {
    let s: GameState = { ...gym(), members: [member('p1')] }
    for (let i = 0; i < 2000 && s.clients.length === 0; i++) s = spawnMembers(s, 1000)
    expect(s.clients).toHaveLength(1)
    expect(s.clients[0]!.kind).toBe('member')
    expect(s.clients[0]!.memberUid).toBe('p1')
  })

  it('never has the same member queueing twice at once', () => {
    let s: GameState = { ...gym(), members: [member('p1')] }
    for (let i = 0; i < 2000; i++) s = spawnMembers(s, 1000)
    const uids = s.clients.map(c => c.memberUid)
    expect(new Set(uids).size).toBe(uids.length)
  })
})

describe('queue patience', () => {
  it('drops an unscanned client after PATIENCE_MS and hurts reputation', () => {
    const s0: GameState = { ...gym(), reputation: 50,
      clients: [client()] }
    const s = advanceClients(s0, PATIENCE_MS + 1)
    expect(s.clients).toHaveLength(0)
    expect(s.stats.clientsLost).toBe(1)
    expect(s.reputation).toBeLessThan(50)
  })

  it('keeps a client who still has patience', () => {
    const s0: GameState = { ...gym(),
      clients: [client()] }
    expect(advanceClients(s0, PATIENCE_MS - 1).clients).toHaveLength(1)
  })

  it('never drives reputation below zero', () => {
    let s: GameState = { ...gym(), reputation: 0,
      clients: [client()] }
    s = advanceClients(s, PATIENCE_MS + 1)
    expect(s.reputation).toBeGreaterThanOrEqual(0)
  })
})

describe('scanClient', () => {
  it('charges the fee and puts the client on a machine', () => {
    const s0: GameState = { ...gym(),
      clients: [client()] }
    const s = scanClient(s0, 'c1')
    expect(s.cash).toBeGreaterThan(s0.cash)
    expect(s.stats.totalEarned).toBeGreaterThan(0)
    expect(s.clients[0]!.phase).toBe('workout')
    expect(s.clients[0]!.machineUid).toBe('m1')
    expect(s.machines[0]!.occupiedBy).toBe('c1')
  })

  it('resets the phase timer when the client starts training', () => {
    const s0: GameState = { ...gym(),
      clients: [client({ phaseMs: 5000 })] }
    expect(scanClient(s0, 'c1').clients[0]!.phaseMs).toBe(0)
  })

  it('is a no-op when every machine is busy', () => {
    const s0: GameState = { ...gym(),
      machines: [machine({ occupiedBy: 'other' })],
      clients: [client()] }
    const s = scanClient(s0, 'c1')
    expect(s.clients[0]!.phase).toBe('queue')
    expect(s.cash).toBe(s0.cash)
  })

  it('is a no-op when the only machine is broken', () => {
    const s0: GameState = { ...gym(),
      machines: [machine({ durability: 0 })],
      clients: [client()] }
    expect(scanClient(s0, 'c1').clients[0]!.phase).toBe('queue')
  })

  it('ignores an unknown client id', () => {
    const s0 = gym()
    expect(scanClient(s0, 'nope')).toEqual(s0)
  })

  it('ignores a client who is already training', () => {
    const s0: GameState = { ...gym(),
      clients: [client({ phase: 'workout', machineUid: 'm1' })] }
    expect(scanClient(s0, 'c1')).toEqual(s0)
  })
})

describe('workout completion', () => {
  it('frees the machine, wears it, and pays out satisfaction and xp', () => {
    const s0: GameState = { ...gym(), satisfaction: 50,
      machines: [machine({ occupiedBy: 'c1' })],
      clients: [client({ phase: 'workout', machineUid: 'm1' })] }
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
      clients: [client({ phase: 'workout', machineUid: 'm1' })] }
    expect(advanceClients(s0, 1_000).clients).toHaveLength(1)
  })

  it('takes a machine out of service at zero durability without going negative', () => {
    const s0: GameState = { ...gym(),
      machines: [machine({ occupiedBy: 'c1', durability: 0.1 })],
      clients: [client({ phase: 'workout', machineUid: 'm1' })] }
    expect(advanceClients(s0, 99_000).machines[0]!.durability).toBe(0)
  })

  it('never drives satisfaction above 100', () => {
    const s0: GameState = { ...gym(), satisfaction: 99,
      machines: [machine({ occupiedBy: 'c1' })],
      clients: [client({ phase: 'workout', machineUid: 'm1' })] }
    expect(advanceClients(s0, 99_000).satisfaction).toBeLessThanOrEqual(100)
  })
})

describe('member visits', () => {
  it('charges a member a tenth of what a passer-by pays at the same machine', () => {
    const walkin = scanClient({ ...gym(), clients: [client()] }, 'c1')
    const holder: GameState = {
      ...gym(),
      members: [member('p1')],
      clients: [client({ kind: 'member', memberUid: 'p1' })],
    }
    const scanned = scanClient(holder, 'c1')

    const paidByWalkin = walkin.cash - gym().cash
    const paidByMember = scanned.cash - holder.cash
    expect(paidByMember).toBeCloseTo(paidByWalkin * 0.1, 5)
  })

  it('still makes a member queue and wait to be scanned', () => {
    const s0: GameState = {
      ...gym(),
      members: [member('p1')],
      clients: [client({ kind: 'member', memberUid: 'p1' })],
    }
    const s = advanceClients(s0, PATIENCE_MS + 1)
    expect(s.clients).toHaveLength(0)
    expect(s.stats.clientsLost).toBe(1)
  })
})

describe('signing up', () => {
  it('turns satisfied passers-by into members and banks their first pass', () => {
    // A packed happy gym: run enough finished workouts that at least one
    // of the ~40% conversion rolls has to land.
    let s: GameState = { ...gym(), satisfaction: 100 }
    for (let i = 0; i < 40 && s.members.length === 0; i += 1) {
      s = {
        ...s,
        machines: [machine({ occupiedBy: 'c1' })],
        clients: [client({ phase: 'workout', machineUid: 'm1' })],
      }
      s = advanceClients(s, 99_000)
    }
    expect(s.members.length).toBeGreaterThan(0)
    expect(s.today.signups).toBeGreaterThan(0)
    expect(s.today.subscriptions).toBeGreaterThan(0)
    expect(s.cash).toBeGreaterThan(gym().cash)
  })

  it('never signs up a client who already holds a pass', () => {
    let s: GameState = {
      ...gym(),
      satisfaction: 100,
      members: [member('p1')],
      machines: [machine({ occupiedBy: 'c1' })],
      clients: [client({ kind: 'member', memberUid: 'p1', phase: 'workout', machineUid: 'm1' })],
    }
    s = advanceClients(s, 99_000)
    expect(s.members).toHaveLength(1)
    expect(s.today.signups).toBe(0)
  })
})
