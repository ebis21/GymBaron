import type { Client, GameState } from './types'
import { initialState } from './economy'
import { SAVE_VERSION } from './constants'
import { DOOR_X, DOOR_QUEUE_ANCHOR } from './layout'

export function serialize(state: GameState): string {
  return JSON.stringify(state)
}

/** The shape every version has had since v1. Version is checked separately. */
function looksLikeSave(v: unknown): v is Record<string, unknown> {
  if (typeof v !== 'object' || v === null) return false
  const s = v as Record<string, unknown>
  return (
    typeof s.version === 'number' &&
    typeof s.cash === 'number' &&
    typeof s.reputation === 'number' &&
    typeof s.satisfaction === 'number' &&
    typeof s.level === 'number' &&
    typeof s.xp === 'number' &&
    typeof s.seed === 'number' &&
    typeof s.elapsedMs === 'number' &&
    typeof s.lastSeenAt === 'number' &&
    typeof s.gameOver === 'boolean' &&
    typeof s.nextUid === 'number' &&
    typeof s.day === 'number' &&
    typeof s.dayMs === 'number' &&
    typeof s.dayEnded === 'boolean' &&
    Array.isArray(s.machines) &&
    Array.isArray(s.decor) &&
    Array.isArray(s.walls) &&
    Array.isArray(s.inventory) &&
    Array.isArray(s.clients) &&
    Array.isArray(s.members) &&
    typeof s.today === 'object' && s.today !== null &&
    typeof s.stats === 'object' && s.stats !== null
  )
}

/**
 * Brings a version 3 save up to 4: staff, stains and the hiring pool did not
 * exist, and clients had no position because nobody walked anywhere. Wiping a
 * player's gym over a schema change is not an option, so the missing pieces
 * are filled in rather than the save thrown away.
 *
 * Migrated clients are parked at the door with an empty path. The next tick
 * re-routes them; a frame of standing still beats losing the save.
 */
function migrate(raw: Record<string, unknown>): GameState {
  const clients = (raw.clients as Client[]).map(c => ({
    ...c,
    x: DOOR_X,
    z: DOOR_QUEUE_ANCHOR.z,
    path: [],
    goal: null,
  }))

  return {
    ...(raw as unknown as GameState),
    version: SAVE_VERSION,
    clients,
    staff: [],
    stains: [],
    candidates: [],
    candidatesDay: 0,
  }
}

/**
 * Returns a fresh state on unparseable, malformed, or future-version input
 * rather than throwing — a corrupt save must never brick the app.
 */
export function deserialize(raw: string, now: number): GameState {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!looksLikeSave(parsed)) return initialState(now, now)

    const version = parsed.version as number
    if (version === SAVE_VERSION) return parsed as unknown as GameState
    if (version === 3) return migrate(parsed)

    return initialState(now, now)
  } catch {
    return initialState(now, now)
  }
}
