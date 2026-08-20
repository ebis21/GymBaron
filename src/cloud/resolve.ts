import type { SaveState } from './types'

export type SaveWinner = 'local' | 'remote'

/**
 * Decides which save survives when a player signs in on a device that already
 * has a gym and the account already has one too.
 */
export type ConflictResolver = (local: SaveState, remote: SaveState) => SaveWinner

function lastSeenAt(state: SaveState): number {
  if (typeof state !== 'object' || state === null) return -Infinity
  const value = (state as Record<string, unknown>).lastSeenAt
  return typeof value === 'number' && Number.isFinite(value) ? value : -Infinity
}

/**
 * Newest wall-clock save wins, with ties going to the cloud.
 *
 * `lastSeenAt` is stamped on every autosave, so it is the closest thing the
 * save has to "when did this player last actually play this". The tie-break
 * leans on the cloud deliberately: a server-side RPC can change the stored
 * state (a purchase crediting cash) without touching `lastSeenAt`, and losing
 * a paid-for change is worse than replaying a few seconds of gym management.
 */
export const newestWins: ConflictResolver = (local, remote) =>
  lastSeenAt(local) > lastSeenAt(remote) ? 'local' : 'remote'

/** Always keeps what is already in the cloud. */
export const remoteWins: ConflictResolver = () => 'remote'

/** Always pushes this device's save up. Use only where the player asked for it. */
export const localWins: ConflictResolver = () => 'local'
