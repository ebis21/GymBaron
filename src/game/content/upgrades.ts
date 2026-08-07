import { PATIENCE_MS } from '../constants'

/**
 * The five things the player can pay to get better at. Four of them sharpen
 * something they already do by hand; `earnings` and `luck` bend the economy
 * itself.
 */
export type UpgradeId = 'cleaning' | 'repair' | 'earnings' | 'luck' | 'patience'

export interface UpgradeLevel {
  /** What the track is worth once this rung is paid for. */
  value: number
  /** Cost of moving up to this rung. */
  price: number
}

export interface UpgradeTrack {
  id: UpgradeId
  /** Value at level 0 — the game exactly as it ships. */
  base: number
  /** One entry per purchasable rung; `levels[0]` is what the first buy gives. */
  levels: UpgradeLevel[]
}

/**
 * Wiping a stain takes this long to hold. The cheapest track on the board: a
 * faster mop saves the player's own time, never money, so the first rung is
 * within reach of a gym that has only just opened.
 */
const CLEANING: UpgradeTrack = {
  id: 'cleaning',
  base: 3000,
  levels: [
    { value: 2500, price: 600 },
    { value: 2000, price: 1_800 },
    { value: 1500, price: 5_000 },
    { value: 1000, price: 14_000 },
    { value: 500, price: 40_000 },
  ],
}

/**
 * Fixing dead kit. Dearer than cleaning at every rung, because a broken machine
 * earns nothing at all while a stain merely drags on reputation.
 *
 * The base is 6s where the game used to hold 5s. Deliberate: the ladder has to
 * start above today's value or the first purchase would buy nothing. Repairing
 * without upgrades is a second slower than it was — that is the price of the
 * track existing.
 */
const REPAIR: UpgradeTrack = {
  id: 'repair',
  base: 6000,
  levels: [
    { value: 5500, price: 800 },
    { value: 5000, price: 2_200 },
    { value: 4500, price: 6_000 },
    { value: 4000, price: 15_000 },
    { value: 3500, price: 35_000 },
    { value: 3000, price: 80_000 },
    { value: 2000, price: 150_000 },
  ],
}

/**
 * A flat multiplier on the door fee — passes are priced by the gym class alone
 * and stay out of this.
 *
 * The last two rungs add a whole point each where the earlier ones add a fifth,
 * five times the gain, and the prices jump to match. ×4.0 costs more than
 * unlocking a whole storey (`FLOOR_UNLOCK_COST`) on purpose: it is the thing
 * the endgame is for, not the next line on a shopping list.
 */
const EARNINGS: UpgradeTrack = {
  id: 'earnings',
  base: 1,
  levels: [
    { value: 1.2, price: 2_500 },
    { value: 1.4, price: 8_000 },
    { value: 1.6, price: 22_000 },
    { value: 1.8, price: 55_000 },
    { value: 2.0, price: 120_000 },
    { value: 3.0, price: 400_000 },
    { value: 4.0, price: 1_200_000 },
  ],
}

/**
 * Weights the rarity table towards the good tiers and nudges walk-ins into
 * buying a pass. Priced alongside `earnings` because at the top it is worth
 * about as much: ×4.0 lifts the average rarity multiplier from 1.57 to 2.47.
 */
const LUCK: UpgradeTrack = {
  id: 'luck',
  base: 1,
  levels: [
    { value: 1.5, price: 6_000 },
    { value: 2.0, price: 25_000 },
    { value: 3.0, price: 120_000 },
    { value: 4.0, price: 500_000 },
  ],
}

/**
 * How long somebody waits at the desk before walking out. Closes the set:
 * cleaning and repair are tempo, earnings and luck are money, this one is
 * keeping the client who already walked in. It is also the only track that
 * helps a player running the length of the hall on foot.
 */
const PATIENCE: UpgradeTrack = {
  id: 'patience',
  base: PATIENCE_MS,
  levels: [
    { value: 30_000, price: 1_500 },
    { value: 35_000, price: 5_000 },
    { value: 42_000, price: 16_000 },
    { value: 50_000, price: 45_000 },
  ],
}

/** Board order — the upgrades screen prints them exactly like this. */
export const UPGRADES: UpgradeTrack[] = [CLEANING, REPAIR, EARNINGS, LUCK, PATIENCE]

export const UPGRADE_IDS: UpgradeId[] = UPGRADES.map(u => u.id)

const BY_ID = new Map<UpgradeId, UpgradeTrack>(UPGRADES.map(u => [u.id, u]))

export function upgradeTrack(id: UpgradeId): UpgradeTrack {
  const track = BY_ID.get(id)
  if (!track) throw new Error(`Unknown upgrade: ${id}`)
  return track
}

/** Every track at zero — a gym that has bought nothing yet. */
export const emptyUpgrades = (): Record<UpgradeId, number> => ({
  cleaning: 0,
  repair: 0,
  earnings: 0,
  luck: 0,
  patience: 0,
})

export const maxLevel = (id: UpgradeId): number => upgradeTrack(id).levels.length

/**
 * Tolerates rubbish, exactly like `expansionAt`: a save hand-edited to level 99
 * gets the highest legal rung rather than an undefined one, and the game keeps
 * running.
 */
const clampLevel = (id: UpgradeId, level: number): number =>
  Math.max(0, Math.min(maxLevel(id), Math.floor(level) || 0))

/** What the track is worth at a given level. Level 0 is the base value. */
export function upgradeValueAt(id: UpgradeId, level: number): number {
  const track = upgradeTrack(id)
  const rung = clampLevel(id, level)
  return rung === 0 ? track.base : track.levels[rung - 1]!.value
}

/** The rung on offer next, or null once the track is maxed out. */
export function nextUpgrade(id: UpgradeId, level: number): UpgradeLevel | null {
  const track = upgradeTrack(id)
  const rung = clampLevel(id, level)
  return rung < track.levels.length ? track.levels[rung]! : null
}
