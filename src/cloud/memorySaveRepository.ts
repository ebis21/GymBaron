import {
  CloudError,
  type CloudSaveRecord,
  type CloudSaveStamp,
  type LocalSaveStore,
  type SaveRepository,
  type SaveState,
} from './types'

/**
 * An in-process stand-in for `game_saves`, used by the tests and usable as a
 * dev fixture when no Supabase project is at hand.
 *
 * It reproduces the two behaviours the sync logic actually depends on: the
 * revision trigger (every write bumps it by one) and the compare-and-swap
 * (an update at a stale revision is refused). Flip `offline` to make every
 * call fail the way a dead network does.
 */
export class MemorySaveRepository implements SaveRepository {
  offline = false
  /** Counts round trips, so tests can assert that polling stays cheap. */
  calls = { fetch: 0, stamp: 0, create: 0, update: 0 }

  private rows = new Map<string, CloudSaveRecord>()
  private clock = 0

  private guard(): void {
    if (this.offline) {
      throw new CloudError('offline', 'Brak połączenia z serwerem. Gra działa dalej offline.')
    }
  }

  private stampNow(): string {
    this.clock += 1000
    return new Date(this.clock).toISOString()
  }

  /** Seeds a row without going through the client path — for test setup. */
  seed(userId: string, state: SaveState, revision = 1, saveVersion = 0): CloudSaveRecord {
    const record: CloudSaveRecord = {
      userId,
      state: structuredClone(state),
      revision,
      saveVersion,
      updatedAt: this.stampNow(),
    }
    this.rows.set(userId, record)
    return record
  }

  /** Mimics an out-of-band writer, e.g. a server RPC topping up cash. */
  mutateExternally(userId: string, change: (state: SaveState) => SaveState): CloudSaveRecord {
    const current = this.rows.get(userId)
    if (!current) throw new CloudError('server', 'Brak zapisu do zmiany.')
    const next: CloudSaveRecord = {
      ...current,
      state: change(structuredClone(current.state)),
      revision: current.revision + 1,
      updatedAt: this.stampNow(),
    }
    this.rows.set(userId, next)
    return next
  }

  async fetch(userId: string): Promise<CloudSaveRecord | null> {
    this.calls.fetch += 1
    this.guard()
    const row = this.rows.get(userId)
    return row ? { ...row, state: structuredClone(row.state) } : null
  }

  async stamp(userId: string): Promise<CloudSaveStamp | null> {
    this.calls.stamp += 1
    this.guard()
    const row = this.rows.get(userId)
    return row ? { revision: row.revision, updatedAt: row.updatedAt } : null
  }

  async create(userId: string, state: SaveState, saveVersion: number): Promise<CloudSaveRecord> {
    this.calls.create += 1
    this.guard()
    if (this.rows.has(userId)) {
      throw new CloudError('conflict', 'W chmurze jest już zapis tego konta.')
    }
    return this.seed(userId, state, 1, saveVersion)
  }

  async update(
    userId: string,
    state: SaveState,
    saveVersion: number,
    expectedRevision: number,
  ): Promise<CloudSaveRecord> {
    this.calls.update += 1
    this.guard()
    const current = this.rows.get(userId)
    if (!current || current.revision !== expectedRevision) {
      throw new CloudError('conflict', 'W chmurze jest nowsza wersja zapisu. Pobieram ją.')
    }
    return this.seed(userId, state, current.revision + 1, saveVersion)
  }
}

/** The local save, in memory. Same contract as the Preferences-backed one. */
export class MemoryLocalStore implements LocalSaveStore {
  writes = 0

  constructor(private raw: string | null = null) {}

  async read(): Promise<string | null> {
    return this.raw
  }

  async write(raw: string): Promise<void> {
    this.writes += 1
    this.raw = raw
  }

  peek(): string | null {
    return this.raw
  }
}
