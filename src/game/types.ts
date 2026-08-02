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

export interface Machine {
  uid: string
  type: MachineTypeId
  x: number
  y: number
  durability: number        // 0-100; 0 means out of service
  occupiedBy: string | null // client uid
}

export type ClientPhase = 'queue' | 'workout'

/**
 * Members queue and get scanned exactly like walk-ins — the pass buys them a
 * 90% discount at the door, not a way around it.
 */
export type ClientKind = 'walkin' | 'member'

export interface Client {
  uid: string
  kind: ClientKind
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
  clients: Client[]
  members: Member[]
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
