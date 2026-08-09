import type { Point, Tile } from './layout'
import type { UpgradeId } from './content/upgrades'
import type { SupplierMachineTypeId } from './content/suppliers'
import type { MarketingState } from './marketing'
import type { ContractState } from './contracts'
import type { SponsorState } from './sponsors'

/** The six the gym opened with. Available without signing anything. */
export type BaseMachineTypeId =
  | 'dumbbells' | 'bench' | 'treadmill' | 'latpulldown' | 'bike' | 'cable'

/**
 * Every machine in the game. The second half of the union is owned by
 * `content/suppliers.ts`, so adding a supplier's kit widens this type without
 * anyone editing this file — see the note there.
 */
export type MachineTypeId = BaseMachineTypeId | SupplierMachineTypeId

export interface MachineType {
  id: MachineTypeId
  // The display name lives in `src/i18n`, keyed by this id — the shop and the
  // tags in the room have to agree on it, and both follow the chosen language.
  price: number
  powerPerDay: number   // dollars per game day while owned
  workoutMs: number     // game ms a client spends on it
  satisfaction: number  // 0-100 contribution per completed workout
  wearPerUse: number    // durability lost per completed workout
  repairCost: number
  minLevel: number
  xpPerUse: number
  /**
   * Machines never pay out on their own — they scale what a visit is worth.
   * Better kit means a pricier door fee and, through the gym class, pricier
   * passes. This is the only lever that grows revenue.
   */
  revenueMultiplier: number
}

/** Quarter turns clockwise. Everything on the grid snaps to these four. */
export type Rotation = 0 | 1 | 2 | 3

export interface Machine {
  uid: string
  type: MachineTypeId
  x: number
  y: number
  rotation: Rotation
  durability: number        // 0-100; 0 means out of service
  occupiedBy: string | null // client uid
  /**
   * How long it has stood out of service. Buys the player a grace window
   * before the wreck starts costing reputation, and resets itself the moment
   * the machine works again — no caller has to remember to clear it.
   */
  brokenMs: number
}

export type DecorTypeId = 'plant' | 'reception' | 'locker' | 'watercooler'

/**
 * Furniture that earns nothing. It still occupies a tile, so the player trades
 * floor space for the look of the place.
 */
export interface Decor {
  uid: string
  type: DecorTypeId
  x: number
  y: number
  rotation: Rotation
}

/**
 * Walls sit on tile edges rather than in tiles, so a partition costs no floor
 * space. Only north and west edges are ever stored — the south edge of a tile
 * is the north edge of its neighbour, and one name per edge means a wall can
 * never be built twice in the same place.
 */
export type WallSide = 'n' | 'w'

export interface Wall {
  uid: string
  x: number
  y: number
  side: WallSide
}

/** Owned but not placed. Machines keep their wear while boxed up. */
export type InventoryItem =
  | { uid: string; kind: 'machine'; type: MachineTypeId; durability: number }
  | { uid: string; kind: 'decor'; type: DecorTypeId }
  | { uid: string; kind: 'wall' }

export type ClientPhase =
  | 'arriving'   // from the door to a place in the queue
  | 'queue'      // waiting to be scanned; patience runs only here
  | 'toMachine'  // scanned and paid, walking to the reserved machine
  | 'workout'    // training
  | 'leaving'    // heading back to the door, then gone

/**
 * Members queue and get scanned exactly like walk-ins — the pass buys them a
 * discount at the door, not a way around it.
 */
export type ClientKind = 'walkin' | 'member'

/**
 * How much of a catch a client is. Stacks on top of the machine's own
 * multiplier, so a lucky influencer on top-tier kit is worth a small fortune.
 */
export type ClientRarity = 'common' | 'rare' | 'epic' | 'legend' | 'influencer' | 'secret'

export interface Client extends Walker {
  uid: string
  kind: ClientKind
  rarity: ClientRarity
  phase: ClientPhase
  phaseMs: number        // ms elapsed in the current phase
  machineUid: string | null
  /** Set for members so a visit can be traced back to the pass holder. */
  memberUid: string | null
  /**
   * Employee booked to coach this visit, set at the desk in exchange for a
   * `TRAINER_FEE_MULT` door fee. Doubles as the trainer's booking: an employee
   * is free exactly when no client names them here, so the booking lives in
   * one place rather than on both sides. Cleared when the client leaves.
   */
  trainerUid: string | null
  /** Named one-off visitors whose rules differ from the normal rarity table. */
  special?: 'lil-d'
}

export interface Member {
  uid: string
  /** Day the pass was bought; renewals fall every 7 days from here. */
  joinedDay: number
}

/** Running totals for the day in progress, reset by `nextDay`. */
export interface DayLedger {
  entryFees: number
  subscriptions: number
  signups: number
  clientsServed: number
  clientsLost: number
  /**
   * The trainer's share of the door fees, counted separately so the receipt
   * can show what booking trainers actually earned. Already included in
   * `entryFees` — this is a breakdown, not extra income.
   */
  trainerFees: number
  /** Cash lost at the desk to banknotes that only looked real. */
  counterfeitLoss: number
  /** Paid out to advertising by `settleMarketing`. */
  marketingSpend: number
  /** Paid out to equipment suppliers by `settleContracts`. */
  contractFees: number
  /** Taken in from sponsorship deals by `settleSponsors`. */
  sponsorIncome: number
}

/** The receipt shown at 20:00. Written once by `closeDay`. */
export interface DayReport {
  day: number
  entryFees: number
  /** Part of `entryFees` that personal-trainer bookings brought in. */
  trainerFees: number
  subscriptions: number
  counterfeitLoss: number
  /** The three v2 lines. Zero means the feature did nothing today, and the
   * receipt leaves the row out rather than printing a nought. */
  marketingSpend: number
  contractFees: number
  sponsorIncome: number
  signups: number
  churn: number
  rent: number
  power: number
  memberUpkeep: number
  wages: number
  bill: number
  net: number
  cashBefore: number
  cashAfter: number
  clientsServed: number
  clientsLost: number
}

export interface GameStats {
  totalEarned: number
  totalSpent: number
  clientsServed: number
  clientsLost: number
  membersJoined: number
  membersLost: number
}

/**
 * The pieces of the simulation that physically belong to one storey. The
 * currently visited floor is mirrored in GameState's top-level fields so the
 * existing engine can keep operating on one room without knowing about the
 * inactive ones.
 */
export interface FloorPlan {
  expansion: number
  machines: Machine[]
  decor: Decor[]
  walls: Wall[]
  stains: Stain[]
  clients: Client[]
}

export interface GameState {
  version: number
  cash: number
  reputation: number    // 0-100
  satisfaction: number  // 0-100
  level: number
  xp: number
  machines: Machine[]
  decor: Decor[]
  walls: Wall[]
  inventory: InventoryItem[]
  clients: Client[]
  members: Member[]
  staff: Staff[]
  stains: Stain[]
  candidates: Candidate[]
  /** Day the pool was drawn for; keeps a stale pool from surviving the night. */
  candidatesDay: number
  /**
   * How many rungs of each upgrade track the player has bought. Only the count
   * is stored — `content/upgrades.ts` is the sole authority on what a rung is
   * worth, so rebalancing the ladder needs no save migration and leaves no
   * stale numbers behind in anybody's gym.
   */
  upgrades: Record<UpgradeId, number>
  /**
   * The three v2 systems, each a sealed sub-state owned by one module. They
   * are deliberately opaque here: a feature that needs to remember one more
   * thing grows its own interface, and this file — which every branch would
   * otherwise be editing at once — stays still.
   */
  marketing: MarketingState
  contracts: ContractState
  sponsors: SponsorState
  seed: number
  /**
   * How many floor expansions the player has bought — an index into
   * `EXPANSIONS`, which is what actually decides the size of the room. 0 is
   * the gym everyone starts with.
   */
  expansion: number
  /** Zero is the ground floor; upper storeys are numbered from one. */
  activeFloor: number
  /** One plan per unlocked storey, including a snapshot of the active one. */
  floorPlans: FloorPlan[]
  /** 1-based. The player advances it by hand; nothing else may. */
  day: number
  /**
   * Position inside the day, 0…DAY_MS. Maps to a clock between 8:00 and 20:00.
   * It stops at DAY_MS: past closing the gym stops admitting anyone, but the
   * simulation keeps running so the player can rebuild in peace and shut up
   * shop when they are ready.
   */
  dayMs: number
  /**
   * Set by `closeDay`, which only ever runs on the player's own say-so. Freezes
   * the whole simulation until `nextDay`.
   */
  dayEnded: boolean
  today: DayLedger
  /** The last closed day's receipt, or null before the first close. */
  dayReport: DayReport | null
  /** Day on which LIL D. last spawned; keeps the secret to one visit per day. */
  lilDSeenDay: number
  elapsedMs: number
  lastSeenAt: number    // epoch ms, written by the store, never by the engine
  gameOver: boolean
  stats: GameStats
  nextUid: number
}

/**
 * Everything that walks the floor. Position is in world units rather than
 * tiles because a walker spends most of its life between two of them.
 */
export interface Walker extends Point {
  /** Tiles still to cross; the head is the next step. Empty means standing. */
  path: Tile[]
  /** Where this walker is ultimately headed, so a changed room can re-route it. */
  goal: Tile | null
}

export type StaffRole = 'reception' | 'cleaner' | 'repair' | 'trainer'
export type StaffRank = 'rare' | 'epic' | 'legend'

export interface Staff extends Walker {
  uid: string
  name: string
  role: StaffRole
  rank: StaffRank
  /** uid of a stain, a machine, a desk or a client — whichever the role works on. */
  targetUid: string | null
  /** ms already spent working at the target. */
  workMs: number
  /** Unpaid wage. Anything above zero means this one is on strike. */
  owed: number
}

/** Left behind by a finished workout. Drags reputation down until wiped. */
export interface Stain {
  uid: string
  x: number
  y: number
  ageMs: number
}

/** An entry in the hiring pool. Not an employee yet. */
export interface Candidate {
  uid: string
  name: string
  role: StaffRole
  rank: StaffRank
  /** One-time cost to bring them onto the payroll. */
  price: number
}
