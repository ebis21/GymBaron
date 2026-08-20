import type { SupabaseClient } from '@supabase/supabase-js'
import {
  requireIdempotencyKey,
  requirePlayerId,
  requirePositiveInteger,
  requireTransferAsset,
  normalizePlayerQuery,
} from './validation'
import { MultiplayerError, toMultiplayerError } from './errors'
import type {
  AllianceSummary,
  FriendDecor,
  FriendFloorSnapshot,
  FriendGymSnapshot,
  FriendMachine,
  FriendSummary,
  FriendWall,
  IncomingAllianceInvitation,
  IncomingFriendRequest,
  Loan,
  LoanStatus,
  MultiplayerApi,
  MultiplayerOverview,
  OutgoingFriendRequest,
  PlayerSummary,
  ProposeLoanCommand,
  RepayLoanCommand,
  RespondLoanCommand,
  SabotageCommand,
  SabotageEvent,
  TransferAsset,
  TransferCommand,
  TransferReceipt,
} from './types'

export interface SupabaseMultiplayerHooks {
  /** Flushes and, in the app, briefly pauses simulation before the server lock. */
  beforeWalletMutation?: () => Promise<void> | void
  /** Pulls the authoritative wallet before the next local cloud autosave. */
  afterWalletMutation?: () => Promise<void> | void
  /** Resumes anything paused by `beforeWalletMutation`, including on failure. */
  afterWalletMutationFinished?: () => Promise<void> | void
  /** Refreshes the cached ×1/×1.5 income rule after a relationship changes. */
  afterRelationshipMutation?: () => Promise<void> | void
}

type JsonRecord = Record<string, unknown>

const MACHINE_TYPES = new Set(['dumbbells', 'bench', 'treadmill', 'latpulldown', 'bike', 'cable'])
const DECOR_TYPES = new Set(['plant', 'reception', 'locker', 'watercooler'])
const LOAN_STATUSES = new Set<LoanStatus>(['proposed', 'active', 'repaid', 'rejected', 'cancelled'])

function invalidPayload(label: string): never {
  throw new MultiplayerError('MP_UNKNOWN', new Error(`Invalid ${label} payload`))
}

function record(value: unknown, label: string): JsonRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) invalidPayload(label)
  return value as JsonRecord
}

function list(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) invalidPayload(label)
  return value
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) invalidPayload(label)
  return value
}

function number(value: unknown, label: string): number {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim() !== ''
      ? Number(value)
      : Number.NaN
  if (!Number.isFinite(parsed)) invalidPayload(label)
  return parsed
}

function integer(value: unknown, label: string): number {
  const parsed = number(value, label)
  if (!Number.isSafeInteger(parsed)) invalidPayload(label)
  return parsed
}

function rotation(value: unknown): 0 | 1 | 2 | 3 {
  const parsed = integer(value, 'rotation')
  if (parsed < 0 || parsed > 3) invalidPayload('rotation')
  return parsed as 0 | 1 | 2 | 3
}

function player(value: unknown): PlayerSummary {
  const row = record(value, 'player')
  return { id: text(row.id, 'player.id'), username: text(row.username, 'player.username') }
}

function alliance(value: unknown): AllianceSummary | null {
  if (value === null) return null
  const row = record(value, 'alliance')
  return { id: text(row.id, 'alliance.id'), createdAt: text(row.createdAt, 'alliance.createdAt') }
}

function incomingFriendRequest(value: unknown): IncomingFriendRequest {
  const row = record(value, 'incoming friend request')
  return {
    id: text(row.id, 'friend request.id'),
    sender: player(row.sender),
    createdAt: text(row.createdAt, 'friend request.createdAt'),
  }
}

function outgoingFriendRequest(value: unknown): OutgoingFriendRequest {
  const row = record(value, 'outgoing friend request')
  return {
    id: text(row.id, 'friend request.id'),
    recipient: player(row.recipient),
    createdAt: text(row.createdAt, 'friend request.createdAt'),
  }
}

function allianceInvitation(value: unknown): IncomingAllianceInvitation {
  const row = record(value, 'alliance invitation')
  return {
    id: text(row.id, 'alliance invitation.id'),
    sender: player(row.sender),
    createdAt: text(row.createdAt, 'alliance invitation.createdAt'),
  }
}

function friend(value: unknown): FriendSummary {
  const row = record(value, 'friend')
  return {
    profile: player(row.profile),
    friendsSince: text(row.friendsSince, 'friend.friendsSince'),
    alliance: alliance(row.alliance),
  }
}

function loanStatus(value: unknown): LoanStatus {
  const status = text(value, 'loan.status') as LoanStatus
  if (!LOAN_STATUSES.has(status)) invalidPayload('loan.status')
  return status
}

function overviewLoan(value: unknown): Loan {
  const row = record(value, 'loan')
  return {
    id: text(row.id, 'loan.id'),
    lender: player(row.lender),
    borrower: player(row.borrower),
    amount: integer(row.amount, 'loan.amount'),
    repaidAmount: integer(row.repaidAmount, 'loan.repaidAmount'),
    status: loanStatus(row.status),
    createdAt: text(row.createdAt, 'loan.createdAt'),
  }
}

function overview(value: unknown): MultiplayerOverview {
  const row = record(value, 'overview')
  return {
    me: player(row.me),
    incomingFriendRequests: list(row.incomingFriendRequests, 'incomingFriendRequests')
      .map(incomingFriendRequest),
    outgoingFriendRequests: list(row.outgoingFriendRequests, 'outgoingFriendRequests')
      .map(outgoingFriendRequest),
    incomingAllianceInvitations: list(row.incomingAllianceInvitations, 'incomingAllianceInvitations')
      .map(allianceInvitation),
    friends: list(row.friends, 'friends').map(friend),
    loans: list(row.loans, 'loans').map(overviewLoan),
  }
}

function friendMachine(value: unknown): FriendMachine {
  const row = record(value, 'friend machine')
  const type = text(row.type, 'machine.type')
  if (!MACHINE_TYPES.has(type)) invalidPayload('machine.type')
  return {
    uid: text(row.uid, 'machine.uid'),
    type: type as FriendMachine['type'],
    x: integer(row.x, 'machine.x'),
    y: integer(row.y, 'machine.y'),
    rotation: rotation(row.rotation),
    durability: number(row.durability, 'machine.durability'),
  }
}

function friendDecor(value: unknown): FriendDecor {
  const row = record(value, 'friend decor')
  const type = text(row.type, 'decor.type')
  if (!DECOR_TYPES.has(type)) invalidPayload('decor.type')
  return {
    uid: text(row.uid, 'decor.uid'),
    type: type as FriendDecor['type'],
    x: integer(row.x, 'decor.x'),
    y: integer(row.y, 'decor.y'),
    rotation: rotation(row.rotation),
  }
}

function friendWall(value: unknown): FriendWall {
  const row = record(value, 'friend wall')
  const side = text(row.side, 'wall.side')
  if (side !== 'n' && side !== 'w') invalidPayload('wall.side')
  return {
    uid: text(row.uid, 'wall.uid'),
    x: integer(row.x, 'wall.x'),
    y: integer(row.y, 'wall.y'),
    side,
  }
}

function friendFloor(value: unknown): FriendFloorSnapshot {
  const row = record(value, 'friend floor')
  return {
    index: integer(row.index, 'floor.index'),
    expansion: integer(row.expansion, 'floor.expansion'),
    machines: list(row.machines, 'floor.machines').map(friendMachine),
    decor: list(row.decor, 'floor.decor').map(friendDecor),
    walls: list(row.walls, 'floor.walls').map(friendWall),
  }
}

function gymSnapshot(value: unknown): FriendGymSnapshot {
  const row = record(value, 'gym snapshot')
  return {
    owner: player(row.owner),
    level: integer(row.level, 'gym.level'),
    reputation: number(row.reputation, 'gym.reputation'),
    satisfaction: number(row.satisfaction, 'gym.satisfaction'),
    activeFloor: integer(row.activeFloor, 'gym.activeFloor'),
    floors: list(row.floors, 'gym.floors').map(friendFloor),
  }
}

function transferReceipt(value: unknown): TransferReceipt {
  const wrapper = record(value, 'transfer response')
  const row = record(wrapper.transfer, 'transfer')
  const asset = text(row.asset, 'transfer.asset')
  if (asset !== 'cash' && asset !== 'diamonds') invalidPayload('transfer.asset')
  return {
    id: text(row.id, 'transfer.id'),
    senderId: text(row.sender_id, 'transfer.sender_id'),
    recipientId: text(row.recipient_id, 'transfer.recipient_id'),
    asset: asset as TransferAsset,
    amount: integer(row.amount, 'transfer.amount'),
    createdAt: text(row.created_at, 'transfer.created_at'),
  }
}

/** Mutation RPCs return a ledger row, without joined profile names. */
function mutationLoan(value: unknown): Loan {
  const wrapper = record(value, 'loan response')
  const row = record(wrapper.loan, 'loan')
  const lenderId = text(row.lender_id, 'loan.lender_id')
  const borrowerId = text(row.borrower_id, 'loan.borrower_id')
  return {
    id: text(row.id, 'loan.id'),
    lender: { id: lenderId, username: lenderId },
    borrower: { id: borrowerId, username: borrowerId },
    amount: integer(row.amount, 'loan.amount'),
    repaidAmount: integer(row.repaid_amount, 'loan.repaid_amount'),
    status: loanStatus(row.status),
    createdAt: text(row.created_at, 'loan.created_at'),
  }
}

function sabotageEvent(value: unknown, nested: boolean): SabotageEvent {
  const wrapper = nested ? record(value, 'sabotage response') : null
  const row = record(nested ? wrapper?.event : value, 'sabotage event')
  if (row.attacker !== undefined) {
    return {
      id: text(row.id, 'sabotage.id'),
      attacker: player(row.attacker),
      targetGameDay: integer(row.targetGameDay, 'sabotage.targetGameDay'),
      createdAt: text(row.createdAt, 'sabotage.createdAt'),
    }
  }
  const attackerId = text(row.attacker_id, 'sabotage.attacker_id')
  return {
    id: text(row.id, 'sabotage.id'),
    attacker: { id: attackerId, username: attackerId },
    targetGameDay: integer(row.target_game_day, 'sabotage.target_game_day'),
    createdAt: text(row.created_at, 'sabotage.created_at'),
  }
}

export class SupabaseMultiplayerApi implements MultiplayerApi {
  constructor(
    private readonly client: SupabaseClient | null,
    private readonly hooks: SupabaseMultiplayerHooks = {},
  ) {}

  private async rpc(name: string, args: JsonRecord = {}): Promise<unknown> {
    if (!this.client) throw new MultiplayerError('MP_NOT_AUTHENTICATED')
    try {
      const { data, error } = await this.client.rpc(name, args)
      if (error) throw error
      return data
    } catch (cause) {
      throw toMultiplayerError(cause)
    }
  }

  private async walletChanged(): Promise<void> {
    try { await this.hooks.afterWalletMutation?.() } catch { /* RPC already succeeded */ }
  }

  private async walletRpc<T>(
    name: string,
    args: JsonRecord,
    parse: (value: unknown) => T,
  ): Promise<T> {
    try {
      await this.hooks.beforeWalletMutation?.()
      const data = await this.rpc(name, args)
      // The server mutation is committed at this point. Pull even when a bad
      // response shape makes parsing fail, or a stale autosave could undo it.
      await this.walletChanged()
      return parse(data)
    } catch (cause) {
      throw toMultiplayerError(cause)
    } finally {
      try { await this.hooks.afterWalletMutationFinished?.() } catch { /* UI can still continue */ }
    }
  }

  private async relationshipChanged(): Promise<void> {
    try { await this.hooks.afterRelationshipMutation?.() } catch { /* refresh can retry */ }
  }

  async searchPlayers(query: string): Promise<PlayerSummary[]> {
    const data = await this.rpc('search_players', { p_query: normalizePlayerQuery(query) })
    return list(data, 'player search').map(value => {
      const row = record(value, 'player search row')
      return {
        id: text(row.player_id, 'player_id'),
        username: text(row.username, 'username'),
      }
    })
  }

  async getOverview(): Promise<MultiplayerOverview> {
    return overview(await this.rpc('get_multiplayer_overview'))
  }

  async sendFriendRequest(recipientId: string): Promise<void> {
    await this.rpc('send_friend_request', { p_recipient_id: requirePlayerId(recipientId) })
  }

  async respondFriendRequest(requestId: string, accept: boolean): Promise<void> {
    await this.rpc('respond_friend_request', { p_request_id: requirePlayerId(requestId), p_accept: accept })
  }

  async removeFriend(friendId: string): Promise<void> {
    await this.rpc('remove_friend', { p_friend_id: requirePlayerId(friendId) })
    await this.relationshipChanged()
  }

  async getFriendGym(friendId: string): Promise<FriendGymSnapshot> {
    return gymSnapshot(await this.rpc('get_friend_gym_snapshot', { p_friend_id: requirePlayerId(friendId) }))
  }

  async sendAllianceInvitation(recipientId: string): Promise<void> {
    await this.rpc('send_alliance_invitation', { p_recipient_id: requirePlayerId(recipientId) })
  }

  async respondAllianceInvitation(invitationId: string, accept: boolean): Promise<void> {
    await this.rpc('respond_alliance_invitation', {
      p_invitation_id: requirePlayerId(invitationId),
      p_accept: accept,
    })
    await this.relationshipChanged()
  }

  async endAlliance(allyId: string): Promise<void> {
    await this.rpc('end_alliance', { p_ally_id: requirePlayerId(allyId) })
    await this.relationshipChanged()
  }

  async getNormalIncomeMultiplier(): Promise<1 | 1.5> {
    const multiplier = number(await this.rpc('get_normal_income_multiplier'), 'income multiplier')
    if (multiplier !== 1 && multiplier !== 1.5) invalidPayload('income multiplier')
    return multiplier
  }

  async transfer(command: TransferCommand): Promise<TransferReceipt> {
    return this.walletRpc('transfer_asset', {
      p_recipient_id: requirePlayerId(command.recipientId),
      p_asset: requireTransferAsset(command.asset),
      p_amount: requirePositiveInteger(command.amount),
      p_idempotency_key: requireIdempotencyKey(command.idempotencyKey),
    }, transferReceipt)
  }

  async proposeLoan(command: ProposeLoanCommand): Promise<Loan> {
    return mutationLoan(await this.rpc('propose_loan', {
      p_borrower_id: requirePlayerId(command.borrowerId),
      p_amount: requirePositiveInteger(command.amount),
      p_idempotency_key: requireIdempotencyKey(command.idempotencyKey),
    }))
  }

  async respondLoan(command: RespondLoanCommand): Promise<Loan> {
    const args = {
      p_loan_id: requirePlayerId(command.loanId),
      p_accept: command.accept,
      p_idempotency_key: requireIdempotencyKey(command.idempotencyKey),
    }
    return command.accept
      ? this.walletRpc('respond_loan', args, mutationLoan)
      : mutationLoan(await this.rpc('respond_loan', args))
  }

  async repayLoan(command: RepayLoanCommand): Promise<Loan> {
    return this.walletRpc('repay_loan', {
      p_loan_id: requirePlayerId(command.loanId),
      p_amount: requirePositiveInteger(command.amount),
      p_idempotency_key: requireIdempotencyKey(command.idempotencyKey),
    }, mutationLoan)
  }

  async sabotage(command: SabotageCommand): Promise<SabotageEvent> {
    return this.walletRpc('sabotage_friend', {
      p_target_id: requirePlayerId(command.targetId),
      p_idempotency_key: requireIdempotencyKey(command.idempotencyKey),
    }, value => sabotageEvent(value, true))
  }

  async getPendingSabotages(): Promise<SabotageEvent[]> {
    return list(await this.rpc('get_pending_sabotages'), 'pending sabotages')
      .map(value => sabotageEvent(value, false))
  }

  async acknowledgeSabotage(eventId: string): Promise<void> {
    await this.rpc('acknowledge_sabotage', { p_event_id: requirePlayerId(eventId) })
  }
}
