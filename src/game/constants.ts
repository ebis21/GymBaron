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
export const PATIENCE_MS = 8_000
export const OFFLINE_CAP_MS = 8 * 60 * 60 * 1000
export const SAVE_VERSION = 2
export const SAVE_KEY = 'iron-empire-save'
export const XP_PER_LEVEL = 100
export const MAX_STEP_MS = 1_000
export const AUTOSAVE_MS = 5_000

/** Longest queue the gym will grow before newcomers stop showing up. */
export const MAX_QUEUE = 10

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
