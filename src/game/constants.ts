/**
 * The floor the gym opens with. Both grow when the player buys an expansion —
 * see `content/expansion.ts` for the ladder and `layout.ts` for the live
 * dimensions everything else reads. These two stay the *base* size, so a save
 * at expansion level 0 is exactly the room this game has always shipped with.
 */
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
 *
 * This is the *base*, level 0 of the `patience` upgrade track. What the engine
 * actually reads is `patienceMs(state)` — see `content/upgrades.ts`.
 */
export const PATIENCE_MS = 26_000
export const OFFLINE_CAP_MS = 8 * 60 * 60 * 1000
export const SAVE_VERSION = 9
/**
 * Deliberately still the old name. This is a storage key, not a label — nobody
 * ever sees it, and renaming it would orphan the save of every player who
 * already has one. It stays `iron-empire-save` for as long as those saves are
 * worth keeping.
 */
export const SAVE_KEY = 'iron-empire-save'
export const XP_PER_LEVEL = 100
export const MAX_STEP_MS = 1_000
export const AUTOSAVE_MS = 5_000

// --- Floors ----------------------------------------------------------------

/** Price of turning the wall lock into access to the next storey. */
export const FLOOR_UNLOCK_COST = 100_000
/** Ground floor plus the first upper floor; the data model is ready for more. */
export const MAX_FLOORS = 2

/** Longest queue the gym will grow before newcomers stop showing up. */
export const MAX_QUEUE = 10

// --- Secret visitors -------------------------------------------------------

/** The stack LIL D. flashes at reception before the notes fail inspection. */
export const LIL_D_FAKE_PAYMENT = 300
/** He deliberately ties up every station three seconds longer than anyone else. */
export const LIL_D_EXTRA_WORKOUT_MS = 3_000
/** Per-second chance while the gym can accept him; capped to one visit per day. */
export const LIL_D_SPAWN_CHANCE = 0.004

// --- Ambient dirt ------------------------------------------------------------

/**
 * How often the floor gets a chance to pick up ambient dirt, regardless of
 * machine use — footfall tracked in from across the whole gym.
 */
export const AMBIENT_DIRT_INTERVAL_MS = 1_000
/**
 * Odds, each interval, that a random clean tile gets a stain. Cut hard from
 * the original 0.04: mopping was turning into the whole game, and dirt is
 * meant to be a chore the player notices, not the one they spend the day on.
 */
export const AMBIENT_DIRT_CHANCE = 0.012
/**
 * Ambient spawning stops once the floor is this dirty — a busy machine can
 * still leave a stain on top, but wandering grime alone won't spiral past it.
 */
export const AMBIENT_DIRT_MAX_STAINS = 3

// --- Economy ---------------------------------------------------------------

/** Sticker price of a single visit, before the machine multiplier. */
export const ENTRY_FEE_BASE = 20
/**
 * Members pay half the door price — that is what the pass buys them. It used
 * to be a tenth, which made every pass sold a hole in the day's takings: a
 * member visited more often than a walk-in *and* paid almost nothing, so
 * growing the membership actively made the gym poorer.
 */
export const MEMBER_DISCOUNT = 0.5
/** Face value of a membership pass, before the gym-class multiplier. */
export const MEMBER_FEE = 200
/** Towels, water, cleaning — charged per member on every day's bill. */
export const MEMBER_UPKEEP = 14
export const BILLING_PERIOD_DAYS = 7
export const DAILY_RENT = 60

/**
 * How much a spotless reputation is worth at the till. A gym everyone talks
 * about can charge more than a gym nobody has heard of — but only a little, so
 * reputation stays a multiplier on good play rather than the game itself. At
 * reputation 0 the door fee is unchanged; at 100 it is a quarter better.
 */
export const REP_REVENUE_BONUS = 0.25

/**
 * What a client pays when the player books them a personal trainer. The extra
 * half is the trainer's session on top of the door fee — see
 * `Client.trainerUid` and the `trainer` staff role.
 */
export const TRAINER_FEE_MULT = 1.5

/** A coached session also leaves people happier than the same workout alone. */
export const TRAINER_SATISFACTION_MULT = 1.5

/**
 * Game time the simulation keeps running past 20:00 so whoever is still
 * mid-workout can finish and walk out. Nobody new is admitted in this window;
 * it exists only so the day does not freeze with people stranded on the kit.
 * The longest workout is 22s and the hall takes a few seconds to cross, so a
 * minute is comfortably enough for the floor to empty itself.
 */
export const CLOSING_DRAIN_MS = 60_000

/**
 * Automation is a late-game system: the player needs a room, a routine and a
 * cash cushion before payroll makes sense. Locked below this level, same idea
 * as `MachineType.minLevel` but for a whole role rather than one item.
 */
export const STAFF_UNLOCK_LEVEL = 10

/**
 * Trainers are the exception. They automate nothing — they are a *choice* the
 * player makes at the desk, one client at a time — so they land far earlier
 * than the roles that play the game for you.
 */
export const TRAINER_UNLOCK_LEVEL = 3

/** Earliest level at which any role at all can be hired; gates the phone app. */
export const HIRING_UNLOCK_LEVEL = Math.min(STAFF_UNLOCK_LEVEL, TRAINER_UNLOCK_LEVEL)
