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
    // Migrations chain, so a v3 save arrives at the current version rather
    // than stopping at the one that first understood it.
    expect(loaded.version).toBe(SAVE_VERSION)
  })

  it('gives a migrated save empty staff, stains and candidates', () => {
    const v3 = JSON.stringify({ ...initialState(7, 0), version: 3 })
    const loaded = deserialize(v3, 0)

    expect(loaded.staff).toEqual([])
    expect(loaded.stains).toEqual([])
    expect(loaded.candidates).toEqual([])
    expect(loaded.candidatesDay).toBe(0)
  })

  it('gives migrated machines a broken-for clock', () => {
    const v3 = JSON.stringify({
      ...initialState(7, 0),
      version: 3,
      machines: [{
        uid: 'm1', type: 'dumbbells', x: 4, y: 2,
        rotation: 0, durability: 0, occupiedBy: null,
      }],
    })

    expect(deserialize(v3, 0).machines[0]!.brokenMs).toBe(0)
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

  it('rejects a v4-labelled save that is missing the v4 fields as corrupt', () => {
    const corrupt = JSON.stringify({
      ...initialState(7, 0),
      version: SAVE_VERSION,
      cash: 4321,
      staff: undefined,
      stains: undefined,
      candidates: undefined,
      candidatesDay: undefined,
    })

    const loaded = deserialize(corrupt, 0)

    expect(loaded.cash).toBe(500)
    expect(loaded.staff).toEqual([])
  })
})

describe('migration to version 7', () => {
  it('wraps a version 6 room in the ground-floor plan', () => {
    const current = initialState(12, 0)
    const v6 = JSON.stringify({
      ...current,
      version: 6,
      activeFloor: undefined,
      floorPlans: undefined,
      cash: 123_456,
      expansion: 2,
    })

    const loaded = deserialize(v6, 0)

    expect(loaded.version).toBe(SAVE_VERSION)
    expect(loaded.cash).toBe(123_456)
    expect(loaded.activeFloor).toBe(0)
    expect(loaded.floorPlans).toHaveLength(1)
    expect(loaded.floorPlans[0]!.expansion).toBe(2)
    expect(loaded.floorPlans[0]!.decor).toEqual(loaded.decor)
  })

  it('rejects a version 7 save with an invalid active floor', () => {
    const corrupt = JSON.stringify({ ...initialState(4, 0), activeFloor: 99 })
    const loaded = deserialize(corrupt, 0)

    expect(loaded.activeFloor).toBe(0)
    expect(loaded.cash).toBe(500)
  })
})

describe('migration to version 8', () => {
  it('loads a version 7 save with every track unbought', () => {
    const { upgrades: _dropped, ...v7 } = initialState(7, 0)
    const raw = JSON.stringify({ ...v7, version: 7, cash: 8765, day: 12 })

    const loaded = deserialize(raw, 0)

    expect(loaded.version).toBe(SAVE_VERSION)
    expect(loaded.cash).toBe(8765)
    expect(loaded.day).toBe(12)
    expect(loaded.upgrades).toEqual({
      cleaning: 0,
      repair: 0,
      earnings: 0,
      luck: 0,
      patience: 0,
    })
  })

  it('keeps levels a version 8 save already carries', () => {
    const bought = { ...initialState(7, 0), upgrades: { cleaning: 3, repair: 1, earnings: 5, luck: 2, patience: 4 } }
    expect(deserialize(serialize(bought), 0).upgrades).toEqual(bought.upgrades)
  })

  it('rejects a version 8 save whose tracks are missing or malformed', () => {
    const fresh = initialState(0, 0)

    for (const upgrades of [undefined, null, {}, { cleaning: 1 }, { cleaning: 1.5, repair: 0, earnings: 0, luck: 0, patience: 0 }, { cleaning: -1, repair: 0, earnings: 0, luck: 0, patience: 0 }]) {
      const raw = JSON.stringify({ ...initialState(7, 0), version: SAVE_VERSION, cash: 999, upgrades })
      // Corrupt, not old — a fresh gym beats handing undefined to the economy.
      expect(deserialize(raw, 0).cash).toBe(fresh.cash)
    }
  })
})
