import { describe, expect, it } from 'vitest'
import { messageFor, toCloudError } from './messages'
import { CloudError } from './types'

/**
 * Every failure the account screen can show has to arrive in Polish and with a
 * code the calling code can branch on. English straight from supabase-js
 * reaching a player is the bug these guard against.
 */
describe('translating cloud failures', () => {
  it('names a wrong password without guessing which field was wrong', () => {
    const error = toCloudError({ message: 'Invalid login credentials', status: 400 })

    expect(error.code).toBe('auth')
    expect(error.message).toBe('Nieprawidłowy e-mail lub hasło.')
  })

  it('points at the confirmation mail when the account is unconfirmed', () => {
    expect(toCloudError({ message: 'Email not confirmed' }).message).toMatch(/Potwierdź adres/)
  })

  it('tells a returning player to sign in instead of registering again', () => {
    const error = toCloudError({ message: 'User already registered' })
    expect(error.message).toMatch(/już istnieje/)
  })

  it('treats a dead network as offline, not as a rejected login', () => {
    const error = toCloudError(new TypeError('Failed to fetch'))

    expect(error.code).toBe('offline')
    expect(error.message).toMatch(/Gra działa dalej offline/)
  })

  it('reads an expired session as something a fresh login fixes', () => {
    expect(toCloudError({ message: 'JWT expired' }).message).toMatch(/Sesja wygasła/)
  })

  it('maps a 401 with no recognisable text to an auth problem', () => {
    expect(toCloudError({ status: 401, message: 'nope' }).code).toBe('auth')
  })

  it('maps a 5xx to a server problem worth retrying', () => {
    const error = toCloudError({ status: 503, message: 'nope' })

    expect(error.code).toBe('server')
    expect(error.message).toMatch(/Spróbuj ponownie/)
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
    expect(messageFor('not-configured')).toMatch(/zapisuje się lokalnie/)
  })
})
