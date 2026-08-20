import { CloudError, type CloudErrorCode } from './types'
import { strings } from '../i18n'

const copy = () => strings().club.account.service

/**
 * Supabase reports failures in English, and often in the vocabulary of the
 * protocol rather than the player's ("Invalid login credentials", "AuthApiError").
 * Everything the account UI can surface is translated here, in one place, so
 * no screen has to invent its own wording.
 */
const AUTH_MESSAGES: Array<{ match: RegExp; code: CloudErrorCode; message: () => string }> = [
  {
    match: /invalid login credentials|invalid credentials/i,
    code: 'auth',
    message: () => copy().invalidCredentials,
  },
  {
    match: /email not confirmed/i,
    code: 'auth',
    message: () => copy().confirmEmail,
  },
  {
    match: /user already registered|already been registered/i,
    code: 'auth',
    message: () => copy().alreadyRegistered,
  },
  {
    match: /password should be at least (\d+)/i,
    code: 'auth',
    message: () => copy().passwordTooShort,
  },
  {
    match: /weak password|password is too weak/i,
    code: 'auth',
    message: () => copy().weakPassword,
  },
  {
    match: /unable to validate email|invalid email|email address .* is invalid/i,
    code: 'auth',
    message: () => copy().invalidEmail,
  },
  {
    match: /for security purposes|rate limit|too many requests|over_email_send_rate/i,
    code: 'auth',
    message: () => copy().tooManyAttempts,
  },
  {
    match: /signups not allowed|signup is disabled/i,
    code: 'auth',
    message: () => copy().signUpDisabled,
  },
  {
    match: /session|jwt|token .* expired|refresh_token/i,
    code: 'auth',
    message: () => copy().sessionExpired,
  },
  {
    match: /failed to fetch|network|fetch failed|timeout|ENOTFOUND|ECONNREFUSED/i,
    code: 'offline',
    message: () => copy().offline,
  },
]

/** Fallback wording per code, used when nothing more specific matched. */
const FALLBACK: Record<CloudErrorCode, () => string> = {
  offline: () => copy().offline,
  conflict: () => copy().conflict,
  auth: () => copy().auth,
  'not-configured': () => copy().notConfigured,
  server: () => copy().server,
  unknown: () => copy().unknown,
}

function textOf(cause: unknown): string {
  if (typeof cause === 'string') return cause
  if (cause instanceof Error) return cause.message
  if (typeof cause === 'object' && cause !== null) {
    const record = cause as Record<string, unknown>
    const parts = [record.message, record.error_description, record.details, record.hint]
    return parts.filter(part => typeof part === 'string').join(' ')
  }
  return ''
}

/**
 * Turns anything thrown by supabase-js into a `CloudError` carrying a message
 * a player can act on. Already-translated errors pass straight through, so
 * wrapping twice is harmless.
 */
export function toCloudError(cause: unknown, fallbackCode: CloudErrorCode = 'unknown'): CloudError {
  if (cause instanceof CloudError) return cause

  const text = textOf(cause)
  for (const entry of AUTH_MESSAGES) {
    if (entry.match.test(text)) return new CloudError(entry.code, entry.message(), { cause })
  }

  // A PostgREST/Postgres error carries a code; the RLS refusals we can hit
  // mean "not your row", which for the player means "you are not signed in".
  const status = (cause as { status?: number } | null)?.status
  if (status === 401 || status === 403) {
    return new CloudError('auth', FALLBACK.auth(), { cause })
  }
  if (typeof status === 'number' && status >= 500) {
    return new CloudError('server', FALLBACK.server(), { cause })
  }

  return new CloudError(fallbackCode, FALLBACK[fallbackCode](), { cause })
}

export function messageFor(code: CloudErrorCode): string {
  return FALLBACK[code]()
}
