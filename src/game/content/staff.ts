import type { StaffRank, StaffRole } from '../types'
import { STAFF_UNLOCK_LEVEL, TRAINER_UNLOCK_LEVEL } from '../constants'

export const STAFF_ROLES: StaffRole[] = ['reception', 'cleaner', 'repair', 'trainer']
export const STAFF_RANKS: StaffRank[] = ['rare', 'epic', 'legend']

/** Most the player may have on the payroll at once. */
export const STAFF_LIMIT = 5

export const ROLE_LABEL: Record<StaffRole, string> = {
  reception: 'Recepcjonista',
  cleaner: 'Sprzątacz',
  repair: 'Naprawa',
  trainer: 'Trener personalny',
}

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
 * Wages are deliberately steep against the rest of the economy. A mature gym
 * nets around 12 000 a day, so a rare receptionist is a considered purchase
 * and a legendary repairer costs more than such a gym earns — the top rank is
 * a trophy for a far bigger operation, not the next thing on the shopping list.
 */
export const RANK_WAGE: Record<StaffRank, number> = {
  rare: 1000,
  epic: 5000,
  legend: 10_000,
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
  trainer: 0.2,
}

export const wageFor = (role: StaffRole, rank: StaffRank): number =>
  RANK_WAGE[rank] * ROLE_WAGE_MULT[role]

/**
 * One-time hiring cost, by rank only — the wage already prices the role in.
 * A rare sits around the priciest machine in the shop; a legend is a real
 * commitment, in line with what `RANK_WAGE` already asks of the player daily.
 */
export const RANK_HIRE_PRICE: Record<StaffRank, number> = {
  rare: 1200,
  epic: 4000,
  legend: 9000,
}

export const hirePriceFor = (rank: StaffRank): number => RANK_HIRE_PRICE[rank]

export const workMsFor = (role: StaffRole, rank: StaffRank): number => WORK_MS[role][rank]

export const speedFor = (rank: StaffRank): number => WALK_SPEED[rank]
