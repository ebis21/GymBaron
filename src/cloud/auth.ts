import type { Session, SupabaseClient, User } from '@supabase/supabase-js'
import { toCloudError } from './messages'
import { CloudError } from './types'
import { strings } from '../i18n'

export interface AccountSession {
  userId: string
  email: string | null
  displayName: string | null
}

export interface SignUpResult {
  /** Null when the project requires the player to confirm their e-mail first. */
  session: AccountSession | null
  needsConfirmation: boolean
}

export interface AuthService {
  /** The session as last known, without a round trip. */
  session(): AccountSession | null
  /** Restores a persisted session on app start. */
  restore(): Promise<AccountSession | null>
  signUp(email: string, password: string): Promise<SignUpResult>
  signIn(email: string, password: string): Promise<AccountSession>
  signOut(): Promise<void>
  /** Fires on sign-in, sign-out and token refresh. Returns an unsubscribe. */
  subscribe(listener: (session: AccountSession | null) => void): () => void
}

/** Shortest password Supabase accepts by default; checked here to save a trip. */
const MIN_PASSWORD_LENGTH = 6

function toAccount(user: User | null | undefined): AccountSession | null {
  if (!user) return null
  const meta = user.user_metadata as Record<string, unknown> | null
  const displayName = typeof meta?.display_name === 'string' ? meta.display_name : null
  return { userId: user.id, email: user.email ?? null, displayName }
}

/**
 * Checked before the network so the player gets the specific complaint
 * instantly, instead of a generic 400 a second later.
 */
function validate(email: string, password: string): void {
  const copy = strings().club.account.service
  if (!email.trim()) throw new CloudError('auth', copy.requiredEmail)
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
    throw new CloudError('auth', copy.invalidEmail)
  }
  if (!password) throw new CloudError('auth', copy.requiredPassword)
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new CloudError('auth', copy.shortPassword(MIN_PASSWORD_LENGTH))
  }
}

/**
 * Email + password accounts over Supabase Auth.
 *
 * Session persistence is the client's job (see `supabaseClient.ts`, which
 * stores it through Capacitor Preferences); this class only translates.
 */
export class SupabaseAuthService implements AuthService {
  private current: AccountSession | null = null

  constructor(private readonly client: SupabaseClient) {}

  session(): AccountSession | null {
    return this.current
  }

  async restore(): Promise<AccountSession | null> {
    try {
      const { data, error } = await this.client.auth.getSession()
      if (error) throw toCloudError(error, 'auth')
      this.current = toAccount(data.session?.user)
      return this.current
    } catch (cause) {
      // A restore that cannot reach the network is not a sign-out. Report no
      // session and let the player retry; nothing local is destroyed.
      throw toCloudError(cause, 'offline')
    }
  }

  async signUp(email: string, password: string): Promise<SignUpResult> {
    validate(email, password)
    try {
      const { data, error } = await this.client.auth.signUp({
        email: email.trim(),
        password,
      })
      if (error) throw toCloudError(error, 'auth')

      const session = toAccount(data.session?.user)
      this.current = session
      // Supabase returns a user but no session when confirmations are on.
      return { session, needsConfirmation: data.session === null }
    } catch (cause) {
      throw toCloudError(cause, 'offline')
    }
  }

  async signIn(email: string, password: string): Promise<AccountSession> {
    validate(email, password)
    try {
      const { data, error } = await this.client.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (error) throw toCloudError(error, 'auth')

      const session = toAccount(data.user)
      if (!session) throw new CloudError('auth', strings().club.account.service.signInFailed)
      this.current = session
      return session
    } catch (cause) {
      throw toCloudError(cause, 'offline')
    }
  }

  async signOut(): Promise<void> {
    try {
      const { error } = await this.client.auth.signOut()
      if (error) throw toCloudError(error, 'auth')
    } catch (cause) {
      throw toCloudError(cause, 'offline')
    } finally {
      this.current = null
    }
  }

  subscribe(listener: (session: AccountSession | null) => void): () => void {
    const { data } = this.client.auth.onAuthStateChange((_event, session: Session | null) => {
      this.current = toAccount(session?.user)
      listener(this.current)
    })
    return () => data.subscription.unsubscribe()
  }
}
