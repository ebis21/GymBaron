import type { Point, Tile } from './layout'

export type MachineTypeId =
  | 'dumbbells' | 'bench' | 'treadmill' | 'latpulldown' | 'bike' | 'cable'

export interface MachineType {
  id: MachineTypeId
  name: string          // Polish, shown in the shop
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
 * 90% discount at the door, not a way around it.
 */
export type ClientKind = 'walkin' | 'member'

/**
 * How much of a catch a client is. Stacks on top of the machine's own
 * multiplier, so a lucky influencer on top-tier kit is worth a small fortune.
 */
export type ClientRarity = 'common' | 'rare' | 'epic' | 'legend' | 'influencer'

export interface Client extends Walker {
  uid: string
  kind: ClientKind
  rarity: ClientRarity
  phase: ClientPhase
  phaseMs: number        // ms elapsed in the current phase
  machineUid: string | null
  /** Set for members so a visit can be traced back to the pass holder. */
  memberUid: string | null
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
}

/** The receipt shown at 20:00. Written once by `closeDay`. */
export interface DayReport {
  day: number
  entryFees: number
  subscriptions: number
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
  seed: number
  /** 1-based. The player advances it by hand; nothing else may. */
  day: number
  /** Position inside the day, 0…DAY_MS. Maps to a clock between 8:00 and 20:00. */
  dayMs: number
  /** True at 20:00. Freezes the whole simulation until `nextDay`. */
  dayEnded: boolean
  today: DayLedger
  /** The last closed day's receipt, or null before the first close. */
  dayReport: DayReport | null
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

export type StaffRole = 'reception' | 'cleaner' | 'repair'
export type StaffRank = 'rare' | 'epic' | 'legend'

export interface Staff extends Walker {
  uid: string
  name: string
  role: StaffRole
  rank: StaffRank
  /** uid of a stain, a machine or a client — whichever the role works on. */
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
