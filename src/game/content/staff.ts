import type { StaffRank, StaffRole } from '../types'
import { STAFF_UNLOCK_LEVEL, TRAINER_UNLOCK_LEVEL } from '../constants'

export const STAFF_ROLES: StaffRole[] = ['reception', 'cleaner', 'repair', 'trainer']
export const STAFF_RANKS: StaffRank[] = ['rare', 'epic', 'legend']

/** Most the player may have on the payroll at once. */
export const STAFF_LIMIT = 5

// Job titles live in `src/i18n` under `content.roles` — the panel and the tag
// over the employee's head print the same word, and both follow the language.

/**
 * Automation unlocks late — see `STAFF_UNLOCK_LEVEL`. The trainer is the one
 * exception: they play none of the game for the player, they only make a
 * choice at the desk pay off, so they arrive far earlier.
 */
export const ROLE_UNLOCK_LEVEL: Record<StaffRole, number> = {
  reception: STAFF_UNLOCK_LEVEL,
  cleaner: STAFF_UNLOCK_LEVEL,
  repair: STAFF_UNLOCK_LEVEL,
  trainer: TRAINER_UNLOCK_LEVEL,
}

export const roleUnlockLevel = (role: StaffRole): number => ROLE_UNLOCK_LEVEL[role]

/**
 * Left in English on purpose: these are the same words printed on the tags
 * over clients' heads, and a player reads the two as one system.
 */
export const RANK_LABEL: Record<StaffRank, string> = {
  rare: 'RARE',
  epic: 'EPIC',
  legend: 'LEGEND',
}

/** World units per second. The hall is 20 across, so this is keenly felt. */
export const WALK_SPEED: Record<StaffRank, number> = {
  rare: 1.6,
  epic: 2.2,
  legend: 3.0,
}

/**
 * How long one job takes, by role and rank. Coaching has no such timer — a
 * trainer is booked for a whole visit and finishes when the client leaves — so
 * the trainer row is never read by anything. It is here because the Record
 * demands a value for every role, and it mirrors reception's numbers so the
 * table's "a higher rank is never slower" invariant still reads true.
 */
export const WORK_MS: Record<StaffRole, Record<StaffRank, number>> = {
  reception: { rare: 4000, epic: 2500, legend: 1500 },
  cleaner: { rare: 6000, epic: 4000, legend: 2500 },
  repair: { rare: 12_000, epic: 8000, legend: 5000 },
  trainer: { rare: 4000, epic: 2500, legend: 1500 },
}

/**
 * Priced against what the gym actually takes in a day, measured rather than
 * guessed: a four-machine gym in its first week grosses around 4 000, a
 * ten-machine one around 11 000, and a full twenty-machine floor around 21 000
 * of which the evening bill claims barely 1 500.
 *
 * The old table read 1 000 / 5 000 / 10 000 against an assumed 12 000-a-day
 * gym, which put a three-person epic crew at 22 500 and a legendary one at
 * 45 000 — both more than the very best gym in the game can earn. Every
 * automated gym ran at a permanent loss and the top two ranks were unbuyable
 * rather than aspirational.
 *
 * At these rates a full crew of three costs roughly 40% of the takings at the
 * tier that would hire it, so automation is a real bite out of the day's profit
 * and still leaves one.
 */
export const RANK_WAGE: Record<StaffRank, number> = {
  rare: 400,
  epic: 1000,
  legend: 2000,
}

/**
 * A trainer is priced against what a booking actually adds, not against the
 * other roles. The extra half of a door fee is worth ~17 early on (a 1.25×
 * machine, an average walk-in), and one trainer can see a client through at
 * most a dozen or so visits in a 12-hour day — so a rare trainer at 200 a day
 * is paid back by about twelve bookings and turns a profit only on a busy
 * floor. It grows into real money as the kit and the reputation do, which is
 * exactly the shape wanted: worth booking, never free money.
 */
export const ROLE_WAGE_MULT: Record<StaffRole, number> = {
  reception: 1.0,
  cleaner: 1.5,
  repair: 2.0,
  // Half, not the old fifth: the trainer was the one role already priced off
  // what it earns rather than off `RANK_WAGE`, so when the ranks came down it
  // had to move the other way to keep a rare trainer at the same 200 a day the
  // dozen-bookings sum below arrives at.
  trainer: 0.5,
}

export const wageFor = (role: StaffRole, rank: StaffRank): number =>
  RANK_WAGE[rank] * ROLE_WAGE_MULT[role]

/**
 * One-time hiring cost, by rank only — the wage already prices the role in.
 * Set against `RANK_WAGE`: a rare costs a day and a half of its own pay, a
 * legend two and a half, so signing the better name is a commitment without
 * being a wall. A rare also has to cost more than `REFRESH_PRICE`, or rerolling
 * the board would be the expensive half of hiring.
 */
export const RANK_HIRE_PRICE: Record<StaffRank, number> = {
  rare: 600,
  epic: 2000,
  legend: 5000,
}

export const hirePriceFor = (rank: StaffRank): number => RANK_HIRE_PRICE[rank]

export const workMsFor = (role: StaffRole, rank: StaffRank): number => WORK_MS[role][rank]

export const speedFor = (rank: StaffRank): number => WALK_SPEED[rank]
