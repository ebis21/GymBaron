import { MultiplayerValidationError } from './validation'

export type MultiplayerErrorCode =
  | 'MP_NOT_AUTHENTICATED'
  | 'MP_PLAYER_NOT_FOUND'
  | 'MP_SAVE_NOT_FOUND'
  | 'MP_CANNOT_TARGET_SELF'
  | 'MP_ALREADY_FRIENDS'
  | 'MP_NOT_FRIENDS'
  | 'MP_FRIEND_REQUEST_EXISTS'
  | 'MP_FRIEND_REQUEST_NOT_FOUND'
  | 'MP_REQUEST_ALREADY_RESOLVED'
  | 'MP_ALLIANCE_REQUIRES_FRIEND'
  | 'MP_ALLIANCE_EXISTS'
  | 'MP_ALLIANCE_INVITATION_EXISTS'
  | 'MP_ALLIANCE_INVITATION_NOT_FOUND'
  | 'MP_ALLIANCE_NOT_FOUND'
  | 'MP_TRANSFER_REQUIRES_ALLIANCE'
  | 'MP_LOAN_REQUIRES_ALLIANCE'
  | 'MP_LOAN_NOT_FOUND'
  | 'MP_LOAN_NOT_PROPOSED'
  | 'MP_LOAN_NOT_ACTIVE'
  | 'MP_LENDER_INSUFFICIENT_BALANCE'
  | 'MP_REPAYMENT_TOO_HIGH'
  | 'MP_SABOTAGE_REQUIRES_FRIEND'
  | 'MP_CANNOT_SABOTAGE_ALLY'
  | 'MP_SABOTAGE_DAILY_LIMIT'
  | 'MP_SABOTAGE_NOT_FOUND'
  | 'MP_FRIEND_GYM_FORBIDDEN'
  | 'MP_INSUFFICIENT_BALANCE'
  | 'MP_INVALID_AMOUNT'
  | 'MP_INVALID_ASSET'
  | 'MP_INVALID_USERNAME_QUERY'
  | 'MP_INVALID_NICKNAME'
  | 'MP_NICKNAME_TAKEN'
  | 'MP_NICKNAME_ALREADY_SET'
  | 'MP_INVALID_IDEMPOTENCY_KEY'
  | 'MP_IDEMPOTENCY_CONFLICT'
  | 'MP_OPERATION_IN_PROGRESS'
  | 'MP_INVALID_SAVE_BALANCE'
  | 'MP_INVALID_TARGET_GAME_DAY'
  | 'MP_INVALID_DECISION'
  | 'MP_UNKNOWN'

const POLISH_MESSAGES: Record<MultiplayerErrorCode, string> = {
  MP_NOT_AUTHENTICATED: 'Zaloguj się, aby korzystać z multiplayera.',
  MP_PLAYER_NOT_FOUND: 'Nie znaleziono tego gracza.',
  MP_SAVE_NOT_FOUND: 'Gracz nie ma jeszcze zapisu gry.',
  MP_CANNOT_TARGET_SELF: 'Nie możesz wykonać tej operacji na sobie.',
  MP_ALREADY_FRIENDS: 'Ten gracz jest już Twoim znajomym.',
  MP_NOT_FRIENDS: 'Ten gracz nie jest na Twojej liście znajomych.',
  MP_FRIEND_REQUEST_EXISTS: 'Zaproszenie do znajomych już oczekuje.',
  MP_FRIEND_REQUEST_NOT_FOUND: 'Zaproszenie do znajomych nie istnieje lub nie jest Twoje.',
  MP_REQUEST_ALREADY_RESOLVED: 'To zaproszenie zostało już rozpatrzone.',
  MP_ALLIANCE_REQUIRES_FRIEND: 'Sojusz można utworzyć wyłącznie ze znajomym.',
  MP_ALLIANCE_EXISTS: 'Macie już aktywny sojusz.',
  MP_ALLIANCE_INVITATION_EXISTS: 'Zaproszenie do sojuszu już oczekuje.',
  MP_ALLIANCE_INVITATION_NOT_FOUND: 'Zaproszenie do sojuszu nie istnieje lub nie jest Twoje.',
  MP_ALLIANCE_NOT_FOUND: 'Nie macie aktywnego sojuszu.',
  MP_TRANSFER_REQUIRES_ALLIANCE: 'Przelewy są dostępne tylko między aktywnymi sojusznikami.',
  MP_LOAN_REQUIRES_ALLIANCE: 'Pożyczkę można zaproponować aktywnemu sojusznikowi.',
  MP_LOAN_NOT_FOUND: 'Nie znaleziono tej pożyczki.',
  MP_LOAN_NOT_PROPOSED: 'Ta propozycja pożyczki została już rozpatrzona.',
  MP_LOAN_NOT_ACTIVE: 'Ta pożyczka nie jest aktywna.',
  MP_LENDER_INSUFFICIENT_BALANCE: 'Pożyczkodawca nie ma wystarczającej liczby kredytów.',
  MP_REPAYMENT_TOO_HIGH: 'Spłata przekracza pozostałą kwotę pożyczki.',
  MP_SABOTAGE_REQUIRES_FRIEND: 'Sabotować można wyłącznie znajomego.',
  MP_CANNOT_SABOTAGE_ALLY: 'Nie możesz sabotować aktywnego sojusznika.',
  MP_SABOTAGE_DAILY_LIMIT: 'Ten gracz został już dziś skutecznie sabotowany.',
  MP_SABOTAGE_NOT_FOUND: 'Nie znaleziono zdarzenia sabotażu.',
  MP_FRIEND_GYM_FORBIDDEN: 'Siłownię może oglądać wyłącznie zaakceptowany znajomy.',
  MP_INSUFFICIENT_BALANCE: 'Masz za mało środków.',
  MP_INVALID_AMOUNT: 'Kwota musi być dodatnią liczbą całkowitą.',
  MP_INVALID_ASSET: 'Nieobsługiwany rodzaj środków.',
  MP_INVALID_USERNAME_QUERY: 'Wpisz od 2 do 24 znaków nazwy gracza.',
  MP_INVALID_NICKNAME: 'Nick musi mieć od 3 do 20 znaków i może zawierać litery, cyfry, spacje, _ oraz -.',
  MP_NICKNAME_TAKEN: 'Ten nick jest już zajęty.',
  MP_NICKNAME_ALREADY_SET: 'Nick został już ustawiony dla tego konta.',
  MP_INVALID_IDEMPOTENCY_KEY: 'Nieprawidłowy identyfikator operacji. Spróbuj ponownie.',
  MP_IDEMPOTENCY_CONFLICT: 'Ta operacja została już użyta z innymi danymi.',
  MP_OPERATION_IN_PROGRESS: 'Operacja jest już przetwarzana. Odśwież za chwilę.',
  MP_INVALID_SAVE_BALANCE: 'Zapis gry zawiera nieprawidłowe saldo.',
  MP_INVALID_TARGET_GAME_DAY: 'Nie udało się ustalić dnia gry celu.',
  MP_INVALID_DECISION: 'Wybierz, czy akceptujesz, czy odrzucasz propozycję.',
  MP_UNKNOWN: 'Nie udało się wykonać operacji multiplayer.',
}

export class MultiplayerError extends Error {
  readonly code: MultiplayerErrorCode
  readonly cause?: unknown

  constructor(code: MultiplayerErrorCode, cause?: unknown) {
    super(POLISH_MESSAGES[code])
    this.name = 'MultiplayerError'
    this.code = code
    this.cause = cause
  }
}

const CODES = new Set<MultiplayerErrorCode>(
  Object.keys(POLISH_MESSAGES) as MultiplayerErrorCode[],
)

function errorText(error: unknown): string {
  if (error instanceof Error) return `${error.message} ${String(error.cause ?? '')}`
  if (typeof error === 'object' && error !== null) {
    const candidate = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown }
    return [candidate.message, candidate.details, candidate.hint, candidate.code]
      .filter(value => typeof value === 'string')
      .join(' ')
  }
  return String(error)
}

export function multiplayerErrorCode(error: unknown): MultiplayerErrorCode {
  if (error instanceof MultiplayerError) return error.code
  if (error instanceof MultiplayerValidationError && CODES.has(error.code as MultiplayerErrorCode)) {
    return error.code as MultiplayerErrorCode
  }
  const text = errorText(error)
  for (const code of CODES) {
    if (code !== 'MP_UNKNOWN' && text.includes(code)) return code
  }
  return 'MP_UNKNOWN'
}

export function toMultiplayerError(error: unknown): MultiplayerError {
  return error instanceof MultiplayerError
    ? error
    : new MultiplayerError(multiplayerErrorCode(error), error)
}

export function multiplayerErrorMessage(error: unknown): string {
  return toMultiplayerError(error).message
}
