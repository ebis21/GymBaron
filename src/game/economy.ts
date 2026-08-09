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
import { machinesAcrossFloors } from './floors'
import { emptyUpgrades } from './content/upgrades'
import { initialMarketing } from './marketing'
import { initialContracts } from './contracts'
import { initialSponsors } from './sponsors'

export const emptyLedger = (): DayLedger => ({
  entryFees: 0,
  subscriptions: 0,
  counterfeitLoss: 0,
  signups: 0,
  clientsServed: 0,
  clientsLost: 0,
  trainerFees: 0,
  marketingSpend: 0,
  contractFees: 0,
  sponsorIncome: 0,
})

export function initialState(seed: number, now: number): GameState {
  const decor: GameState['decor'] = [
    // One row down from the corner on purpose: the attendant stands on the
    // tile *behind* the desk, and at y=0 facing north that tile is off the
    // grid — the receptionist could never reach their own counter.
    { uid: 'd-reception', type: 'reception', x: 0, y: 1, rotation: 0 },
    { uid: 'd-plant-a', type: 'plant', x: 7, y: 0, rotation: 0 },
    { uid: 'd-plant-b', type: 'plant', x: 7, y: 5, rotation: 0 },
    { uid: 'd-plant-c', type: 'plant', x: 0, y: 5, rotation: 0 },
  ]

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
    decor,
    walls: [],
    inventory: [],
    clients: [],
    members: [],
    staff: [],
    stains: [],
    candidates: [],
    candidatesDay: 0,
    upgrades: emptyUpgrades(),
    // Each v2 system seeds its own sub-state. This file never learns what is
    // inside one, which is what keeps three branches out of each other's way.
    marketing: initialMarketing(),
    contracts: initialContracts(),
    sponsors: initialSponsors(),
    seed,
    expansion: 0,
    activeFloor: 0,
    floorPlans: [{ expansion: 0, machines: [], decor, walls: [], stains: [], clients: [] }],
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
 * How far the class can ever climb above bare floor. The old class was a plain
 * sum of every machine's bonus, with nothing stopping it: a fifty-machine gym
 * scored ×20, every pass in the building was priced off that, and since passes
 * paid for more machines the whole economy compounded on itself. Membership
 * income outran rent, power and wages by an order of magnitude within a week.
 *
 * Eight puts the ceiling at ×9 and, more to the point, makes the curve flat
 * where it used to be steepest.
 */
const GYM_CLASS_CEILING = 8

/**
 * Every machine contributes what it is worth above bare floor, on a curve with
 * diminishing returns: a 1.4 gym that buys a 1.2 machine still gets better,
 * but a floor that is already excellent gains little from one more bench.
 * Adding kit can never make the gym worse, which is what a player expects
 * from a purchase.
 */
export function gymClass(state: GameState): number {
  const raw = machinesAcrossFloors(state).reduce(
    (acc, m) => acc + (machineType(m.type).revenueMultiplier - 1),
    0,
  )
  // Saturating rather than a straight sum. Still monotonic — a purchase can
  // never lower the class — but the twentieth machine adds a fraction of what
  // the second did, so the class settles instead of climbing forever.
  return 1 + (raw * GYM_CLASS_CEILING) / (raw + GYM_CLASS_CEILING)
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
 * `reputation`, `withTrainer` and `earnings` all default to the neutral case so
 * the fee of a plain visit at an unknown gym is still a two-line call.
 *
 * `earnings` is the player's own upgrade track. It lands last, on top of
 * everything else, and touches only the door — a pass is priced by the gym
 * class alone and never sees this multiplier.
 */
export function entryFee(
  typeId: MachineTypeId,
  kind: ClientKind,
  rarity: ClientRarity,
  reputation = 0,
  withTrainer = false,
  earnings = 1,
): number {
  const base = ENTRY_FEE_BASE * machineType(typeId).revenueMultiplier * RARITY_MULTIPLIER[rarity]
  const discounted = kind === 'member' ? base * MEMBER_DISCOUNT : base
  const coached = withTrainer ? discounted * TRAINER_FEE_MULT : discounted
  return coached * reputationBonus(reputation) * earnings
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
  const power = machinesAcrossFloors(state)
    .reduce((sum, m) => sum + machineType(m.type).powerPerDay, 0)
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
