import { describe, it, expect } from 'vitest'
import { moveClients, queueAnchorFor } from './clientMove'
import { advanceClients, scanClient } from './clients'
import { initialState } from './economy'
import { PATIENCE_MS } from './constants'
import { DOOR_X, queueSpot } from './layout'
import type { Client, GameState, Machine } from './types'

const machine = (over: Partial<Machine> = {}): Machine => ({
  uid: 'm1', type: 'dumbbells', x: 4, y: 2, rotation: 0,
  durability: 100, occupiedBy: null, ...over,
})

const client = (over: Partial<Client> = {}): Client => ({
  uid: 'c1', kind: 'walkin', rarity: 'common',
  phase: 'arriving', phaseMs: 0, machineUid: null, memberUid: null,
  x: DOOR_X, z: 0, path: [], goal: null, ...over,
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

  it('counts an arriving client walled off from the desk as lost', () => {
    const walled = gym({
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
  })

  it('re-routes those behind when the queue shortens', () => {
    let s = gym({
      clients: [
        client({ uid: 'c1', phase: 'queue' }),
        client({ uid: 'c2', phase: 'queue' }),
      ],
    })

    // c2 starts one place back. Once c1 is pulled out of the queue, c2 should
    // shuffle all the way up to the front slot rather than stall at the back
    // one — checking the settled position (not the coarse tile mid-walk,
    // which two adjacent queue slots can legitimately round onto together)
    // is what actually proves the re-route happened.
    s = scanClient(s, 'c1')
    for (let i = 0; i < 200; i++) s = moveClients(s, 500)

    const front = queueSpot(0, queueAnchorFor(s))
    const c2 = s.clients.find(c => c.uid === 'c2')!
    expect(c2.x).toBeCloseTo(front.x, 5)
    expect(c2.z).toBeCloseTo(front.z, 5)
  })
})
