import { toCloudError } from './messages'
import { newestWins, type ConflictResolver } from './resolve'
import {
  CloudError,
  type LocalSaveStore,
  type SaveRepository,
  type SaveState,
} from './types'

export type SyncStatus =
  /** No Supabase configuration in this build. Local saves only, forever. */
  | 'disabled'
  /** Configured, but nobody is signed in. Local saves only, for now. */
  | 'local'
  | 'syncing'
  | 'synced'
  /** Signed in, but the last round trip failed. Play continues locally. */
  | 'offline'
  | 'error'

export interface CloudSaveSnapshot {
  status: SyncStatus
  userId: string | null
  /** Revision this device last agreed with the cloud on. */
  revision: number | null
  lastSyncedAt: number | null
  /** Player-facing localized text for the current status, when there is one. */
  message: string | null
  /** True while a local change is waiting to reach the cloud. */
  pending: boolean
}

export type AdoptReason =
  /** Pulled during the sign-in reconciliation. */
  | 'first-login'
  /** A poll noticed the cloud revision had moved on. */
  | 'remote-changed'
  /** Our write lost the compare-and-swap, so we took what was there instead. */
  | 'conflict'

export type CloudSaveEvent =
  | { type: 'status'; snapshot: CloudSaveSnapshot }
  /**
   * The cloud handed back a save the game should switch to. `raw` is the same
   * serialized JSON the local store holds, ready for `deserialize`.
   */
  | { type: 'adopt'; raw: string; revision: number; reason: AdoptReason }

export type AttachOutcome =
  /** The local gym became this account's cloud save. */
  | 'uploaded'
  /** The cloud save replaced what was on this device. */
  | 'downloaded'
  /** Neither side had anything — a brand new player on a brand new account. */
  | 'empty'
  /** Reconciliation could not finish. The local save is untouched. */
  | 'failed'

export interface AttachResult {
  outcome: AttachOutcome
  revision: number | null
  message: string | null
}

export type PushOutcome =
  | 'saved'
  /** Throttled — the write is queued and will go out on the next flush. */
  | 'queued'
  /** Nothing to write. */
  | 'idle'
  /** Not signed in (or no Supabase): the local save is the only save. */
  | 'local-only'
  /** Someone else wrote first; we adopted their version instead of ours. */
  | 'conflict'
  | 'offline'
  | 'error'

export interface PushResult {
  outcome: PushOutcome
  revision: number | null
  message: string | null
}

export interface CloudSaveOptions {
  repository: SaveRepository
  local: LocalSaveStore
  /** Engine SAVE_VERSION, mirrored into the row for server-side migrations. */
  saveVersion: number
  resolver?: ConflictResolver
  now?: () => number
  /**
   * Floor on how often a push actually reaches the network. The game autosaves
   * every few seconds; the cloud does not need that, and a phone's radio
   * certainly does not.
   */
  minPushIntervalMs?: number
  /** Injected for tests; defaults to the host timers. */
  schedule?: (fn: () => void, ms: number) => unknown
  cancel?: (handle: unknown) => void
}

const DEFAULT_PUSH_INTERVAL_MS = 20_000

/**
 * Local-first cloud sync for the single full save.
 *
 * The rules it enforces, in order of importance:
 *
 *  1. The game never waits on the network. Every method resolves; none of them
 *     reject. A failed round trip downgrades the status and keeps playing.
 *  2. A write is only reported as saved when Supabase confirmed it.
 *  3. An older save never overwrites a newer one — every write carries the
 *     revision it expects to replace, and losing that bet means reading the
 *     newer save rather than forcing ours over it.
 *
 * It deliberately does not know what a `GameState` is; `raw` is the same JSON
 * string the local store already holds.
 */
export class CloudSaveService {
  private readonly repository: SaveRepository
  private readonly local: LocalSaveStore
  private readonly saveVersion: number
  private readonly resolver: ConflictResolver
  private readonly now: () => number
  private readonly minPushIntervalMs: number
  private readonly schedule: (fn: () => void, ms: number) => unknown
  private readonly cancel: (handle: unknown) => void

  private listeners = new Set<(event: CloudSaveEvent) => void>()
  private status: SyncStatus = 'local'
  private message: string | null = null
  private userId: string | null = null
  private revision: number | null = null
  private lastSyncedAt: number | null = null

  private pending: string | null = null
  // -Infinity, not 0: the first push after signing in should go out at once
  // rather than sit in the throttle window for twenty seconds.
  private lastPushAt = -Infinity
  private timer: unknown = null
  private inFlight: Promise<PushResult> | null = null
  private pollTimer: unknown = null

  constructor(options: CloudSaveOptions) {
    this.repository = options.repository
    this.local = options.local
    this.saveVersion = options.saveVersion
    this.resolver = options.resolver ?? newestWins
    this.now = options.now ?? Date.now
    this.minPushIntervalMs = options.minPushIntervalMs ?? DEFAULT_PUSH_INTERVAL_MS
    this.schedule = options.schedule ?? ((fn, ms) => setTimeout(fn, ms))
    this.cancel = options.cancel ?? (handle => clearTimeout(handle as ReturnType<typeof setTimeout>))
  }

  // --- observation --------------------------------------------------------

  snapshot(): CloudSaveSnapshot {
    return {
      status: this.status,
      userId: this.userId,
      revision: this.revision,
      lastSyncedAt: this.lastSyncedAt,
      message: this.message,
      pending: this.pending !== null,
    }
  }

  /** Subscribes to status changes and cloud-side saves. Returns an unsubscribe. */
  subscribe(listener: (event: CloudSaveEvent) => void): () => void {
    this.listeners.add(listener)
    listener({ type: 'status', snapshot: this.snapshot() })
    return () => {
      this.listeners.delete(listener)
    }
  }

  private emit(event: CloudSaveEvent): void {
    // A throwing listener is a bug in the UI, not a reason to break sync.
    for (const listener of [...this.listeners]) {
      try {
        listener(event)
      } catch {
        /* ignored on purpose */
      }
    }
  }

  private setStatus(status: SyncStatus, message: string | null = null): void {
    this.status = status
    this.message = message
    this.emit({ type: 'status', snapshot: this.snapshot() })
  }

  /** Marks the service as permanently local — no Supabase in this build. */
  disable(message: string): void {
    this.detach()
    this.setStatus('disabled', message)
  }

  // --- session lifecycle --------------------------------------------------

  /**
   * Reconciles this device with the account that just signed in.
   *
   * Empty account + local gym  → the gym is uploaded, so it survives a
   * reinstall. Account with a save + fresh device → the save comes down. Both
   * sides populated → `resolver` picks, defaulting to whichever was played
   * more recently.
   */
  async attach(userId: string): Promise<AttachResult> {
    this.userId = userId
    this.revision = null
    this.setStatus('syncing')

    try {
      const [remote, localRaw] = await Promise.all([
        this.repository.fetch(userId),
        this.local.read(),
      ])

      if (!remote) {
        if (!localRaw) {
          this.setStatus('synced')
          return { outcome: 'empty', revision: null, message: null }
        }
        const created = await this.repository.create(
          userId,
          parseState(localRaw),
          this.saveVersion,
        )
        this.revision = created.revision
        this.markWritten()
        return { outcome: 'uploaded', revision: created.revision, message: null }
      }

      if (!localRaw || this.resolver(parseState(localRaw), remote.state) === 'remote') {
        const raw = JSON.stringify(remote.state)
        await this.local.write(raw)
        this.revision = remote.revision
        this.markSynced()
        this.emit({ type: 'adopt', raw, revision: remote.revision, reason: 'first-login' })
        return { outcome: 'downloaded', revision: remote.revision, message: null }
      }

      const updated = await this.repository.update(
        userId,
        parseState(localRaw),
        this.saveVersion,
        remote.revision,
      )
      this.revision = updated.revision
      this.markWritten()
      return { outcome: 'uploaded', revision: updated.revision, message: null }
    } catch (cause) {
      const error = toCloudError(cause, 'offline')
      // A failed reconciliation must never cost the player their local gym, so
      // nothing local is touched and the session stays attached for a retry.
      this.setStatus(error.code === 'offline' ? 'offline' : 'error', error.message)
      return { outcome: 'failed', revision: null, message: error.message }
    }
  }

  /** Forgets the session. The local save stays exactly where it is. */
  detach(): void {
    this.stopPolling()
    if (this.timer !== null) {
      this.cancel(this.timer)
      this.timer = null
    }
    this.userId = null
    this.revision = null
    this.pending = null
    this.lastSyncedAt = null
    this.setStatus('local')
  }

  // --- writing ------------------------------------------------------------

  /**
   * Offers the current save to the cloud. Cheap to call on every autosave:
   * within the throttle window the state is only queued, and the queued value
   * is always the newest one offered.
   */
  push(raw: string): Promise<PushResult> {
    if (this.status === 'disabled' || !this.userId) {
      return Promise.resolve({ outcome: 'local-only', revision: null, message: null })
    }

    this.pending = raw

    const waited = this.now() - this.lastPushAt
    if (waited >= this.minPushIntervalMs) return this.flush()

    if (this.timer === null) {
      this.timer = this.schedule(() => {
        this.timer = null
        void this.flush()
      }, this.minPushIntervalMs - waited)
    }
    this.emit({ type: 'status', snapshot: this.snapshot() })
    return Promise.resolve({ outcome: 'queued', revision: this.revision, message: null })
  }

  /**
   * Sends whatever is queued right now, ignoring the throttle. Call this when
   * the app is going to the background or the player signs out.
   */
  flush(): Promise<PushResult> {
    // Serialising flushes is what keeps the revision bookkeeping sound: two
    // concurrent writes would both hold the same expected revision and one
    // would always lose the CAS for no reason.
    const run = (this.inFlight ?? Promise.resolve(null)).then(() => this.doFlush())
    this.inFlight = run
    void run.finally(() => {
      if (this.inFlight === run) this.inFlight = null
    })
    return run
  }

  private async doFlush(): Promise<PushResult> {
    if (this.status === 'disabled') {
      return { outcome: 'local-only', revision: null, message: null }
    }
    const userId = this.userId
    const raw = this.pending
    if (!userId) return { outcome: 'local-only', revision: null, message: null }
    if (raw === null) return { outcome: 'idle', revision: this.revision, message: null }

    if (this.timer !== null) {
      this.cancel(this.timer)
      this.timer = null
    }
    this.lastPushAt = this.now()
    this.setStatus('syncing')

    try {
      const state = parseState(raw)
      const record =
        this.revision === null
          ? await this.repository.create(userId, state, this.saveVersion)
          : await this.repository.update(userId, state, this.saveVersion, this.revision)

      this.revision = record.revision
      // A push that landed while this one was in flight must not be dropped.
      if (this.pending === raw) this.pending = null
      this.markWritten()
      return { outcome: 'saved', revision: record.revision, message: null }
    } catch (cause) {
      const error = toCloudError(cause, 'offline')

      if (error.code === 'conflict') {
        // Someone wrote a newer save. Taking theirs is the whole point of the
        // revision guard — forcing ours over it is what we are preventing.
        try {
          const adopted = await this.adoptRemote('conflict')
          this.pending = null
          return {
            outcome: 'conflict',
            revision: adopted?.revision ?? null,
            message: error.message,
          }
        } catch (readCause) {
          // Lost the race and then lost the connection. Keep `pending` and the
          // stale revision: the next flush conflicts again and retries the read.
          const readError = toCloudError(readCause, 'offline')
          this.setStatus('offline', readError.message)
          return { outcome: 'offline', revision: this.revision, message: readError.message }
        }
      }

      if (error.code === 'offline') {
        // Keep `pending` so the next flush retries with the newest state.
        this.setStatus('offline', error.message)
        return { outcome: 'offline', revision: this.revision, message: error.message }
      }

      this.setStatus('error', error.message)
      return { outcome: 'error', revision: this.revision, message: error.message }
    }
  }

  // --- reading ------------------------------------------------------------

  /** Downloads the cloud save unconditionally and emits it for adoption. */
  async pull(): Promise<{ revision: number } | null> {
    if (!this.userId) return null
    try {
      return await this.adoptRemote('remote-changed')
    } catch (cause) {
      const error = toCloudError(cause, 'offline')
      this.setStatus(error.code === 'offline' ? 'offline' : 'error', error.message)
      return null
    }
  }

  /**
   * Asks the cloud whether the save moved without us — another device, or a
   * server-side RPC crediting a purchase — and pulls it if so. Costs one
   * two-column read when nothing changed.
   */
  async poll(): Promise<{ revision: number } | null> {
    const userId = this.userId
    if (!userId || this.status === 'disabled') return null

    try {
      const stamp = await this.repository.stamp(userId)
      if (!stamp) return null
      if (this.revision !== null && stamp.revision <= this.revision) {
        if (this.status === 'offline' || this.status === 'error') this.markSynced()
        return null
      }
      return await this.adoptRemote('remote-changed')
    } catch (cause) {
      const error = toCloudError(cause, 'offline')
      this.setStatus(error.code === 'offline' ? 'offline' : 'error', error.message)
      return null
    }
  }

  /** Polls on an interval. Returns a stop function; safe to call twice. */
  startPolling(intervalMs: number): () => void {
    this.stopPolling()
    const tick = () => {
      void this.poll().finally(() => {
        if (this.pollTimer !== null) this.pollTimer = this.schedule(tick, intervalMs)
      })
    }
    this.pollTimer = this.schedule(tick, intervalMs)
    return () => this.stopPolling()
  }

  stopPolling(): void {
    if (this.pollTimer === null) return
    this.cancel(this.pollTimer)
    this.pollTimer = null
  }

  /** Releases timers. Call from a teardown path. */
  dispose(): void {
    this.stopPolling()
    if (this.timer !== null) {
      this.cancel(this.timer)
      this.timer = null
    }
    this.listeners.clear()
  }

  private async adoptRemote(reason: AdoptReason): Promise<{ revision: number } | null> {
    const userId = this.userId
    if (!userId) return null

    const record = await this.repository.fetch(userId)
    if (!record) {
      // The row vanished (account wipe). Our local save is now the only copy;
      // let the next push recreate it rather than deleting anything.
      this.revision = null
      this.markSynced()
      return null
    }

    const raw = JSON.stringify(record.state)
    await this.local.write(raw)
    this.revision = record.revision
    this.markSynced()
    this.emit({ type: 'adopt', raw, revision: record.revision, reason })
    return { revision: record.revision }
  }

  private markSynced(): void {
    this.lastSyncedAt = this.now()
    this.setStatus('synced')
  }

  /**
   * A successful write is also the start of the next throttle window. Without
   * this, the upload that reconciliation just performed would be followed by
   * another full write on the very next autosave.
   */
  private markWritten(): void {
    this.lastPushAt = this.now()
    this.markSynced()
  }
}

function parseState(raw: string): SaveState {
  try {
    return JSON.parse(raw) as SaveState
  } catch (cause) {
    throw new CloudError('unknown', 'Zapis na tym urządzeniu jest uszkodzony.', { cause })
  }
}
