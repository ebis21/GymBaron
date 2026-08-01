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

export interface Client {
  uid: string
  phase: ClientPhase
  phaseMs: number        // ms elapsed in the current phase
  machineUid: string | null
}

export interface GameStats {
  totalEarned: number
  totalSpent: number
  clientsServed: number
  clientsLost: number
  daysPassed: number
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
  seed: number
  elapsedMs: number
  lastSeenAt: number    // epoch ms, written by the store, never by the engine
  gameOver: boolean
  stats: GameStats
  nextUid: number
}
