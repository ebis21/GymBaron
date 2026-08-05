export const GRID_W = 8
export const GRID_H = 6
/**
 * One in-game hour is 30 real seconds, so a day running 8:00 → 20:00 takes
 * 6 real minutes and a 7-day billing period lands at 42 minutes.
 */
export const HOUR_MS = 30_000
export const DAY_START_HOUR = 8
export const DAY_END_HOUR = 20
export const DAY_HOURS = DAY_END_HOUR - DAY_START_HOUR
export const DAY_MS = DAY_HOURS * HOUR_MS

export const START_CASH = 500
export const DEBT_LIMIT = -20_000
/**
 * How long somebody waits at the desk before walking out. Generous on
 * purpose: the player has a whole room to cross, and losing a visitor because
 * they were three tiles away reads as a punishment for moving around.
 */
export const PATIENCE_MS = 26_000
export const OFFLINE_CAP_MS = 8 * 60 * 60 * 1000
export const SAVE_VERSION = 4
export const SAVE_KEY = 'iron-empire-save'
export const XP_PER_LEVEL = 100
export const MAX_STEP_MS = 1_000
export const AUTOSAVE_MS = 5_000

/** Longest queue the gym will grow before newcomers stop showing up. */
export const MAX_QUEUE = 10

// --- Ambient dirt ------------------------------------------------------------

/**
 * How often the floor gets a chance to pick up ambient dirt, regardless of
 * machine use — footfall tracked in from across the whole gym.
 */
export const AMBIENT_DIRT_INTERVAL_MS = 1_000
/** Odds, each interval, that a random clean tile gets a stain. */
export const AMBIENT_DIRT_CHANCE = 0.04
/**
 * Ambient spawning stops once the floor is this dirty — a busy machine can
 * still leave a stain on top, but wandering grime alone won't spiral past it.
 */
export const AMBIENT_DIRT_MAX_STAINS = 6

// --- Economy ---------------------------------------------------------------

/** Sticker price of a single visit, before the machine multiplier. */
export const ENTRY_FEE_BASE = 20
/** Members pay a tenth of the door price — that is what the pass buys them. */
export const MEMBER_DISCOUNT = 0.1
/** Face value of a membership pass, before the gym-class multiplier. */
export const MEMBER_FEE = 200
/** Towels, water, cleaning — charged per member on every day's bill. */
export const MEMBER_UPKEEP = 14
export const BILLING_PERIOD_DAYS = 7
export const DAILY_RENT = 60

/**
 * Staff is a late-game system: the player needs a room, a routine and a cash
 * cushion before payroll makes sense. Locked below this level, same idea as
 * `MachineType.minLevel` but for the whole hiring flow rather than one item.
 */
export const STAFF_UNLOCK_LEVEL = 10
