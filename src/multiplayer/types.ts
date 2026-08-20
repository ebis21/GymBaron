export type PlayerId = string
export type EntityId = string
export type IdempotencyKey = string
export type TransferAsset = 'cash' | 'diamonds'

export interface PlayerSummary {
  id: PlayerId
  username: string
}

export interface PlayerProfile {
  /** Null until the one-time nickname onboarding has been completed. */
  nickname: string | null
}

export interface IncomingFriendRequest {
  id: EntityId
  sender: PlayerSummary
  createdAt: string
}

export interface OutgoingFriendRequest {
  id: EntityId
  recipient: PlayerSummary
  createdAt: string
}

export interface AllianceSummary {
  id: EntityId
  createdAt: string
}

export interface FriendSummary {
  profile: PlayerSummary
  friendsSince: string
  alliance: AllianceSummary | null
}

export interface IncomingAllianceInvitation {
  id: EntityId
  sender: PlayerSummary
  createdAt: string
}

export type LoanStatus = 'proposed' | 'active' | 'repaid' | 'rejected' | 'cancelled'

export interface Loan {
  id: EntityId
  lender: PlayerSummary
  borrower: PlayerSummary
  amount: number
  repaidAmount: number
  status: LoanStatus
  createdAt: string
}

export interface MultiplayerOverview {
  me: PlayerSummary
  incomingFriendRequests: IncomingFriendRequest[]
  outgoingFriendRequests: OutgoingFriendRequest[]
  incomingAllianceInvitations: IncomingAllianceInvitation[]
  friends: FriendSummary[]
  loans: Loan[]
}

export type FriendMachineType =
  | 'dumbbells'
  | 'bench'
  | 'treadmill'
  | 'latpulldown'
  | 'bike'
  | 'cable'

export interface FriendMachine {
  uid: string
  type: FriendMachineType
  x: number
  y: number
  rotation: 0 | 1 | 2 | 3
  durability: number
}

export type FriendDecorType = 'plant' | 'reception' | 'locker' | 'watercooler'

export interface FriendDecor {
  uid: string
  type: FriendDecorType
  x: number
  y: number
  rotation: 0 | 1 | 2 | 3
}

export interface FriendWall {
  uid: string
  x: number
  y: number
  side: 'n' | 'w'
}

export interface FriendFloorSnapshot {
  index: number
  expansion: number
  machines: FriendMachine[]
  decor: FriendDecor[]
  walls: FriendWall[]
}

/**
 * The deliberately small read model returned for another player. Wallet,
 * inventory, clients, staff, statistics and simulation internals cannot be
 * represented here and must never be added by a transport adapter.
 */
export interface FriendGymSnapshot {
  owner: PlayerSummary
  level: number
  reputation: number
  satisfaction: number
  activeFloor: number
  floors: FriendFloorSnapshot[]
}

export interface TransferCommand {
  recipientId: PlayerId
  asset: TransferAsset
  amount: number
  idempotencyKey: IdempotencyKey
}

export interface TransferReceipt {
  id: EntityId
  senderId: PlayerId
  recipientId: PlayerId
  asset: TransferAsset
  amount: number
  createdAt: string
}

export interface ProposeLoanCommand {
  borrowerId: PlayerId
  amount: number
  idempotencyKey: IdempotencyKey
}

export interface RespondLoanCommand {
  loanId: EntityId
  accept: boolean
  idempotencyKey: IdempotencyKey
}

export interface RepayLoanCommand {
  loanId: EntityId
  amount: number
  idempotencyKey: IdempotencyKey
}

export interface SabotageCommand {
  targetId: PlayerId
  idempotencyKey: IdempotencyKey
}

export interface SabotageEvent {
  id: EntityId
  attacker: PlayerSummary
  targetGameDay: number
  createdAt: string
}

export interface MultiplayerApi {
  getPlayerProfile(): Promise<PlayerProfile>
  setPlayerNickname(nickname: string): Promise<PlayerProfile>

  searchPlayers(query: string): Promise<PlayerSummary[]>
  getOverview(): Promise<MultiplayerOverview>

  sendFriendRequest(recipientId: PlayerId): Promise<void>
  respondFriendRequest(requestId: EntityId, accept: boolean): Promise<void>
  removeFriend(friendId: PlayerId): Promise<void>

  getFriendGym(friendId: PlayerId): Promise<FriendGymSnapshot>

  sendAllianceInvitation(recipientId: PlayerId): Promise<void>
  respondAllianceInvitation(invitationId: EntityId, accept: boolean): Promise<void>
  endAlliance(allyId: PlayerId): Promise<void>
  getNormalIncomeMultiplier(): Promise<1 | 1.5>

  transfer(command: TransferCommand): Promise<TransferReceipt>
  proposeLoan(command: ProposeLoanCommand): Promise<Loan>
  respondLoan(command: RespondLoanCommand): Promise<Loan>
  repayLoan(command: RepayLoanCommand): Promise<Loan>

  sabotage(command: SabotageCommand): Promise<SabotageEvent>
  getPendingSabotages(): Promise<SabotageEvent[]>
  acknowledgeSabotage(eventId: EntityId): Promise<void>
}
