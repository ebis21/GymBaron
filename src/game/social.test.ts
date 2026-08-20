import { describe, expect, it } from 'vitest'
import { initialState } from './economy'
import { applySabotageDelivery, setAllianceIncomeMultiplier } from './social'
import type { Client, GameState } from './types'

const base = (): GameState => initialState(77, 0)

const lilD = (): Client => ({
  uid: 'c-existing',
  kind: 'walkin',
  rarity: 'secret',
  special: 'lil-d',
  phase: 'arriving',
  phaseMs: 0,
  machineUid: null,
  memberUid: null,
  trainerUid: null,
  x: 0,
  z: 0,
  path: [],
  goal: null,
})

describe('alliance income state', () => {
  it('stores the server-confirmed multiplier for live and offline simulation', () => {
    const state = base()
    expect(setAllianceIncomeMultiplier(state, 1.5).allianceIncomeMultiplier).toBe(1.5)
    expect(setAllianceIncomeMultiplier(state, 1)).toBe(state)
  })
})

describe('queued sabotage delivery', () => {
  it('summons LIL D. and records the event before acknowledgement', () => {
    const result = applySabotageDelivery(base(), 'event-1')

    expect(result.shouldAcknowledge).toBe(true)
    expect(result.state.clients.some(client => client.special === 'lil-d')).toBe(true)
    expect(result.state.appliedSabotageIds).toEqual(['event-1'])
  })

  it('retries acknowledgement without summoning twice after a crash', () => {
    const first = applySabotageDelivery(base(), 'event-1')
    const retry = applySabotageDelivery(first.state, 'event-1')

    expect(retry.shouldAcknowledge).toBe(true)
    expect(retry.state).toBe(first.state)
    expect(retry.state.clients.filter(client => client.special === 'lil-d')).toHaveLength(1)
  })

  it('leaves an event pending while another LIL D. is already inside', () => {
    const occupied = { ...base(), clients: [lilD()] }
    const result = applySabotageDelivery(occupied, 'event-2')

    expect(result.shouldAcknowledge).toBe(false)
    expect(result.state).toBe(occupied)
  })
})
