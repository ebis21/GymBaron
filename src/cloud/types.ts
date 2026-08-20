/**
 * The cloud layer speaks in opaque JSON. It deliberately knows nothing about
 * `GameState` — the engine in src/game stays pure TypeScript with no idea it
 * is being backed up, and this module stays testable without booting a gym.
 */
export type SaveState = unknown

/** A full save row as it exists in `public.game_saves`. */
export interface CloudSaveRecord {
  userId: string
  state: SaveState
  /** Bumped by the database on every write. See `stamp` for why that matters. */
  revision: number
  saveVersion: number
  updatedAt: string
}

/**
 * The cheap half of a save row. Polling this instead of the whole document is
 * how a client notices that something else — another device, or a server-side
 * RPC adjusting cash — moved the save on without downloading it every time.
 */
export interface CloudSaveStamp {
  revision: number
  updatedAt: string
}

export type CloudErrorCode =
  /** No network, or the request never reached Supabase. Retry later. */
  | 'offline'
  /** Compare-and-swap lost: the stored revision is not the one we expected. */
  | 'conflict'
  /** Signed out, expired session, or RLS refused the row. */
  | 'auth'
  /** VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are missing. */
  | 'not-configured'
  /** Supabase answered, but with a failure. */
  | 'server'
  | 'unknown'

/**
 * Everything the cloud layer throws. `message` is written for the player, in
 * Polish; `code` is what calling code should branch on.
 */
export class CloudError extends Error {
  readonly code: CloudErrorCode

  constructor(code: CloudErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'CloudError'
    this.code = code
  }
}

/**
 * The storage contract the sync service is built against. Supabase is one
 * implementation; the in-memory fake used by the tests is another, which is
 * what lets conflict and offline behaviour be tested without a network.
 *
 * Every method rejects with a `CloudError` and never with a bare Error, so a
 * caller can always branch on `code`.
 */
export interface SaveRepository {
  /** The full row, or null when this account has never saved. */
  fetch(userId: string): Promise<CloudSaveRecord | null>
  /** Revision and timestamp only — no state payload. */
  stamp(userId: string): Promise<CloudSaveStamp | null>
  /** First write for an account. Throws `conflict` if a save already exists. */
  create(userId: string, state: SaveState, saveVersion: number): Promise<CloudSaveRecord>
  /**
   * Overwrites the save only if it is still at `expectedRevision`, otherwise
   * throws `conflict`. This is the guard that stops a device that has been
   * offline for an hour from clobbering an hour of play on another one.
   */
  update(
    userId: string,
    state: SaveState,
    saveVersion: number,
    expectedRevision: number,
  ): Promise<CloudSaveRecord>
}

/**
 * The device-local save, which keeps working with no account and no network.
 * Backed by `src/store/storage.ts` in the app, by a plain object in tests.
 */
export interface LocalSaveStore {
  read(): Promise<string | null>
  write(raw: string): Promise<void>
}
