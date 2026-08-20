import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import { toCloudError } from './messages'
import {
  CloudError,
  type CloudSaveRecord,
  type CloudSaveStamp,
  type SaveRepository,
  type SaveState,
} from './types'

const TABLE = 'game_saves'
const COLUMNS = 'user_id, state, revision, save_version, updated_at'

interface Row {
  user_id: string
  state: SaveState
  revision: number
  save_version: number
  updated_at: string
}

function toRecord(row: Row): CloudSaveRecord {
  return {
    userId: row.user_id,
    state: row.state,
    // `bigint` arrives as a JS number through PostgREST. Revisions counting
    // one per save will not reach 2^53 in any human lifetime of play.
    revision: Number(row.revision),
    saveVersion: Number(row.save_version),
    updatedAt: row.updated_at,
  }
}

/** Postgres unique-violation — the row was created between our check and write. */
function isDuplicate(error: PostgrestError): boolean {
  return error.code === '23505'
}

/**
 * `game_saves` seen through PostgREST. Every method translates failures into
 * `CloudError`, so nothing above this layer has to know what a PostgrestError
 * looks like.
 */
export class SupabaseSaveRepository implements SaveRepository {
  constructor(private readonly client: SupabaseClient) {}

  async fetch(userId: string): Promise<CloudSaveRecord | null> {
    try {
      const { data, error } = await this.client
        .from(TABLE)
        .select(COLUMNS)
        .eq('user_id', userId)
        .maybeSingle<Row>()

      if (error) throw toCloudError(error, 'server')
      return data ? toRecord(data) : null
    } catch (cause) {
      throw toCloudError(cause, 'offline')
    }
  }

  async stamp(userId: string): Promise<CloudSaveStamp | null> {
    try {
      const { data, error } = await this.client
        .from(TABLE)
        .select('revision, updated_at')
        .eq('user_id', userId)
        .maybeSingle<Pick<Row, 'revision' | 'updated_at'>>()

      if (error) throw toCloudError(error, 'server')
      if (!data) return null
      return { revision: Number(data.revision), updatedAt: data.updated_at }
    } catch (cause) {
      throw toCloudError(cause, 'offline')
    }
  }

  async create(userId: string, state: SaveState, saveVersion: number): Promise<CloudSaveRecord> {
    try {
      const { data, error } = await this.client
        .from(TABLE)
        .insert({ user_id: userId, state, save_version: saveVersion })
        .select(COLUMNS)
        .single<Row>()

      if (error) {
        // Somebody else got there first: another device, or a second tab. The
        // caller's answer to that is the same as for a lost CAS — go and read
        // what is actually stored.
        if (isDuplicate(error)) {
          throw new CloudError('conflict', 'W chmurze jest już zapis tego konta.', { cause: error })
        }
        throw toCloudError(error, 'server')
      }
      if (!data) throw new CloudError('server', 'Serwer nie zwrócił zapisanego stanu.')
      return toRecord(data)
    } catch (cause) {
      throw toCloudError(cause, 'offline')
    }
  }

  async update(
    userId: string,
    state: SaveState,
    saveVersion: number,
    expectedRevision: number,
  ): Promise<CloudSaveRecord> {
    try {
      // The compare-and-swap is the `eq('revision', ...)`: if the stored
      // revision moved on, the UPDATE matches no rows and PostgREST returns an
      // empty set rather than an error. That empty set *is* the conflict.
      const { data, error } = await this.client
        .from(TABLE)
        .update({ state, save_version: saveVersion })
        .eq('user_id', userId)
        .eq('revision', expectedRevision)
        .select(COLUMNS)
        .maybeSingle<Row>()

      if (error) throw toCloudError(error, 'server')
      if (!data) {
        throw new CloudError(
          'conflict',
          'W chmurze jest nowsza wersja zapisu. Pobieram ją.',
        )
      }
      return toRecord(data)
    } catch (cause) {
      throw toCloudError(cause, 'offline')
    }
  }
}
