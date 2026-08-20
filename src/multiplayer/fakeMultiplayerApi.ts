import { MultiplayerError, type MultiplayerErrorCode } from './errors'
import type {
  AllianceSummary,
  EntityId,
  FriendGymSnapshot,
  FriendSummary,
  IdempotencyKey,
  IncomingAllianceInvitation,
  IncomingFriendRequest,
  Loan,
  LoanStatus,
  MultiplayerApi,
  MultiplayerOverview,
  OutgoingFriendRequest,
  PlayerId,
  PlayerProfile,
  PlayerSummary,
  ProposeLoanCommand,
  RepayLoanCommand,
  RespondLoanCommand,
  SabotageCommand,
  SabotageEvent,
  TransferCommand,
  TransferReceipt,
} from './types'
import {
  SABOTAGE_COST,
  normalizePlayerNickname,
  normalizePlayerQuery,
  requireIdempotencyKey,
  requirePlayerId,
  requirePositiveInteger,
  requireTransferAsset,
} from './validation'

interface FakePlayerState {
  profile: PlayerSummary
  cash: number
  diamonds: number
  revision: number
  gameDay: number
  gym: FriendGymSnapshot
}

export interface FakePlayerSeed {
  profile: PlayerSummary
  cash?: number
  diamonds?: number
  revision?: number
  gameDay?: number
  gym?: Omit<FriendGymSnapshot, 'owner'>
}

export interface FakeFriendRequestSeed {
  id?: EntityId
  senderId: PlayerId
  recipientId: PlayerId
  createdAt?: string
}

export interface FakeAllianceInvitationSeed {
  id?: EntityId
  senderId: PlayerId
  recipientId: PlayerId
  createdAt?: string
}

export interface FakeLoanSeed {
  id?: EntityId
  lenderId: PlayerId
  borrowerId: PlayerId
  amount: number
  repaidAmount?: number
  status?: LoanStatus
  createdAt?: string
}

export interface FakeSabotageSeed {
  id?: EntityId
  attackerId: PlayerId
  targetId: PlayerId
  targetGameDay: number
  status?: 'pending' | 'applied'
  createdAt?: string
}

export interface FakeMultiplayerSeed {
  currentUserId: PlayerId
  players: FakePlayerSeed[]
  friendships?: ReadonlyArray<readonly [PlayerId, PlayerId]>
  alliances?: ReadonlyArray<readonly [PlayerId, PlayerId]>
  friendRequests?: FakeFriendRequestSeed[]
  allianceInvitations?: FakeAllianceInvitationSeed[]
  loans?: FakeLoanSeed[]
  sabotageEvents?: FakeSabotageSeed[]
  now?: () => Date
}

interface StoredFriendRequest {
  id: EntityId
  senderId: PlayerId
  recipientId: PlayerId
  createdAt: string
  status: 'pending' | 'accepted' | 'declined'
}

interface StoredAllianceInvitation {
  id: EntityId
  senderId: PlayerId
  recipientId: PlayerId
  createdAt: string
  status: 'pending' | 'accepted' | 'declined' | 'cancelled'
}

interface StoredAlliance extends AllianceSummary {
  leftId: PlayerId
  rightId: PlayerId
  active: boolean
}

interface StoredLoan {
  id: EntityId
  lenderId: PlayerId
  borrowerId: PlayerId
  amount: number
  repaidAmount: number
  status: LoanStatus
  createdAt: string
}

interface StoredSabotage {
  id: EntityId
  attackerId: PlayerId
  targetId: PlayerId
  targetGameDay: number
  status: 'pending' | 'applied'
  createdAt: string
}

interface StoredOperation {
  operation: string
  fingerprint: string
  result: unknown
}

export interface FakeBalanceSnapshot {
  cash: number
  diamonds: number
  revision: number
  gameDay: number
}

const copy = <T>(value: T): T => structuredClone(value)

const emptyGym = (owner: PlayerSummary): FriendGymSnapshot => ({
  owner,
  level: 1,
  reputation: 50,
  satisfaction: 50,
  activeFloor: 0,
  floors: [{ index: 0, expansion: 0, machines: [], decor: [], walls: [] }],
})

function pair(left: PlayerId, right: PlayerId): string {
  return left < right ? `${left}\u0000${right}` : `${right}\u0000${left}`
}

function fail(code: MultiplayerErrorCode): never {
  throw new MultiplayerError(code)
}

/**
 * Deterministic, React-free implementation of the complete multiplayer port.
 * It validates before mutating and caches successful retryable operations,
 * mirroring the transaction/idempotency guarantees of the Postgres RPCs.
 */
export class FakeMultiplayerApi implements MultiplayerApi {
  private readonly currentUserId: PlayerId
  private readonly players = new Map<PlayerId, FakePlayerState>()
  private readonly friendships = new Map<string, string>()
  private readonly alliances = new Map<string, StoredAlliance>()
  private readonly friendRequests: StoredFriendRequest[] = []
  private readonly allianceInvitations: StoredAllianceInvitation[] = []
  private readonly loans: StoredLoan[] = []
  private readonly sabotageEvents: StoredSabotage[] = []
  private readonly operations = new Map<IdempotencyKey, StoredOperation>()
  private readonly now: () => Date
  private sequence = 0

  constructor(seed: FakeMultiplayerSeed) {
    this.currentUserId = requirePlayerId(seed.currentUserId)
    this.now = seed.now ?? (() => new Date())

    for (const item of seed.players) {
      if (this.players.has(item.profile.id)) fail('MP_PLAYER_NOT_FOUND')
      const owner = copy(item.profile)
      const gym: FriendGymSnapshot = item.gym
        ? { ...copy(item.gym), owner }
        : emptyGym(owner)
      this.players.set(owner.id, {
        profile: owner,
        cash: item.cash ?? 0,
        diamonds: item.diamonds ?? 0,
        revision: item.revision ?? 1,
        gameDay: item.gameDay ?? 1,
        gym,
      })
    }
    this.player(this.currentUserId)

    for (const [left, right] of seed.friendships ?? []) {
      this.assertDifferentPlayers(left, right)
      this.player(left)
      this.player(right)
      this.friendships.set(pair(left, right), this.timestamp())
    }
    for (const [left, right] of seed.alliances ?? []) {
      this.assertDifferentPlayers(left, right)
      if (!this.friendships.has(pair(left, right))) fail('MP_ALLIANCE_REQUIRES_FRIEND')
      this.alliances.set(pair(left, right), {
        id: this.id('alliance'),
        leftId: left,
        rightId: right,
        active: true,
        createdAt: this.timestamp(),
      })
    }
    for (const request of seed.friendRequests ?? []) {
      this.friendRequests.push({
        id: request.id ?? this.id('friend-request'),
        senderId: request.senderId,
        recipientId: request.recipientId,
        createdAt: request.createdAt ?? this.timestamp(),
        status: 'pending',
      })
    }
    for (const invitation of seed.allianceInvitations ?? []) {
      this.allianceInvitations.push({
        id: invitation.id ?? this.id('alliance-invitation'),
        senderId: invitation.senderId,
        recipientId: invitation.recipientId,
        createdAt: invitation.createdAt ?? this.timestamp(),
        status: 'pending',
      })
    }
    for (const loan of seed.loans ?? []) {
      requirePositiveInteger(loan.amount)
      const repaidAmount = loan.repaidAmount ?? 0
      if (!Number.isSafeInteger(repaidAmount) || repaidAmount < 0 || repaidAmount > loan.amount) {
        fail('MP_INVALID_AMOUNT')
      }
      this.loans.push({
        id: loan.id ?? this.id('loan'),
        lenderId: loan.lenderId,
        borrowerId: loan.borrowerId,
        amount: loan.amount,
        repaidAmount,
        status: loan.status ?? 'proposed',
        createdAt: loan.createdAt ?? this.timestamp(),
      })
    }
    for (const event of seed.sabotageEvents ?? []) {
      this.sabotageEvents.push({
        id: event.id ?? this.id('sabotage'),
        attackerId: event.attackerId,
        targetId: event.targetId,
        targetGameDay: event.targetGameDay,
        status: event.status ?? 'pending',
        createdAt: event.createdAt ?? this.timestamp(),
      })
    }
  }

  async getPlayerProfile(): Promise<PlayerProfile> {
    const nickname = this.player(this.currentUserId).profile.username.trim()
    return { nickname: nickname || null }
  }

  async setPlayerNickname(rawNickname: string): Promise<PlayerProfile> {
    const current = this.player(this.currentUserId)
    if (current.profile.username.trim()) fail('MP_NICKNAME_ALREADY_SET')
    const nickname = normalizePlayerNickname(rawNickname)
    const taken = [...this.players.values()].some(player => (
      player.profile.id !== this.currentUserId &&
      player.profile.username.trim() !== '' &&
      player.profile.username.localeCompare(nickname, undefined, { sensitivity: 'accent' }) === 0
    ))
    if (taken) fail('MP_NICKNAME_TAKEN')
    current.profile.username = nickname
    current.gym.owner = copy(current.profile)
    return { nickname }
  }

  async searchPlayers(rawQuery: string): Promise<PlayerSummary[]> {
    const query = normalizePlayerQuery(rawQuery)
    return [...this.players.values()]
      .filter(player => player.profile.id !== this.currentUserId)
      .filter(player => player.profile.username.trim() !== '')
      .filter(player => player.profile.username.toLocaleLowerCase('pl-PL').startsWith(query))
      .sort((left, right) => left.profile.username.localeCompare(right.profile.username, 'pl'))
      .slice(0, 20)
      .map(player => copy(player.profile))
  }

  async getOverview(): Promise<MultiplayerOverview> {
    const me = copy(this.player(this.currentUserId).profile)
    const incomingFriendRequests: IncomingFriendRequest[] = this.friendRequests
      .filter(request => request.status === 'pending' && request.recipientId === this.currentUserId)
      .map(request => ({
        id: request.id,
        sender: copy(this.player(request.senderId).profile),
        createdAt: request.createdAt,
      }))
    const outgoingFriendRequests: OutgoingFriendRequest[] = this.friendRequests
      .filter(request => request.status === 'pending' && request.senderId === this.currentUserId)
      .map(request => ({
        id: request.id,
        recipient: copy(this.player(request.recipientId).profile),
        createdAt: request.createdAt,
      }))
    const incomingAllianceInvitations: IncomingAllianceInvitation[] = this.allianceInvitations
      .filter(invitation => (
        invitation.status === 'pending' && invitation.recipientId === this.currentUserId
      ))
      .map(invitation => ({
        id: invitation.id,
        sender: copy(this.player(invitation.senderId).profile),
        createdAt: invitation.createdAt,
      }))
    const friends: FriendSummary[] = [...this.friendships.entries()]
      .filter(([key]) => key.split('\u0000').includes(this.currentUserId))
      .map(([key, friendsSince]) => {
        const [left, right] = key.split('\u0000') as [PlayerId, PlayerId]
        const friendId = left === this.currentUserId ? right : left
        const alliance = this.alliances.get(key)
        return {
          profile: copy(this.player(friendId).profile),
          friendsSince,
          alliance: alliance?.active
            ? { id: alliance.id, createdAt: alliance.createdAt }
            : null,
        }
      })
      .sort((left, right) => left.profile.username.localeCompare(right.profile.username, 'pl'))

    return {
      me,
      incomingFriendRequests,
      outgoingFriendRequests,
      incomingAllianceInvitations,
      friends,
      loans: this.loans
        .filter(loan => (
          (loan.lenderId === this.currentUserId || loan.borrowerId === this.currentUserId)
          && (loan.status === 'proposed' || loan.status === 'active')
        ))
        .map(loan => this.publicLoan(loan)),
    }
  }

  async sendFriendRequest(recipientId: PlayerId): Promise<void> {
    recipientId = requirePlayerId(recipientId)
    this.assertDifferentPlayers(this.currentUserId, recipientId)
    this.player(recipientId)
    if (this.areFriends(this.currentUserId, recipientId)) fail('MP_ALREADY_FRIENDS')
    if (this.friendRequests.some(request => (
      request.status === 'pending'
      && pair(request.senderId, request.recipientId) === pair(this.currentUserId, recipientId)
    ))) fail('MP_FRIEND_REQUEST_EXISTS')
    this.friendRequests.push({
      id: this.id('friend-request'),
      senderId: this.currentUserId,
      recipientId,
      createdAt: this.timestamp(),
      status: 'pending',
    })
  }

  async respondFriendRequest(requestId: EntityId, accept: boolean): Promise<void> {
    const request = this.friendRequests.find(item => (
      item.id === requestId && item.recipientId === this.currentUserId
    ))
    if (!request) fail('MP_FRIEND_REQUEST_NOT_FOUND')
    if (request.status !== 'pending') fail('MP_REQUEST_ALREADY_RESOLVED')
    request.status = accept ? 'accepted' : 'declined'
    if (accept) {
      this.friendships.set(pair(request.senderId, request.recipientId), this.timestamp())
    }
  }

  async removeFriend(friendId: PlayerId): Promise<void> {
    this.assertDifferentPlayers(this.currentUserId, friendId)
    const key = pair(this.currentUserId, friendId)
    if (!this.friendships.delete(key)) fail('MP_NOT_FRIENDS')
    const alliance = this.alliances.get(key)
    if (alliance) alliance.active = false
    for (const invitation of this.allianceInvitations) {
      if (invitation.status === 'pending' && pair(invitation.senderId, invitation.recipientId) === key) {
        invitation.status = 'cancelled'
      }
    }
  }

  async getFriendGym(friendId: PlayerId): Promise<FriendGymSnapshot> {
    this.assertDifferentPlayers(this.currentUserId, friendId)
    if (!this.areFriends(this.currentUserId, friendId)) fail('MP_FRIEND_GYM_FORBIDDEN')
    return copy(this.player(friendId).gym)
  }

  async sendAllianceInvitation(recipientId: PlayerId): Promise<void> {
    this.assertDifferentPlayers(this.currentUserId, recipientId)
    this.player(recipientId)
    if (!this.areFriends(this.currentUserId, recipientId)) fail('MP_ALLIANCE_REQUIRES_FRIEND')
    if (this.areAllies(this.currentUserId, recipientId)) fail('MP_ALLIANCE_EXISTS')
    const key = pair(this.currentUserId, recipientId)
    if (this.allianceInvitations.some(invitation => (
      invitation.status === 'pending' && pair(invitation.senderId, invitation.recipientId) === key
    ))) fail('MP_ALLIANCE_INVITATION_EXISTS')
    this.allianceInvitations.push({
      id: this.id('alliance-invitation'),
      senderId: this.currentUserId,
      recipientId,
      createdAt: this.timestamp(),
      status: 'pending',
    })
  }

  async respondAllianceInvitation(invitationId: EntityId, accept: boolean): Promise<void> {
    const invitation = this.allianceInvitations.find(item => (
      item.id === invitationId && item.recipientId === this.currentUserId
    ))
    if (!invitation) fail('MP_ALLIANCE_INVITATION_NOT_FOUND')
    if (invitation.status !== 'pending') fail('MP_REQUEST_ALREADY_RESOLVED')
    if (accept) {
      if (!this.areFriends(invitation.senderId, invitation.recipientId)) {
        fail('MP_ALLIANCE_REQUIRES_FRIEND')
      }
      if (this.areAllies(invitation.senderId, invitation.recipientId)) fail('MP_ALLIANCE_EXISTS')
      const key = pair(invitation.senderId, invitation.recipientId)
      this.alliances.set(key, {
        id: this.id('alliance'),
        leftId: invitation.senderId,
        rightId: invitation.recipientId,
        createdAt: this.timestamp(),
        active: true,
      })
    }
    invitation.status = accept ? 'accepted' : 'declined'
  }

  async endAlliance(allyId: PlayerId): Promise<void> {
    this.assertDifferentPlayers(this.currentUserId, allyId)
    const alliance = this.alliances.get(pair(this.currentUserId, allyId))
    if (!alliance?.active) fail('MP_ALLIANCE_NOT_FOUND')
    alliance.active = false
  }

  async getNormalIncomeMultiplier(): Promise<1 | 1.5> {
    return [...this.alliances.values()].some(alliance => (
      alliance.active
      && (alliance.leftId === this.currentUserId || alliance.rightId === this.currentUserId)
    )) ? 1.5 : 1
  }

  async transfer(command: TransferCommand): Promise<TransferReceipt> {
    const recipientId = requirePlayerId(command.recipientId)
    const asset = requireTransferAsset(command.asset)
    const amount = requirePositiveInteger(command.amount)
    this.assertDifferentPlayers(this.currentUserId, recipientId)
    this.player(recipientId)
    return this.once(command.idempotencyKey, 'transfer', { recipientId, asset, amount }, () => {
      if (!this.areAllies(this.currentUserId, recipientId)) fail('MP_TRANSFER_REQUIRES_ALLIANCE')
      const sender = this.player(this.currentUserId)
      const recipient = this.player(recipientId)
      if (sender[asset] < amount) fail('MP_INSUFFICIENT_BALANCE')
      sender[asset] -= amount
      recipient[asset] += amount
      sender.revision += 1
      recipient.revision += 1
      return {
        id: this.id('transfer'),
        senderId: this.currentUserId,
        recipientId,
        asset,
        amount,
        createdAt: this.timestamp(),
      }
    })
  }

  async proposeLoan(command: ProposeLoanCommand): Promise<Loan> {
    const borrowerId = requirePlayerId(command.borrowerId)
    const amount = requirePositiveInteger(command.amount)
    this.assertDifferentPlayers(this.currentUserId, borrowerId)
    this.player(borrowerId)
    return this.once(command.idempotencyKey, 'propose-loan', { borrowerId, amount }, () => {
      if (!this.areAllies(this.currentUserId, borrowerId)) fail('MP_LOAN_REQUIRES_ALLIANCE')
      const loan: StoredLoan = {
        id: this.id('loan'),
        lenderId: this.currentUserId,
        borrowerId,
        amount,
        repaidAmount: 0,
        status: 'proposed',
        createdAt: this.timestamp(),
      }
      this.loans.push(loan)
      return this.publicLoan(loan)
    })
  }

  async respondLoan(command: RespondLoanCommand): Promise<Loan> {
    return this.once(
      command.idempotencyKey,
      'respond-loan',
      { loanId: command.loanId, accept: command.accept },
      () => {
        const loan = this.loans.find(item => item.id === command.loanId)
        if (!loan || loan.borrowerId !== this.currentUserId) fail('MP_LOAN_NOT_FOUND')
        if (loan.status !== 'proposed') fail('MP_LOAN_NOT_PROPOSED')
        if (!command.accept) {
          loan.status = 'rejected'
          return this.publicLoan(loan)
        }
        if (!this.areAllies(loan.lenderId, loan.borrowerId)) fail('MP_LOAN_REQUIRES_ALLIANCE')
        const lender = this.player(loan.lenderId)
        const borrower = this.player(loan.borrowerId)
        if (lender.cash < loan.amount) fail('MP_LENDER_INSUFFICIENT_BALANCE')
        lender.cash -= loan.amount
        borrower.cash += loan.amount
        lender.revision += 1
        borrower.revision += 1
        loan.status = 'active'
        return this.publicLoan(loan)
      },
    )
  }

  async repayLoan(command: RepayLoanCommand): Promise<Loan> {
    const amount = requirePositiveInteger(command.amount)
    return this.once(command.idempotencyKey, 'repay-loan', { loanId: command.loanId, amount }, () => {
      const loan = this.loans.find(item => item.id === command.loanId)
      if (!loan || loan.borrowerId !== this.currentUserId) fail('MP_LOAN_NOT_FOUND')
      if (loan.status !== 'active') fail('MP_LOAN_NOT_ACTIVE')
      if (amount > loan.amount - loan.repaidAmount) fail('MP_REPAYMENT_TOO_HIGH')
      const borrower = this.player(loan.borrowerId)
      const lender = this.player(loan.lenderId)
      if (borrower.cash < amount) fail('MP_INSUFFICIENT_BALANCE')
      borrower.cash -= amount
      lender.cash += amount
      borrower.revision += 1
      lender.revision += 1
      loan.repaidAmount += amount
      if (loan.repaidAmount === loan.amount) loan.status = 'repaid'
      return this.publicLoan(loan)
    })
  }

  async sabotage(command: SabotageCommand): Promise<SabotageEvent> {
    const targetId = requirePlayerId(command.targetId)
    this.assertDifferentPlayers(this.currentUserId, targetId)
    this.player(targetId)
    return this.once(command.idempotencyKey, 'sabotage', { targetId }, () => {
      if (!this.areFriends(this.currentUserId, targetId)) fail('MP_SABOTAGE_REQUIRES_FRIEND')
      if (this.areAllies(this.currentUserId, targetId)) fail('MP_CANNOT_SABOTAGE_ALLY')
      const targetDay = this.player(targetId).gameDay
      if (this.sabotageEvents.some(event => (
        event.targetId === targetId && event.targetGameDay === targetDay
      ))) fail('MP_SABOTAGE_DAILY_LIMIT')
      const attacker = this.player(this.currentUserId)
      if (attacker.cash < SABOTAGE_COST) fail('MP_INSUFFICIENT_BALANCE')
      const stored: StoredSabotage = {
        id: this.id('sabotage'),
        attackerId: this.currentUserId,
        targetId,
        targetGameDay: targetDay,
        status: 'pending',
        createdAt: this.timestamp(),
      }
      attacker.cash -= SABOTAGE_COST
      attacker.revision += 1
      this.sabotageEvents.push(stored)
      return this.publicSabotage(stored)
    })
  }

  async getPendingSabotages(): Promise<SabotageEvent[]> {
    return this.sabotageEvents
      .filter(event => event.targetId === this.currentUserId && event.status === 'pending')
      .map(event => this.publicSabotage(event))
  }

  async acknowledgeSabotage(eventId: EntityId): Promise<void> {
    const event = this.sabotageEvents.find(item => (
      item.id === eventId && item.targetId === this.currentUserId
    ))
    if (!event) fail('MP_SABOTAGE_NOT_FOUND')
    event.status = 'applied'
  }

  /** Inspection seam for tests; not part of the production transport port. */
  balanceForTests(playerId: PlayerId): FakeBalanceSnapshot {
    const player = this.player(playerId)
    return {
      cash: player.cash,
      diamonds: player.diamonds,
      revision: player.revision,
      gameDay: player.gameDay,
    }
  }

  /** Lets a test model the target advancing to another game day. */
  setGameDayForTests(playerId: PlayerId, gameDay: number): void {
    this.player(playerId).gameDay = requirePositiveInteger(gameDay)
  }

  private player(id: PlayerId): FakePlayerState {
    const player = this.players.get(id)
    if (!player) fail('MP_PLAYER_NOT_FOUND')
    return player
  }

  private assertDifferentPlayers(left: PlayerId, right: PlayerId): void {
    if (left === right) fail('MP_CANNOT_TARGET_SELF')
  }

  private areFriends(left: PlayerId, right: PlayerId): boolean {
    return this.friendships.has(pair(left, right))
  }

  private areAllies(left: PlayerId, right: PlayerId): boolean {
    return this.alliances.get(pair(left, right))?.active === true
  }

  private publicLoan(loan: StoredLoan): Loan {
    return {
      id: loan.id,
      lender: copy(this.player(loan.lenderId).profile),
      borrower: copy(this.player(loan.borrowerId).profile),
      amount: loan.amount,
      repaidAmount: loan.repaidAmount,
      status: loan.status,
      createdAt: loan.createdAt,
    }
  }

  private publicSabotage(event: StoredSabotage): SabotageEvent {
    return {
      id: event.id,
      attacker: copy(this.player(event.attackerId).profile),
      targetGameDay: event.targetGameDay,
      createdAt: event.createdAt,
    }
  }

  private once<T>(
    rawKey: IdempotencyKey,
    operation: string,
    request: object,
    execute: () => T,
  ): T {
    const key = requireIdempotencyKey(rawKey)
    const fingerprint = JSON.stringify(request)
    const previous = this.operations.get(key)
    if (previous) {
      if (previous.operation !== operation || previous.fingerprint !== fingerprint) {
        fail('MP_IDEMPOTENCY_CONFLICT')
      }
      return copy(previous.result as T)
    }
    const result = execute()
    this.operations.set(key, { operation, fingerprint, result: copy(result) })
    return copy(result)
  }

  private id(kind: string): EntityId {
    this.sequence += 1
    return `${kind}-${this.sequence}`
  }

  private timestamp(): string {
    return this.now().toISOString()
  }
}
