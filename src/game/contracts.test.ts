import { describe, it, expect } from 'vitest'
import {
  applyContracts,
  availableMachines,
  initialContracts,
  machineUnlocked,
  normalizeContracts,
  settleContracts,
  signed,
} from './contracts'
import { initialState } from './economy'
import { useGameStore } from '../store/gameStore'
import { BASE_MACHINE_TYPES } from './content/machines'
import { supplier } from './content/suppliers'
import type { GameState } from './types'

const FERRUM = supplier('ferrum')
const APEX = supplier('apex')

/** A gym rich enough and senior enough to sign whatever the test is about. */
const ready = (patch: Partial<GameState> = {}): GameState => ({
  ...initialState(1, 0),
  cash: 500_000,
  level: 20,
  ...patch,
})

const sign = (state: GameState, id: 'ferrum' | 'apex') =>
  applyContracts(state, { type: 'sign', supplier: id })

describe('signing a contract', () => {
  it('sells nothing but the starting six until one is signed', () => {
    expect(availableMachines(ready())).toEqual(BASE_MACHINE_TYPES.map(m => m.id))
  })

  it('opens the supplier catalogue', () => {
    const state = sign(ready(), 'ferrum')
    for (const machine of FERRUM.catalogue) {
      expect(machineUnlocked(state, machine.id)).toBe(true)
    }
  })

  it('leaves the starting six on sale', () => {
    const state = sign(ready(), 'ferrum')
    for (const machine of BASE_MACHINE_TYPES) {
      expect(machineUnlocked(state, machine.id)).toBe(true)
    }
  })

  it('charges the signing fee and books it as spend', () => {
    const before = ready({ cash: 50_000 })
    const after = sign(before, 'ferrum')
    expect(after.cash).toBe(50_000 - FERRUM.signingFee)
    expect(after.stats.totalSpent).toBe(before.stats.totalSpent + FERRUM.signingFee)
  })

  it('refuses a fee the gym cannot cover', () => {
    const broke = ready({ cash: FERRUM.signingFee - 1 })
    expect(sign(broke, 'ferrum')).toBe(broke)
  })

  it('refuses a supplier that does not deal at this level', () => {
    const junior = ready({ level: FERRUM.minLevel - 1 })
    expect(sign(junior, 'ferrum')).toBe(junior)
  })

  it('refuses a supplier whose prerequisite is unsigned', () => {
    const state = ready()
    expect(sign(state, 'apex')).toBe(state)
  })

  it('deals once the prerequisite is in place', () => {
    const state = sign(sign(ready(), 'ferrum'), 'apex')
    expect(signed(state, 'apex')).toBe(true)
  })

  it('refuses to sign the same contract twice', () => {
    const once = sign(ready(), 'ferrum')
    expect(sign(once, 'ferrum')).toBe(once)
  })
})

describe('holding a contract', () => {
  it('charges the daily fee at the close of every day', () => {
    const state = sign(ready(), 'ferrum')
    const settled = settleContracts(state)

    expect(settled.cash).toBe(state.cash - FERRUM.dailyFee)
    expect(settled.today.contractFees).toBe(FERRUM.dailyFee)
    expect(settled.stats.totalSpent).toBe(state.stats.totalSpent + FERRUM.dailyFee)
  })

  it('bills every contract the gym holds', () => {
    const both = sign(sign(ready(), 'ferrum'), 'apex')
    expect(settleContracts(both).today.contractFees).toBe(FERRUM.dailyFee + APEX.dailyFee)
  })

  it('charges an unsigned gym nothing at all', () => {
    const state = ready()
    expect(settleContracts(state)).toBe(state)
  })
})

describe('ending a contract', () => {
  const drop = (state: GameState, id: 'ferrum' | 'apex') =>
    applyContracts(state, { type: 'cancel', supplier: id })

  it('stops the daily fee', () => {
    const dropped = drop(sign(ready(), 'ferrum'), 'ferrum')
    expect(settleContracts(dropped)).toBe(dropped)
  })

  it('closes the catalogue to further buying', () => {
    const dropped = drop(sign(ready(), 'ferrum'), 'ferrum')
    expect(machineUnlocked(dropped, 'ferrum-cable')).toBe(false)
  })

  /**
   * The promise the whole feature turns on: a contract adds, it never takes
   * away. Kit the player has paid for is theirs, on the floor, earning, long
   * after the deal that let them buy it has lapsed.
   */
  it('leaves kit already bought standing on the floor', () => {
    const withKit = sign(ready(), 'ferrum')
    const owning: GameState = {
      ...withKit,
      machines: [
        {
          uid: 'm1',
          type: 'ferrum-cable',
          x: 2,
          y: 2,
          rotation: 0,
          durability: 100,
          occupiedBy: null,
          brokenMs: 0,
        },
      ],
    }

    expect(drop(owning, 'ferrum').machines).toEqual(owning.machines)
  })

  it('drops a contract that was never signed without charging for the privilege', () => {
    const state = ready()
    expect(drop(state, 'ferrum')).toBe(state)
  })

  it('lets the player sign again, at the full fee', () => {
    const again = sign(drop(sign(ready({ cash: 100_000 }), 'ferrum'), 'ferrum'), 'ferrum')
    expect(signed(again, 'ferrum')).toBe(true)
    expect(again.cash).toBe(100_000 - FERRUM.signingFee * 2)
  })
})

describe('stored contracts', () => {
  it('starts a new gym with none', () => {
    expect(signed({ ...ready(), contracts: initialContracts() }, 'ferrum')).toBe(false)
  })

  it('makes something usable out of anything at all', () => {
    for (const raw of [undefined, null, 42, 'nonsense', { junk: true }, { signed: 'no' }]) {
      expect(() => normalizeContracts(raw)).not.toThrow()
      expect(normalizeContracts(raw)).toEqual(initialContracts())
    }
  })

  it('keeps contracts a stored save really had', () => {
    const stored = sign(ready(), 'ferrum').contracts
    expect(normalizeContracts(stored)).toEqual(stored)
  })

  it('discards a supplier that no longer exists', () => {
    expect(normalizeContracts({ signed: ['ferrum', 'gone'] })).toEqual({ signed: ['ferrum'] })
  })
})

/**
 * The shop only shows what a signed contract unlocks, but the shop is a view.
 * The store is where a purchase is actually decided, and a gate that lives
 * only in the view is not a gate — the dev panel, a stale render or a future
 * second entry point all walk straight past it.
 */
describe('buying locked kit', () => {
  const armed = (patch: Partial<GameState> = {}) => {
    useGameStore.setState({ state: ready(patch) })
    return useGameStore.getState()
  }

  it('refuses kit behind a contract the gym has not signed', () => {
    armed().buyMachine('apex-rig')
    expect(useGameStore.getState().state.inventory).toHaveLength(0)
  })

  it('takes no money for the sale it refused', () => {
    armed({ cash: 500_000 }).buyMachine('apex-rig')
    expect(useGameStore.getState().state.cash).toBe(500_000)
  })

  it('sells the same kit once the contract is signed', () => {
    armed({ contracts: { signed: ['ferrum', 'apex'] } }).buyMachine('apex-rig')
    expect(useGameStore.getState().state.inventory).toHaveLength(1)
  })

  it('still sells the starting six to a gym with no contracts at all', () => {
    armed().buyMachine('dumbbells')
    expect(useGameStore.getState().state.inventory).toHaveLength(1)
  })
})
