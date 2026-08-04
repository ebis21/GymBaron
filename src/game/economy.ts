import type { ClientKind, ClientRarity, DayLedger, GameState, MachineTypeId } from './types'
import { machineType } from './content/machines'
import { RARITY_MULTIPLIER } from './content/rarity'
import {
  DAILY_RENT,
  ENTRY_FEE_BASE,
  MEMBER_DISCOUNT,
  MEMBER_FEE,
  MEMBER_UPKEEP,
  START_CASH,
  XP_PER_LEVEL,
  SAVE_VERSION,
} from './constants'

export const emptyLedger = (): DayLedger => ({
  entryFees: 0,
  subscriptions: 0,
  signups: 0,
  clientsServed: 0,
  clientsLost: 0,
})

export function initialState(seed: number, now: number): GameState {
  return {
    version: SAVE_VERSION,
    cash: START_CASH,
    reputation: 0,
    satisfaction: 50,
    level: 1,
    xp: 0,
    machines: [],
    // The room starts furnished but nothing is nailed down — every one of
    // these can be turned, shifted, or packed away in build mode.
    decor: [
      { uid: 'd-reception', type: 'reception', x: 0, y: 0, rotation: 0 },
      { uid: 'd-plant-a', type: 'plant', x: 7, y: 0, rotation: 0 },
      { uid: 'd-plant-b', type: 'plant', x: 7, y: 5, rotation: 0 },
      { uid: 'd-plant-c', type: 'plant', x: 0, y: 5, rotation: 0 },
    ],
    walls: [],
    inventory: [],
    clients: [],
    members: [],
    staff: [],
    stains: [],
    candidates: [],
    candidatesDay: 0,
    seed,
    day: 1,
    dayMs: 0,
    dayEnded: false,
    today: emptyLedger(),
    dayReport: null,
    elapsedMs: 0,
    lastSeenAt: now,
    gameOver: false,
    stats: {
      totalEarned: 0,
      totalSpent: 0,
      clientsServed: 0,
      clientsLost: 0,
      membersJoined: 0,
      membersLost: 0,
    },
    nextUid: 1,
  }
}

/**
 * Every machine contributes what it is worth above bare floor, so the class is
 * 1.0 plus the sum of those bonuses: a 1.4 gym that buys a 1.2 machine becomes
 * 1.6. Adding kit can never make the gym worse, which is what a player expects
 * from a purchase.
 */
export function gymClass(state: GameState): number {
  return state.machines.reduce(
    (acc, m) => acc + (machineType(m.type).revenueMultiplier - 1),
    1,
  )
}

/**
 * What one visit costs at the door. The machine the client is put on decides
 * the multiplier, which is why the fee is charged at scan time rather than on
 * arrival — that is the moment the assignment is known.
 */
export function entryFee(typeId: MachineTypeId, kind: ClientKind, rarity: ClientRarity): number {
  const base = ENTRY_FEE_BASE * machineType(typeId).revenueMultiplier * RARITY_MULTIPLIER[rarity]
  return kind === 'member' ? base * MEMBER_DISCOUNT : base
}

/** Face value of a pass at the gym's current class. */
export function passPrice(state: GameState): number {
  return MEMBER_FEE * gymClass(state)
}

export interface DailyCosts {
  rent: number
  power: number
  memberUpkeep: number
  total: number
}

/**
 * The evening bill. It grows with every member — more people through the door
 * means more water, towels and cleaning — and is never capped against income,
 * so a floor bought on the last credit still gets invoiced.
 */
export function dailyCosts(state: GameState): DailyCosts {
  const rent = DAILY_RENT
  const power = state.machines.reduce((sum, m) => sum + machineType(m.type).powerPerDay, 0)
  const memberUpkeep = MEMBER_UPKEEP * state.members.length
  return { rent, power, memberUpkeep, total: rent + power + memberUpkeep }
}

export function addXp(state: GameState, amount: number): GameState {
  let xp = state.xp + amount
  let level = state.level
  while (xp >= XP_PER_LEVEL) {
    xp -= XP_PER_LEVEL
    level += 1
  }
  return { ...state, xp, level }
}
