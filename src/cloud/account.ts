import { SAVE_VERSION } from '../game/constants'
import { SupabaseAuthService, type AccountSession, type AuthService } from './auth'
import {
  CloudSaveService,
  type AttachOutcome,
  type CloudSaveEvent,
  type CloudSaveSnapshot,
} from './cloudSave'
import { localSaveStore } from './localSaveStore'
import { messageFor, toCloudError } from './messages'
import { SupabaseSaveRepository } from './supabaseSaveRepository'
import { getSupabaseClient } from './supabaseClient'
import type { LocalSaveStore, SaveRepository } from './types'
import { strings } from '../i18n'

export interface AccountState {
  /** False when the build has no Supabase credentials. UI should hide accounts. */
  configured: boolean
  session: AccountSession | null
  sync: CloudSaveSnapshot
  /** A request is in flight; disable the form. */
  busy: boolean
  /** Something went wrong, in the language selected when it happened. */
  error: string | null
  /** Something went right and is worth saying, in the selected language. */
  notice: string | null
}

export interface AccountServiceOptions {
  auth: AuthService | null
  repository: SaveRepository | null
  local?: LocalSaveStore
  saveVersion?: number
  /** How often to check whether the cloud save moved. 0 disables polling. */
  pollIntervalMs?: number
}

const DEFAULT_POLL_MS = 60_000

const attachNotice = (outcome: AttachOutcome): string | null => {
  const copy = strings().club.account.service
  return {
    uploaded: copy.uploaded,
    downloaded: copy.downloaded,
    empty: null,
    failed: null,
  }[outcome]
}

/**
 * One object for the whole account feature: sign-in, sign-out, and keeping the
 * cloud save in step with whoever is signed in.
 *
 * It owns no game state. When the cloud hands back a save it forwards it
 * through `onAdopt`, and the store layer decides what to do with it — which is
 * what keeps the engine unaware that any of this exists.
 */
export class AccountService {
  readonly cloud: CloudSaveService
  readonly configured: boolean

  private readonly auth: AuthService | null
  private readonly pollIntervalMs: number
  private listeners = new Set<(state: AccountState) => void>()
  private session: AccountSession | null = null
  private busy = false
  private error: string | null = null
  private notice: string | null = null
  private attachedTo: string | null = null
  private attaching: Promise<void> | null = null
  private stopPolling: (() => void) | null = null
  private unsubscribeAuth: (() => void) | null = null
  private started: Promise<void> | null = null

  constructor(options: AccountServiceOptions) {
    this.auth = options.auth
    this.configured = options.auth !== null && options.repository !== null
    this.pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_MS

    this.cloud = new CloudSaveService({
      repository: options.repository ?? offlineRepository(),
      local: options.local ?? localSaveStore,
      saveVersion: options.saveVersion ?? SAVE_VERSION,
    })

    if (!this.configured) this.cloud.disable(messageFor('not-configured'))
    this.cloud.subscribe(() => this.publish())
  }

  // --- observation --------------------------------------------------------

  state(): AccountState {
    return {
      configured: this.configured,
      session: this.session,
      sync: this.cloud.snapshot(),
      busy: this.busy,
      error: this.error,
      notice: this.notice,
    }
  }

  subscribe(listener: (state: AccountState) => void): () => void {
    this.listeners.add(listener)
    listener(this.state())
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** Forwards saves that arrived from the cloud, for the store to adopt. */
  onCloudEvent(listener: (event: CloudSaveEvent) => void): () => void {
    return this.cloud.subscribe(listener)
  }

  private publish(): void {
    const state = this.state()
    for (const listener of [...this.listeners]) {
      try {
        listener(state)
      } catch {
        /* a broken listener must not break sync */
      }
    }
  }

  // --- lifecycle ----------------------------------------------------------

  /**
   * Picks up a session left over from a previous run and syncs against it.
   * Safe to call before the game has finished loading, and safe to call with
   * no network — a failure here leaves the local save in charge.
   */
  start(): Promise<void> {
    // Idempotent: React strict mode mounts effects twice, and a second
    // reconciliation would fight the first one over the same revision.
    this.started ??= this.doStart()
    return this.started
  }

  private async doStart(): Promise<void> {
    if (!this.auth) return

    this.unsubscribeAuth ??= this.auth.subscribe(session => {
      this.session = session
      // Token refreshes and the sign-in call itself both land here; `attach`
      // deduplicates by user, so this never re-runs reconciliation.
      if (session) void this.attach(session)
      else this.leave()
    })

    try {
      const session = await this.auth.restore()
      this.session = session
      if (session) await this.attach(session)
      else this.publish()
    } catch (cause) {
      this.error = toCloudError(cause, 'offline').message
      this.publish()
    }
  }

  /**
   * Reconciles once per account. Supabase fires `onAuthStateChange` during
   * `signInWithPassword` as well as on every token refresh, so the same
   * sign-in reaches this from two directions; running reconciliation twice
   * would have the second pass fight the first over the same revision.
   */
  private attach(session: AccountSession): Promise<void> {
    if (this.attachedTo === session.userId) return this.attaching ?? Promise.resolve()
    this.attachedTo = session.userId
    this.attaching = this.doAttach(session)
    return this.attaching
  }

  private async doAttach(session: AccountSession): Promise<void> {
    const result = await this.cloud.attach(session.userId)
    this.notice = attachNotice(result.outcome)
    this.error = result.outcome === 'failed' ? result.message : null
    // A reconciliation that never happened must not block the next attempt.
    if (result.outcome === 'failed') this.attachedTo = null
    if (result.outcome !== 'failed' && this.pollIntervalMs > 0) {
      this.stopPolling = this.cloud.startPolling(this.pollIntervalMs)
    }
    this.publish()
  }

  private leave(): void {
    this.attachedTo = null
    this.attaching = null
    this.stopPolling?.()
    this.stopPolling = null
    this.cloud.detach()
    this.publish()
  }

  // --- actions ------------------------------------------------------------

  async signUp(email: string, password: string): Promise<boolean> {
    return this.run(async auth => {
      const { session, needsConfirmation } = await auth.signUp(email, password)
      if (needsConfirmation) {
        this.notice = strings().club.account.service.signUpConfirmation
        return
      }
      this.session = session
      if (session) await this.attach(session)
    })
  }

  async signIn(email: string, password: string): Promise<boolean> {
    return this.run(async auth => {
      const session = await auth.signIn(email, password)
      this.session = session
      await this.attach(session)
    })
  }

  /**
   * Flushes anything still queued before dropping the session — signing out
   * with an unsent save is how a player loses the last minute of play.
   */
  async signOut(): Promise<boolean> {
    return this.run(async auth => {
      await this.cloud.flush()
      await auth.signOut()
      this.session = null
      this.leave()
      this.notice = strings().club.account.service.signedOut
    })
  }

  private async run(action: (auth: AuthService) => Promise<void>): Promise<boolean> {
    if (!this.auth) {
      this.error = messageFor('not-configured')
      this.publish()
      return false
    }

    this.busy = true
    this.error = null
    this.notice = null
    this.publish()

    try {
      await action(this.auth)
      return true
    } catch (cause) {
      this.error = toCloudError(cause, 'offline').message
      return false
    } finally {
      this.busy = false
      this.publish()
    }
  }

  dispose(): void {
    this.unsubscribeAuth?.()
    this.unsubscribeAuth = null
    this.stopPolling?.()
    this.stopPolling = null
    this.cloud.dispose()
    this.listeners.clear()
  }
}

/** Stands in when there is no Supabase, so `cloud` is never null downstream. */
function offlineRepository(): SaveRepository {
  const refuse = async (): Promise<never> => {
    throw toCloudError(null, 'not-configured')
  }
  return { fetch: refuse, stamp: refuse, create: refuse, update: refuse }
}

let singleton: AccountService | null = null

/**
 * The app-wide account service, built from the ambient Vite config. Returns a
 * disabled-but-usable service when Supabase is not configured, so callers
 * never need a null check.
 */
export function getAccountService(): AccountService {
  if (singleton) return singleton
  const client = getSupabaseClient()
  singleton = new AccountService({
    auth: client ? new SupabaseAuthService(client) : null,
    repository: client ? new SupabaseSaveRepository(client) : null,
  })
  return singleton
}
