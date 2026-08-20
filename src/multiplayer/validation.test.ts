import { describe, expect, it } from 'vitest'
import { multiplayerErrorMessage, toMultiplayerError } from './errors'
import {
  normalizePlayerNickname,
  normalizePlayerQuery,
  requireIdempotencyKey,
  requirePositiveInteger,
  requireTransferAsset,
} from './validation'

describe('multiplayer validation', () => {
  it('normalizes a player query and rejects unsafe lengths', () => {
    expect(normalizePlayerQuery('  Żaneta  ')).toBe('żaneta')
    expect(() => normalizePlayerQuery('x')).toThrowError('MP_INVALID_USERNAME_QUERY')
    expect(() => normalizePlayerQuery('x'.repeat(25))).toThrowError('MP_INVALID_USERNAME_QUERY')
  })

  it('normalizes safe nicknames and keeps Polish letters', () => {
    expect(normalizePlayerNickname('  Żelazny   Baron  ')).toBe('Żelazny Baron')
    expect(normalizePlayerNickname('LIL_D-21')).toBe('LIL_D-21')
  })

  it('rejects nicknames that are too short, too long or unsafe', () => {
    for (const nickname of ['ab', 'a'.repeat(21), '-baron', 'baron-', 'baron!', '🔥baron']) {
      expect(() => normalizePlayerNickname(nickname)).toThrowError('MP_INVALID_NICKNAME')
    }
  })

  it('accepts only positive safe integers', () => {
    expect(requirePositiveInteger(15)).toBe(15)
    for (const value of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => requirePositiveInteger(value)).toThrowError('MP_INVALID_AMOUNT')
    }
  })

  it('accepts only supported assets and well-sized idempotency keys', () => {
    expect(requireTransferAsset('cash')).toBe('cash')
    expect(requireTransferAsset('diamonds')).toBe('diamonds')
    expect(() => requireTransferAsset('xp')).toThrowError('MP_INVALID_ASSET')
    expect(requireIdempotencyKey('operation-123')).toBe('operation-123')
    expect(() => requireIdempotencyKey('short')).toThrowError('MP_INVALID_IDEMPOTENCY_KEY')
  })

  it('maps Postgres RPC failures to a stable Polish message', () => {
    const error = toMultiplayerError({ message: 'P0001: MP_CANNOT_SABOTAGE_ALLY' })
    expect(error.code).toBe('MP_CANNOT_SABOTAGE_ALLY')
    expect(multiplayerErrorMessage(error)).toContain('sojusznika')
    expect(multiplayerErrorMessage(new Error('network disconnected'))).toContain('multiplayer')
  })
})
