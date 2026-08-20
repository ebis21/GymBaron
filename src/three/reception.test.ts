import { describe, expect, it } from 'vitest'
import { initialState } from '../game/economy'
import { tileToWorld } from '../game/layout'
import type { Client, Decor, GameState, Staff } from '../game/types'
import { clientQueueFacing, receptionistFacing } from './actors'
import { frontClientAtReception, receptionAtPoint } from './scene'

const desk = (uid: string, x: number, rotation: Decor['rotation'] = 0): Decor => ({
  uid, type: 'reception', x, y: 1, rotation,
})

const client = (uid: string, receptionUid: string | null): Client => ({
  uid, receptionUid, kind: 'walkin', rarity: 'common', phase: 'queue', phaseMs: 0,
  machineUid: null, memberUid: null, trainerUid: null,
  x: 0, z: 0, path: [], goal: null,
})

const receptionist = (targetUid: string): Staff => ({
  uid: 'e1', name: 'Marta K.', role: 'reception', rank: 'rare', targetUid,
  workMs: 0, owed: 0, x: 0, z: 0, path: [], goal: null,
})

const gym = (over: Partial<GameState> = {}): GameState => ({
  ...initialState(7, 0),
  decor: [desk('d1', 1), desk('d2', 6, 1)],
  ...over,
})

describe('multi-reception presentation', () => {
  it('orients a queued client and receptionist toward their own rotated desk', () => {
    const state = gym()

    expect(clientQueueFacing(state, client('c2', 'd2'))).toBeCloseTo(3 * Math.PI / 2)
    expect(receptionistFacing(state, receptionist('d2'))).toBeCloseTo(Math.PI / 2)
  })

  it('detects the second placed reception when the player stands beside it', () => {
    const state = gym()
    const second = tileToWorld(6, 1)

    expect(receptionAtPoint(state, second)?.uid).toBe('d2')
    expect(receptionAtPoint(state, { x: 100, z: 100 })).toBeNull()
  })

  it('selects the front visitor from the local desk queue', () => {
    const state = gym({
      clients: [client('first-desk', 'd1'), client('second-desk', 'd2')],
    })

    expect(frontClientAtReception(state, 'd2')?.uid).toBe('second-desk')
  })

  it('keeps legacy unassigned visitors at the deterministic first reception', () => {
    const state = gym({ clients: [client('legacy', null)] })

    expect(frontClientAtReception(state, 'd1')?.uid).toBe('legacy')
    expect(frontClientAtReception(state, 'd2')).toBeNull()
  })
})
