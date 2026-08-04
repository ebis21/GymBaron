import { describe, it, expect } from 'vitest'
import { serialize, deserialize } from './save'
import { initialState } from './economy'
import { SAVE_VERSION } from './constants'

describe('save round-trip', () => {
  it('restores an identical state', () => {
    const s = initialState(3, 1000)
    expect(deserialize(serialize(s), 1000)).toEqual(s)
  })
  it('falls back to a fresh state on garbage', () => {
    expect(deserialize('not json', 0).version).toBe(SAVE_VERSION)
  })
  it('falls back to a fresh state on a future version', () => {
    expect(deserialize(JSON.stringify({ ...initialState(3, 0), version: 999 }), 0).version).toBe(SAVE_VERSION)
  })
  it('falls back to a fresh state when required fields are missing', () => {
    expect(deserialize(JSON.stringify({ version: SAVE_VERSION }), 0).cash).toBe(initialState(0, 0).cash)
  })
})

describe('migration to version 4', () => {
  it('loads a version 3 save instead of discarding it', () => {
    const v3 = JSON.stringify({
      ...initialState(7, 0),
      version: 3,
      cash: 4321,
      day: 9,
      staff: undefined,
      stains: undefined,
      candidates: undefined,
      candidatesDay: undefined,
    })

    const loaded = deserialize(v3, 0)

    expect(loaded.cash).toBe(4321)
    expect(loaded.day).toBe(9)
    expect(loaded.version).toBe(4)
  })

  it('gives a migrated save empty staff, stains and candidates', () => {
    const v3 = JSON.stringify({ ...initialState(7, 0), version: 3 })
    const loaded = deserialize(v3, 0)

    expect(loaded.staff).toEqual([])
    expect(loaded.stains).toEqual([])
    expect(loaded.candidates).toEqual([])
    expect(loaded.candidatesDay).toBe(0)
  })

  it('parks migrated clients at the door with no path', () => {
    const v3 = JSON.stringify({
      ...initialState(7, 0),
      version: 3,
      clients: [{
        uid: 'c1', kind: 'walkin', rarity: 'common',
        phase: 'queue', phaseMs: 0, machineUid: null, memberUid: null,
      }],
    })

    const loaded = deserialize(v3, 0)

    expect(loaded.clients).toHaveLength(1)
    expect(loaded.clients[0]!.path).toEqual([])
    expect(loaded.clients[0]!.goal).toBeNull()
    expect(typeof loaded.clients[0]!.x).toBe('number')
  })

  it('still returns a fresh state for junk', () => {
    expect(deserialize('not json', 0).cash).toBe(500)
  })
})
