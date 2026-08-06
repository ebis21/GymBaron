import type { ClientKind, ClientRarity, DayLedger, GameState, MachineTypeId } from './types'
import { machineType } from './content/machines'
import { RARITY_MULTIPLIER } from './content/rarity'
import {
  DAILY_RENT,
  ENTRY_FEE_BASE,
  MEMBER_DISCOUNT,
  MEMBER_FEE,
  MEMBER_UPKEEP,
  REP_REVENUE_BONUS,
  START_CASH,
  TRAINER_FEE_MULT,
  XP_PER_LEVEL,
  SAVE_VERSION,
} from './constants'

export const emptyLedger = (): DayLedger => ({
  entryFees: 0,
  subscriptions: 0,
  counterfeitLoss: 0,
  signups: 0,
  clientsServed: 0,
  clientsLost: 0,
  trainerFees: 0,
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
      // One row down from the corner on purpose: the attendant stands on the
      // tile *behind* the desk, and at y=0 facing north that tile is off the
      // grid — the receptionist could never reach their own counter.
      { uid: 'd-reception', type: 'reception', x: 0, y: 1, rotation: 0 },
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
    expansion: 0,
    day: 1,
    dayMs: 0,
    dayEnded: false,
    today: emptyLedger(),
    dayReport: null,
    lilDSeenDay: 0,
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
 * How much the gym's standing is worth at the till: 1.0 at reputation 0, up to
 * `1 + REP_REVENUE_BONUS` at 100. Deliberately gentle — reputation already
 * decides how many people walk through the door, and letting it set the price
 * too would make it the only stat that matters.
 */
export function reputationBonus(reputation: number): number {
  const rep = Math.max(0, Math.min(100, reputation))
  return 1 + (rep / 100) * REP_REVENUE_BONUS
}

/**
 * What one visit costs at the door. The machine the client is put on decides
 * the multiplier, which is why the fee is charged at scan time rather than on
 * arrival — that is the moment the assignment is known.
 *
 * `reputation` and `withTrainer` default to the neutral case so the fee of a
 * plain visit at an unknown gym is still a two-line call.
 */
export function entryFee(
  typeId: MachineTypeId,
  kind: ClientKind,
  rarity: ClientRarity,
  reputation = 0,
  withTrainer = false,
): number {
  const base = ENTRY_FEE_BASE * machineType(typeId).revenueMultiplier * RARITY_MULTIPLIER[rarity]
  const discounted = kind === 'member' ? base * MEMBER_DISCOUNT : base
  const coached = withTrainer ? discounted * TRAINER_FEE_MULT : discounted
  return coached * reputationBonus(reputation)
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
