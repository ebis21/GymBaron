import { CloudError, type CloudErrorCode } from './types'

/**
 * Supabase reports failures in English, and often in the vocabulary of the
 * protocol rather than the player's ("Invalid login credentials", "AuthApiError").
 * Everything the account UI can surface is translated here, in one place, so
 * no screen has to invent its own wording.
 */
const AUTH_MESSAGES: Array<{ match: RegExp; code: CloudErrorCode; message: string }> = [
  {
    match: /invalid login credentials|invalid credentials/i,
    code: 'auth',
    message: 'Nieprawidłowy e-mail lub hasło.',
  },
  {
    match: /email not confirmed/i,
    code: 'auth',
    message: 'Potwierdź adres e-mail, klikając link, który wysłaliśmy.',
  },
  {
    match: /user already registered|already been registered/i,
    code: 'auth',
    message: 'Konto z tym adresem e-mail już istnieje. Zaloguj się.',
  },
  {
    match: /password should be at least (\d+)/i,
    code: 'auth',
    message: 'Hasło jest za krótkie — użyj co najmniej 6 znaków.',
  },
  {
    match: /weak password|password is too weak/i,
    code: 'auth',
    message: 'Hasło jest zbyt proste. Dodaj cyfrę lub znak specjalny.',
  },
  {
    match: /unable to validate email|invalid email|email address .* is invalid/i,
    code: 'auth',
    message: 'To nie wygląda na poprawny adres e-mail.',
  },
  {
    match: /for security purposes|rate limit|too many requests|over_email_send_rate/i,
    code: 'auth',
    message: 'Za dużo prób. Odczekaj chwilę i spróbuj ponownie.',
  },
  {
    match: /signups not allowed|signup is disabled/i,
    code: 'auth',
    message: 'Rejestracja jest chwilowo wyłączona.',
  },
  {
    match: /session|jwt|token .* expired|refresh_token/i,
    code: 'auth',
    message: 'Sesja wygasła. Zaloguj się ponownie.',
  },
  {
    match: /failed to fetch|network|fetch failed|timeout|ENOTFOUND|ECONNREFUSED/i,
    code: 'offline',
    message: 'Brak połączenia z serwerem. Gra działa dalej offline.',
  },
]

/** Fallback wording per code, used when nothing more specific matched. */
const FALLBACK: Record<CloudErrorCode, string> = {
  offline: 'Brak połączenia z serwerem. Gra działa dalej offline.',
  conflict: 'W chmurze jest nowsza wersja zapisu. Pobieram ją.',
  auth: 'Problem z logowaniem. Spróbuj ponownie.',
  'not-configured':
    'Konto w chmurze jest niedostępne — brak konfiguracji Supabase. Gra zapisuje się lokalnie.',
  server: 'Serwer odrzucił żądanie. Spróbuj ponownie za chwilę.',
  unknown: 'Coś poszło nie tak. Spróbuj ponownie.',
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
    if (entry.match.test(text)) return new CloudError(entry.code, entry.message, { cause })
  }

  // A PostgREST/Postgres error carries a code; the RLS refusals we can hit
  // mean "not your row", which for the player means "you are not signed in".
  const status = (cause as { status?: number } | null)?.status
  if (status === 401 || status === 403) {
    return new CloudError('auth', FALLBACK.auth, { cause })
  }
  if (typeof status === 'number' && status >= 500) {
    return new CloudError('server', FALLBACK.server, { cause })
  }

  return new CloudError(fallbackCode, FALLBACK[fallbackCode], { cause })
}

export function messageFor(code: CloudErrorCode): string {
  return FALLBACK[code]
}
