import type { IdempotencyKey, TransferAsset } from './types'

export const MIN_PLAYER_QUERY_LENGTH = 2
export const MAX_PLAYER_QUERY_LENGTH = 24
export const SABOTAGE_COST = 1_000

export class MultiplayerValidationError extends Error {
  readonly code: string

  constructor(code: string) {
    super(code)
    this.name = 'MultiplayerValidationError'
    this.code = code
  }
}

export function normalizePlayerQuery(value: string): string {
  const query = value.trim().toLocaleLowerCase('pl-PL')
  if (query.length < MIN_PLAYER_QUERY_LENGTH || query.length > MAX_PLAYER_QUERY_LENGTH) {
    throw new MultiplayerValidationError('MP_INVALID_USERNAME_QUERY')
  }
  return query
}

export function requirePlayerId(value: string): string {
  const id = value.trim()
  if (id.length === 0) throw new MultiplayerValidationError('MP_PLAYER_NOT_FOUND')
  return id
}

/** Values crossing the JS/Postgres boundary must stay exact bigint integers. */
export function requirePositiveInteger(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new MultiplayerValidationError('MP_INVALID_AMOUNT')
  }
  return value
}

export function requireTransferAsset(value: string): TransferAsset {
  if (value !== 'cash' && value !== 'diamonds') {
    throw new MultiplayerValidationError('MP_INVALID_ASSET')
  }
  return value
}

export function requireIdempotencyKey(value: string): IdempotencyKey {
  const key = value.trim()
  if (key.length < 8 || key.length > 128) {
    throw new MultiplayerValidationError('MP_INVALID_IDEMPOTENCY_KEY')
  }
  return key
}

export function newIdempotencyKey(): IdempotencyKey {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `op-${Date.now()}-${Math.random().toString(36).slice(2)}`
}
