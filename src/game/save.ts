import type { Client, GameState, Machine } from './types'
import { initialState } from './economy'
import { SAVE_VERSION } from './constants'
import { DOOR_X, DOOR_QUEUE_ANCHOR } from './layout'

export function serialize(state: GameState): string {
  return JSON.stringify(state)
}

/**
 * Structural shape common to every version since v1. Checked before the
 * version is known, so it must stop at fields v3 already had — a v3 save
 * legitimately lacks the v4 ones, and `migrate` is what fills those in.
 */
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
 * Fields introduced in v4, checked only once a save claims to be at least v4 —
 * a save at that version missing them is not an old save waiting to migrate,
 * it is corrupt (hand-edited storage, a future write bug, truncated data) and
 * must be rejected rather than handed to the app with `staff` etc. undefined.
 */
function looksLikeV4(s: Record<string, unknown>): boolean {
  return (
    Array.isArray(s.staff) &&
    Array.isArray(s.stains) &&
    Array.isArray(s.candidates) &&
    typeof s.candidatesDay === 'number'
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
function migrateV3(raw: Record<string, unknown>): Record<string, unknown> {
  const clients = (raw.clients as Client[]).map(c => ({
    ...c,
    x: DOOR_X,
    z: DOOR_QUEUE_ANCHOR.z,
    path: [],
    goal: null,
  }))

  return {
    ...raw,
    version: 4,
    clients,
    staff: [],
    stains: [],
    candidates: [],
    candidatesDay: 0,
  }
}

/**
 * Brings a version 4 save up to 5: machines gained a broken-for clock that
 * decides when neglect starts costing reputation. Existing kit starts the
 * clock at zero, which hands the player back the full grace window on
 * whatever was already broken — the generous side of the rounding.
 */
function migrateV4(raw: Record<string, unknown>): Record<string, unknown> {
  const machines = (raw.machines as Machine[]).map(m => ({ ...m, brokenMs: 0 }))
  return { ...raw, version: 5, machines }
}

/** Adds neutral bookkeeping for the secret visitor and counterfeit cash. */
function migrateV5(raw: Record<string, unknown>): Record<string, unknown> {
  const today = raw.today as Record<string, unknown>
  const previousReport = raw.dayReport
  const dayReport = typeof previousReport === 'object' && previousReport !== null
    ? { ...previousReport, counterfeitLoss: 0 }
    : previousReport

  return {
    ...raw,
    version: 6,
    lilDSeenDay: 0,
    today: { ...today, counterfeitLoss: 0 },
    dayReport,
  }
}

function looksLikeV6(s: Record<string, unknown>): boolean {
  const today = s.today as Record<string, unknown>
  const report = s.dayReport
  const reportOkay = report === null || (
    typeof report === 'object' &&
    typeof (report as Record<string, unknown>).counterfeitLoss === 'number'
  )

  return (
    typeof s.lilDSeenDay === 'number' &&
    typeof today.counterfeitLoss === 'number' &&
    reportOkay
  )
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
    if (version > SAVE_VERSION || version < 3) return initialState(now, now)

    // Migrations chain, so a v3 save walks up through every step rather than
    // needing its own path to the current version.
    let state = parsed
    if (state.version === 3) state = migrateV3(state)
    // Only meaningful once the save is at v4's shape, which is also the point
    // the v4 fields become required rather than pending migration.
    if (!looksLikeV4(state)) return initialState(now, now)
    if (state.version === 4) state = migrateV4(state)
    if (state.version === 5) state = migrateV5(state)
    if (!looksLikeV6(state)) return initialState(now, now)

    return state as unknown as GameState
  } catch {
    return initialState(now, now)
  }
}
