import { currentLanguage, type Language } from '../i18n'
import type { Candidate, GameState, StaffRank, StaffRole } from './types'
import { nextRandom } from './rng'
import { STAFF_RANKS, STAFF_ROLES, hirePriceFor, roleUnlockLevel } from './content/staff'

export const POOL_SIZE = 3
export const REFRESH_PRICE = 500

/**
 * Relative odds, not percentages — the same shape as the client rarity table.
 * A legend turns up roughly once in twenty draws, so about once a week of play,
 * and by then the player needs five figures ready for the first wage.
 */
export const RANK_WEIGHT: Record<StaffRank, number> = {
  rare: 70,
  epic: 25,
  legend: 5,
}

const TOTAL_WEIGHT = STAFF_RANKS.reduce((sum, r) => sum + RANK_WEIGHT[r], 0)

/**
 * Drawn in whatever language the player is reading, because an English gym
 * staffed by Sławek and Iwona reads as an unfinished translation. The pools
 * are the same length so the same seed still draws the same *slot* — only the
 * word changes — and a name already on the payroll is never revisited: it was
 * written into the save the day that person was hired.
 */
export const FIRST_NAMES: Record<Language, string[]> = {
  pl: [
    'Marta', 'Piotr', 'Ola', 'Kamil', 'Zofia', 'Bartek',
    'Iwona', 'Rafał', 'Ewa', 'Damian', 'Kinga', 'Sławek',
  ],
  en: [
    'Martha', 'Peter', 'Olivia', 'Cameron', 'Sophie', 'Bart',
    'Yvonne', 'Ralph', 'Eve', 'Damien', 'Kim', 'Steve',
  ],
}

const SURNAME_INITIALS = ['K.', 'W.', 'D.', 'N.', 'S.', 'M.', 'L.', 'B.']

/**
 * The name as it should read right now. A name is written into the save the
 * moment somebody is drawn, so switching language would otherwise leave a
 * board of Camerons and Olivias under a Polish interface — and re-rolling the
 * board to fix it would hand out the 500 kr refresh for free.
 *
 * Instead the pools are parallel: the same slot in each is the same person,
 * so a stored name can be looked up in one and read out of the other. A name
 * from neither pool is left exactly as it is, which is what keeps a save from
 * an older build — or any name the pools stop offering — intact.
 */
export function displayName(stored: string, language: Language): string {
  const [first, ...rest] = stored.split(' ')
  if (!first) return stored

  for (const pool of Object.values(FIRST_NAMES)) {
    const slot = pool.indexOf(first)
    if (slot < 0) continue
    // Guarded rather than assumed: if the pools ever stop being the same
    // length, a name with no counterpart keeps the one it was drawn with
    // instead of rendering as a blank.
    const translated = FIRST_NAMES[language][slot]
    return translated ? [translated, ...rest].join(' ') : stored
  }
  return stored
}

function pick<T>(list: T[], seed: number): [T, number] {
  const [roll, next] = nextRandom(seed)
  const index = Math.min(list.length - 1, Math.floor(roll * list.length))
  return [list[index]!, next]
}

function rollRank(seed: number): [StaffRank, number] {
  const [roll, next] = nextRandom(seed)
  const target = roll * TOTAL_WEIGHT

  let acc = 0
  for (const rank of STAFF_RANKS) {
    acc += RANK_WEIGHT[rank]
    if (target < acc) return [rank, next]
  }
  return [STAFF_RANKS[STAFF_RANKS.length - 1]!, next]
}

/**
 * Roles the player could actually take on today. Trainers open at level 3 and
 * everyone else at 10, so a board drawn from the whole list would be mostly
 * people a level-3 player can only look at. Below every unlock the full list
 * stands in — the hiring app is locked at that point anyway, and an empty
 * board would be a stranger thing to hand back than an unusable one.
 */
export function unlockedRoles(state: GameState): StaffRole[] {
  const open = STAFF_ROLES.filter(role => state.level >= roleUnlockLevel(role))
  return open.length > 0 ? open : STAFF_ROLES
}

/** Draws a fresh board of candidates, threading the seed like the rest of the engine. */
export function rollPool(state: GameState): GameState {
  let seed = state.seed
  let uid = state.nextUid
  const candidates: Candidate[] = []
  const roles = unlockedRoles(state)

  for (let i = 0; i < POOL_SIZE; i += 1) {
    const [first, s1] = pick(FIRST_NAMES[currentLanguage()], seed)
    const [initial, s2] = pick(SURNAME_INITIALS, s1)
    const [role, s3] = pick(roles, s2)
    const [rank, s4] = rollRank(s3)
    seed = s4

    candidates.push({ uid: `k${uid}`, name: `${first} ${initial}`, role, rank, price: hirePriceFor(rank) })
    uid += 1
  }

  return { ...state, seed, nextUid: uid, candidates, candidatesDay: state.day }
}

/** Draws a board for today if the one on the table is from an earlier day. */
export function ensurePool(state: GameState): GameState {
  if (state.candidatesDay === state.day && state.candidates.length > 0) return state
  return rollPool(state)
}

export function refreshPool(state: GameState): GameState {
  if (state.cash < REFRESH_PRICE) return state

  const next = rollPool(state)
  return {
    ...next,
    cash: next.cash - REFRESH_PRICE,
    stats: { ...next.stats, totalSpent: next.stats.totalSpent + REFRESH_PRICE },
  }
}
