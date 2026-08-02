import type { GameState } from './types'
import { initialState } from './economy'
import { SAVE_VERSION } from './constants'

export function serialize(state: GameState): string {
  return JSON.stringify(state)
}

function isGameState(v: unknown): v is GameState {
  if (typeof v !== 'object' || v === null) return false
  const s = v as Record<string, unknown>
  return (
    s.version === SAVE_VERSION &&
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
    Array.isArray(s.clients) &&
    Array.isArray(s.members) &&
    typeof s.today === 'object' && s.today !== null &&
    typeof s.stats === 'object' && s.stats !== null
  )
}

/**
 * Returns a fresh state on unparseable, malformed, or unknown-version input
 * rather than throwing — a corrupt save must never brick the app.
 */
export function deserialize(raw: string, now: number): GameState {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isGameState(parsed)) return initialState(now, now)
    return parsed
  } catch {
    return initialState(now, now)
  }
}
