import type { IdempotencyKey, TransferAsset } from './types'

export const MIN_PLAYER_QUERY_LENGTH = 2
export const MAX_PLAYER_QUERY_LENGTH = 24
export const MIN_NICKNAME_LENGTH = 3
export const MAX_NICKNAME_LENGTH = 20
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

/** Mirrors the one-time nickname RPC validation before making a round trip. */
export function normalizePlayerNickname(value: string): string {
  const nickname = value.trim().replace(/\s+/gu, ' ')
  const length = Array.from(nickname).length
  if (
    length < MIN_NICKNAME_LENGTH ||
    length > MAX_NICKNAME_LENGTH ||
    !/^[\p{L}\p{N}][\p{L}\p{N} _-]*[\p{L}\p{N}]$/u.test(nickname)
  ) {
    throw new MultiplayerValidationError('MP_INVALID_NICKNAME')
  }
  return nickname
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
