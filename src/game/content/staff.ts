import type { StaffRank, StaffRole } from '../types'

export const STAFF_ROLES: StaffRole[] = ['reception', 'cleaner', 'repair']
export const STAFF_RANKS: StaffRank[] = ['rare', 'epic', 'legend']

/** Most the player may have on the payroll at once. */
export const STAFF_LIMIT = 5

export const ROLE_LABEL: Record<StaffRole, string> = {
  reception: 'Recepcjonista',
  cleaner: 'Sprzątacz',
  repair: 'Naprawa',
}

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

/** How long one job takes, by role and rank. */
export const WORK_MS: Record<StaffRole, Record<StaffRank, number>> = {
  reception: { rare: 4000, epic: 2500, legend: 1500 },
  cleaner: { rare: 6000, epic: 4000, legend: 2500 },
  repair: { rare: 12_000, epic: 8000, legend: 5000 },
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

export const ROLE_WAGE_MULT: Record<StaffRole, number> = {
  reception: 1.0,
  cleaner: 1.5,
  repair: 2.0,
}

export const wageFor = (role: StaffRole, rank: StaffRank): number =>
  RANK_WAGE[rank] * ROLE_WAGE_MULT[role]

export const workMsFor = (role: StaffRole, rank: StaffRank): number => WORK_MS[role][rank]

export const speedFor = (rank: StaffRank): number => WALK_SPEED[rank]
