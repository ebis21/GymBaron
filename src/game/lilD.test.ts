import { describe, expect, it } from 'vitest'
import { advanceClients, scanClient, spawnLilD, summonLilD } from './clients'
import { closeDay } from './dayClose'
import { initialState } from './economy'
import { DAY_MS, LIL_D_EXTRA_WORKOUT_MS, LIL_D_FAKE_PAYMENT } from './constants'
import { machineType } from './content/machines'
import { deserialize } from './save'
import type { Client, GameState, Machine } from './types'

const machine = (over: Partial<Machine> = {}): Machine => ({
  uid: 'm1',
  type: 'dumbbells',
  x: 2,
  y: 2,
  rotation: 0,
  durability: 100,
  occupiedBy: null,
  brokenMs: 0,
  ...over,
})

function lilD(over: Partial<Client> = {}): Client {
  return {
    uid: 'c99',
    kind: 'walkin',
    rarity: 'secret',
    special: 'lil-d',
    phase: 'queue',
    phaseMs: 0,
    machineUid: null,
    memberUid: null,
    trainerUid: null,
    x: 0,
    z: 0,
    path: [],
    goal: null,
    ...over,
  }
}

const gym = (): GameState => ({ ...initialState(7, 0), machines: [machine()] })

describe('LIL D. secret visitor', () => {
  it('migrates old saves with neutral secret-visitor bookkeeping', () => {
    const legacy = initialState(7, 0) as unknown as Record<string, unknown>
    legacy.version = 5
    delete legacy.lilDSeenDay
    delete (legacy.today as Record<string, unknown>).counterfeitLoss

    const loaded = deserialize(JSON.stringify(legacy), 0)
    expect(loaded.version).toBe(6)
    expect(loaded.lilDSeenDay).toBe(0)
    expect(loaded.today.counterfeitLoss).toBe(0)
  })

  it('spawns with his nickname marker and SECRET rarity', () => {
    const state = summonLilD(gym())
    expect(state.clients).toHaveLength(1)
    expect(state.clients[0]).toMatchObject({ rarity: 'secret', special: 'lil-d' })
    expect(state.lilDSeenDay).toBe(state.day)
  })

  it('can only appear once during a business day', () => {
    const seen: GameState = { ...summonLilD(gym()), clients: [] }
    let state = seen
    for (let i = 0; i < 1_000; i += 1) state = spawnLilD(state, 1_000)
    expect(state.clients).toEqual([])
  })

  it('takes 300 credits at scan time and records counterfeit cash', () => {
    const before: GameState = { ...gym(), clients: [lilD()] }
    const after = scanClient(before, 'c99')

    expect(after.cash).toBe(before.cash - LIL_D_FAKE_PAYMENT)
    expect(after.today.entryFees).toBe(0)
    expect(after.today.counterfeitLoss).toBe(LIL_D_FAKE_PAYMENT)
    expect(after.stats.totalSpent).toBe(LIL_D_FAKE_PAYMENT)
    expect(after.clients[0]!.phase).toBe('toMachine')
  })

  it('trains three seconds longer and breaks the machine after one use', () => {
    const workoutMs = machineType('dumbbells').workoutMs
    let state: GameState = {
      ...gym(),
      machines: [machine({ occupiedBy: 'c99' })],
      clients: [lilD({ phase: 'workout', machineUid: 'm1' })],
    }

    state = advanceClients(state, workoutMs + LIL_D_EXTRA_WORKOUT_MS - 1)
    expect(state.clients[0]!.phase).toBe('workout')
    expect(state.machines[0]!.durability).toBe(100)

    state = advanceClients(state, 1)
    expect(state.clients[0]!.phase).toBe('leaving')
    expect(state.machines[0]!.durability).toBe(0)
    expect(state.machines[0]!.occupiedBy).toBeNull()
  })

  it('shows the full loss in the day report balance', () => {
    const state: GameState = {
      ...gym(),
      cash: gym().cash - LIL_D_FAKE_PAYMENT,
      dayMs: DAY_MS,
      today: { ...gym().today, counterfeitLoss: LIL_D_FAKE_PAYMENT },
    }
    const report = closeDay(state).dayReport!

    expect(report.counterfeitLoss).toBe(LIL_D_FAKE_PAYMENT)
    expect(report.net).toBe(-LIL_D_FAKE_PAYMENT - report.bill - report.wages)
  })
})
