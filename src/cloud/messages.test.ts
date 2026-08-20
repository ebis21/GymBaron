import { beforeEach, describe, expect, it } from 'vitest'
import { messageFor, toCloudError } from './messages'
import { CloudError } from './types'
import { useI18nStore } from '../i18n'
import { en } from '../i18n/en'
import { pl } from '../i18n/pl'

/**
 * Every failure the account screen can show has to arrive in the selected
 * language and with a code the calling code can branch on. Raw Supabase text
 * reaching a player is the bug these guard against.
 */
describe('translating cloud failures', () => {
  beforeEach(() => {
    useI18nStore.setState({ language: 'en', t: en, ready: true })
  })

  it('names a wrong password without guessing which field was wrong', () => {
    const error = toCloudError({ message: 'Invalid login credentials', status: 400 })

    expect(error.code).toBe('auth')
    expect(error.message).toBe('Incorrect email or password.')
  })

  it('points at the confirmation mail when the account is unconfirmed', () => {
    expect(toCloudError({ message: 'Email not confirmed' }).message).toMatch(/Confirm your email/)
  })

  it('tells a returning player to sign in instead of registering again', () => {
    const error = toCloudError({ message: 'User already registered' })
    expect(error.message).toMatch(/already exists/)
  })

  it('treats a dead network as offline, not as a rejected login', () => {
    const error = toCloudError(new TypeError('Failed to fetch'))

    expect(error.code).toBe('offline')
    expect(error.message).toMatch(/continues offline/)
  })

  it('reads an expired session as something a fresh login fixes', () => {
    expect(toCloudError({ message: 'JWT expired' }).message).toMatch(/session expired/i)
  })

  it('maps a 401 with no recognisable text to an auth problem', () => {
    expect(toCloudError({ status: 401, message: 'nope' }).code).toBe('auth')
  })

  it('maps a 5xx to a server problem worth retrying', () => {
    const error = toCloudError({ status: 503, message: 'nope' })

    expect(error.code).toBe('server')
    expect(error.message).toMatch(/Try again/)
  })

  it('passes an already-translated error straight through', () => {
    const original = new CloudError('conflict', 'W chmurze jest nowsza wersja zapisu. Pobieram ją.')
    expect(toCloudError(original)).toBe(original)
  })

  it('falls back to the caller-declared code for anything unrecognised', () => {
    expect(toCloudError({}, 'offline').code).toBe('offline')
    expect(toCloudError(undefined).code).toBe('unknown')
  })

  it('says the game keeps working when Supabase is not configured', () => {
    expect(messageFor('not-configured')).toMatch(/saved locally/)
  })

  it('switches those messages to Polish with the rest of Baron Club', () => {
    useI18nStore.setState({ language: 'pl', t: pl, ready: true })

    expect(toCloudError({ message: 'Invalid login credentials' }).message)
      .toBe('Nieprawidłowy e-mail lub hasło.')
    expect(messageFor('not-configured')).toMatch(/zapisuje się lokalnie/)
  })
})
