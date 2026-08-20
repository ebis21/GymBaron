import { describe, it, expect } from 'vitest'
import { moveClients, queueAnchorFor } from './clientMove'
import { advanceClients, scanClient } from './clients'
import { initialState } from './economy'
import { PATIENCE_MS } from './constants'
import { DOOR_X } from './layout'
import type { Client, Decor, GameState, Machine, Staff } from './types'

const machine = (over: Partial<Machine> = {}): Machine => ({
  uid: 'm1', type: 'dumbbells', x: 4, y: 2, rotation: 0,
  durability: 100, occupiedBy: null, brokenMs: 0, ...over,
})

const client = (over: Partial<Client> = {}): Client => ({
  uid: 'c1', kind: 'walkin', rarity: 'common',
  phase: 'arriving', phaseMs: 0, machineUid: null, memberUid: null, trainerUid: null,
  x: DOOR_X, z: 0, path: [], goal: null, ...over,
})

const desk = (uid: string, x: number): Decor => ({
  uid, type: 'reception', x, y: 1, rotation: 0,
})

const receptionist = (uid: string, targetUid: string, owed = 0): Staff => ({
  uid, name: 'Marta K.', role: 'reception', rank: 'rare', targetUid, owed,
  workMs: 0, x: 0, z: 0, path: [], goal: null,
})

const gym = (over: Partial<GameState> = {}): GameState => ({
  ...initialState(7, 0), machines: [machine()], ...over,
})

describe('queueAnchorFor', () => {
  it('uses the reception desk when one is placed', () => {
    const s = gym()
    expect(s.decor.some(d => d.type === 'reception')).toBe(true)
    expect(queueAnchorFor(s).x).not.toBe(DOOR_X)
  })

  it('falls back to the door with no desk', () => {
    const s = gym({ decor: [] })
    expect(queueAnchorFor(s).x).toBe(DOOR_X)
  })
})

describe('moveClients', () => {
  it('splits arrivals between all working reception desks', () => {
    const s = moveClients(gym({
      decor: [desk('d1', 1), desk('d2', 3), desk('d3', 6)],
      staff: [
        receptionist('e1', 'd1'),
        receptionist('e2', 'd2'),
        receptionist('e3', 'd3'),
      ],
      clients: [
        client({ uid: 'c1' }), client({ uid: 'c2' }), client({ uid: 'c3' }),
        client({ uid: 'c4' }), client({ uid: 'c5' }), client({ uid: 'c6' }),
      ],
    }), 16)

    expect(s.clients.map(c => c.receptionUid)).toEqual(['d1', 'd2', 'd3', 'd1', 'd2', 'd3'])
    expect(s.clients[0]!.goal).not.toEqual(s.clients[1]!.goal)
  })

  it('does not send visitors to an unstaffed extra desk', () => {
    const s = moveClients(gym({
      decor: [desk('d1', 1), desk('d2', 6)],
      staff: [receptionist('e2', 'd2')],
      clients: [client({ uid: 'c1' }), client({ uid: 'c2' })],
    }), 16)

    expect(s.clients.map(c => c.receptionUid)).toEqual(['d2', 'd2'])
  })

  it('re-routes a queue when its receptionist goes off duty', () => {
    const s = moveClients(gym({
      decor: [desk('d1', 1), desk('d2', 6)],
      staff: [receptionist('e1', 'd1'), receptionist('e2', 'd2', 500)],
      clients: [client({ receptionUid: 'd2', phase: 'queue' })],
    }), 16)

    expect(s.clients[0]!.receptionUid).toBe('d1')
    expect(s.clients[0]!.goal).toEqual({ x: 1, y: 2 })
  })

  it('promotes an arriving client to queue once it reaches its spot', () => {
    let s = gym({ clients: [client()] })
    for (let i = 0; i < 60 && s.clients[0]?.phase === 'arriving'; i++) {
      s = moveClients(s, 500)
    }
    expect(s.clients[0]!.phase).toBe('queue')
  })

  it('does not burn patience while still arriving', () => {
    let s = gym({ clients: [client()] })
    s = moveClients(s, 100)
    expect(s.clients[0]!.phase).toBe('arriving')

    // Far more than a full patience window, spent entirely on the walk in.
    for (let i = 0; i < 5; i++) s = advanceClients(s, PATIENCE_MS)
    expect(s.clients.some(c => c.uid === 'c1')).toBe(true)
  })

  it('sends a scanned client walking to its machine', () => {
    let s = gym({ clients: [client({ phase: 'queue' })] })
    s = scanClient(s, 'c1')
    expect(s.clients[0]!.phase).toBe('toMachine')
    expect(s.machines[0]!.occupiedBy).toBe('c1')
  })

  it('starts the workout only once the machine is reached', () => {
    let s = gym({ clients: [client({ phase: 'queue' })] })
    s = scanClient(s, 'c1')
    expect(s.clients[0]!.phase).toBe('toMachine')

    for (let i = 0; i < 60 && s.clients[0]?.phase === 'toMachine'; i++) {
      s = moveClients(s, 500)
    }
    expect(s.clients[0]!.phase).toBe('workout')
  })

  it('frees the machine when a client leaves before reaching it', () => {
    let s = gym({ clients: [client({ phase: 'queue' })] })
    s = scanClient(s, 'c1')
    // The machine breaks under them while they are still walking over.
    s = { ...s, machines: [{ ...s.machines[0]!, durability: 0 }] }
    s = moveClients(s, 100)

    expect(s.clients[0]!.phase).toBe('leaving')
    expect(s.machines[0]!.occupiedBy).toBeNull()
  })

  it('drops a leaving client once it is out of the door', () => {
    let s = gym({ clients: [client({ phase: 'leaving' })] })
    for (let i = 0; i < 80 && s.clients.length > 0; i++) s = moveClients(s, 500)
    expect(s.clients).toHaveLength(0)
  })

  it('counts an arriving client walled off from the desk as lost, and costs reputation', () => {
    const walled = gym({
      reputation: 50,
      satisfaction: 50,
      decor: [{ uid: 'd1', type: 'reception', x: 3, y: 3, rotation: 0 }],
      walls: [
        { uid: 'w1', x: 3, y: 3, side: 'n' },
        { uid: 'w2', x: 3, y: 4, side: 'n' },
        { uid: 'w3', x: 3, y: 3, side: 'w' },
        { uid: 'w4', x: 4, y: 3, side: 'w' },
      ],
      clients: [client()],
    })

    const s = moveClients(walled, 100)
    expect(s.clients).toHaveLength(0)
    expect(s.today.clientsLost).toBe(1)
    expect(s.reputation).toBeLessThan(50)
    expect(s.satisfaction).toBeLessThan(50)
  })

  it('re-routes those behind when the queue shortens', () => {
    // c1/c2 land on the same rounded tile for this desk (adjacent queue rows
    // are closer together than a tile), so use a third client one row further
    // back, where the tile the fanned-out spot rounds to genuinely differs.
    let s = gym({
      clients: [
        client({ uid: 'c1', phase: 'queue' }),
        client({ uid: 'c2', phase: 'queue' }),
        client({ uid: 'c3', phase: 'queue' }),
      ],
    })
    for (let i = 0; i < 60; i++) s = moveClients(s, 500)
    const before = s.clients.find(c => c.uid === 'c3')!.goal

    s = scanClient(s, 'c1')
    s = moveClients(s, 16)
    const after = s.clients.find(c => c.uid === 'c3')!.goal

    expect(after).not.toEqual(before)
  })
})
