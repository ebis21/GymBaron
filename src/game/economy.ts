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
 * Six puts the ceiling at ×7 and, more to the point, makes the curve flat
 * where it used to be steepest. It came down from eight when `equipmentDraw`
 * arrived: a big floor now earns by pulling a bigger crowd through the door,
 * so letting it *also* keep charging every pass holder more would be paying
 * the player twice for the same thirty machines.
 */
const GYM_CLASS_CEILING = 6

/**
 * What the kit on the floor is worth above bare boards, summed across every
 * storey. Shared by `gymClass` and `equipmentDraw` because both answer a
 * question about the same thing — how good the gym is — and reading it twice
 * from one place is what keeps them from drifting apart.
 *
 * Machines bought through a supplier contract count exactly like the starting
 * six. `machineType` resolves both from one table, so a floor of Apex kit is
 * simply a floor with a very high total.
 */
function equipmentWorth(state: GameState): number {
  return machinesAcrossFloors(state).reduce(
    (acc, m) => acc + (machineType(m.type).revenueMultiplier - 1),
    0,
  )
}

/**
 * Every machine contributes what it is worth above bare floor, on a curve with
 * diminishing returns: a 1.4 gym that buys a 1.2 machine still gets better,
 * but a floor that is already excellent gains little from one more bench.
 * Adding kit can never make the gym worse, which is what a player expects
 * from a purchase.
 */
export function gymClass(state: GameState): number {
  // Saturating rather than a straight sum. Still monotonic — a purchase can
  // never lower the class — but the twentieth machine adds a fraction of what
  // the second did, so the class settles instead of climbing forever.
  const raw = equipmentWorth(state)
  return 1 + (raw * GYM_CLASS_CEILING) / (raw + GYM_CLASS_CEILING)
}

/**
 * How much more the ceiling of a fully kitted gym pulls in than an empty one,
 * and how much equipment it takes to get halfway there.
 *
 * These two numbers are the whole answer to the complaint that thirty top-end
 * machines earned barely more than six cheap ones. Footfall used to be a
 * function of reputation alone, so the only thing a bigger, better floor
 * bought was a shorter queue — the kit had nowhere to send its takings.
 *
 * `DRAW_HALF` is set well above what a starting hall can hold so the curve is
 * still climbing through the whole mid-game, and `DRAW_CEILING` deliberately
 * stops at +1.6. Advertising multiplies on top of this, and the two together
 * have to leave a mega-gym's queue servable: past roughly ×2.5 the door
 * outruns what any payroll can scan and the surplus turns into walkouts.
 */
const DRAW_CEILING = 1.6
const DRAW_HALF = 9

/**
 * How much the kit on the floor multiplies walk-in arrivals: 1 in an empty
 * hall, rising toward `1 + DRAW_CEILING` as the gym fills with better
 * equipment. A reputation for a well-equipped gym is what actually brings
 * people in — reputation still sets the base rate, this scales it.
 *
 * Same saturating shape as `gymClass`, on the same underlying total, so it is
 * monotonic for the same reason: buying a machine can never thin the crowd.
 */
export function equipmentDraw(state: GameState): number {
  const raw = equipmentWorth(state)
  return 1 + (raw * DRAW_CEILING) / (raw + DRAW_HALF)
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
