import type { Client, GameState, Machine } from './types'
import { initialState } from './economy'
import { SAVE_VERSION } from './constants'
import { DOOR_QUEUE_Z, doorX } from './layout'
import { floorPlanFrom, snapshotActiveFloor } from './floors'
import { emptyUpgrades, UPGRADE_IDS } from './content/upgrades'
import { emptyDiamondUpgrades } from './diamondUpgrades'
import { initialMarketing, normalizeMarketing } from './marketing'
import { initialContracts, normalizeContracts } from './contracts'
import { initialSponsors, normalizeSponsors } from './sponsors'
import { initialPremiumState } from './premium'
import { PREMIUM_PRODUCTS } from '../storefront/catalog'

export function serialize(state: GameState): string {
  // The engine works on a top-level mirror of the active room. Refresh its
  // stored plan at the last possible moment so autosaves never lag behind a
  // placement, stain, repair, or expansion.
  return JSON.stringify(snapshotActiveFloor(state))
}

/**
 * Structural shape common to every version since v1. Checked before the
 * version is known, so it must stop at fields v3 already had — a v3 save
 * legitimately lacks the v4 ones, and `migrate` is what fills those in.
 */
function looksLikeSave(v: unknown): v is Record<string, unknown> {
  if (typeof v !== 'object' || v === null) return false
  const s = v as Record<string, unknown>
  return (
    typeof s.version === 'number' &&
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
    Array.isArray(s.decor) &&
    Array.isArray(s.walls) &&
    Array.isArray(s.inventory) &&
    Array.isArray(s.clients) &&
    Array.isArray(s.members) &&
    typeof s.today === 'object' && s.today !== null &&
    typeof s.stats === 'object' && s.stats !== null
  )
}

/**
 * Fields introduced in v4, checked only once a save claims to be at least v4 —
 * a save at that version missing them is not an old save waiting to migrate,
 * it is corrupt (hand-edited storage, a future write bug, truncated data) and
 * must be rejected rather than handed to the app with `staff` etc. undefined.
 */
function looksLikeV4(s: Record<string, unknown>): boolean {
  return (
    Array.isArray(s.staff) &&
    Array.isArray(s.stains) &&
    Array.isArray(s.candidates) &&
    typeof s.candidatesDay === 'number'
  )
}

/**
 * Brings a version 3 save up to 4: staff, stains and the hiring pool did not
 * exist, and clients had no position because nobody walked anywhere. Wiping a
 * player's gym over a schema change is not an option, so the missing pieces
 * are filled in rather than the save thrown away.
 *
 * Migrated clients are parked at the door with an empty path. The next tick
 * re-routes them; a frame of standing still beats losing the save.
 */
function migrateV3(raw: Record<string, unknown>): Record<string, unknown> {
  const clients = (raw.clients as Client[]).map(c => ({
    ...c,
    x: doorX(),
    z: DOOR_QUEUE_Z,
    path: [],
    goal: null,
  }))

  return {
    ...raw,
    version: 4,
    clients,
    staff: [],
    stains: [],
    candidates: [],
    candidatesDay: 0,
  }
}

/**
 * Brings a version 4 save up to 5: machines gained a broken-for clock that
 * decides when neglect starts costing reputation. Existing kit starts the
 * clock at zero, which hands the player back the full grace window on
 * whatever was already broken — the generous side of the rounding.
 */
function migrateV4(raw: Record<string, unknown>): Record<string, unknown> {
  const machines = (raw.machines as Machine[]).map(m => ({ ...m, brokenMs: 0 }))
  return { ...raw, version: 5, machines }
}

/**
 * Version 6 adds the expanded-floor/trainer bookkeeping plus the secret
 * visitor's daily lock and counterfeit line. All values default to the
 * neutral state, so an old gym resumes exactly where it stopped.
 */
function migrateV5(raw: Record<string, unknown>): Record<string, unknown> {
  const clients = (raw.clients as Client[]).map(c => ({ ...c, trainerUid: c.trainerUid ?? null }))
  const today = raw.today as Record<string, unknown>
  const previousReport = raw.dayReport
  const dayReport = typeof previousReport === 'object' && previousReport !== null
    ? { ...previousReport, trainerFees: 0, counterfeitLoss: 0 }
    : previousReport

  return {
    ...raw,
    version: 6,
    clients,
    expansion: 0,
    lilDSeenDay: 0,
    today: { ...today, trainerFees: 0, counterfeitLoss: 0 },
    dayReport,
  }
}

function looksLikeV6(s: Record<string, unknown>): boolean {
  const today = s.today as Record<string, unknown>
  const report = s.dayReport
  const reportOkay = report === null || (
    typeof report === 'object' &&
    typeof (report as Record<string, unknown>).trainerFees === 'number' &&
    typeof (report as Record<string, unknown>).counterfeitLoss === 'number'
  )

  return (
    typeof s.expansion === 'number' &&
    typeof s.lilDSeenDay === 'number' &&
    typeof today.trainerFees === 'number' &&
    typeof today.counterfeitLoss === 'number' &&
    reportOkay
  )
}

/** Version 7 introduces the paid wall lock and independently stored floors. */
function migrateV6(raw: Record<string, unknown>): Record<string, unknown> {
  const state = raw as unknown as GameState
  return {
    ...raw,
    version: 7,
    activeFloor: 0,
    floorPlans: [floorPlanFrom(state)],
  }
}

function looksLikeFloorPlan(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false
  const plan = value as Record<string, unknown>
  return (
    typeof plan.expansion === 'number' &&
    Array.isArray(plan.machines) &&
    Array.isArray(plan.decor) &&
    Array.isArray(plan.walls) &&
    Array.isArray(plan.stains) &&
    Array.isArray(plan.clients)
  )
}

function looksLikeV7(s: Record<string, unknown>): boolean {
  return (
    typeof s.activeFloor === 'number' &&
    Number.isInteger(s.activeFloor) &&
    Array.isArray(s.floorPlans) &&
    s.floorPlans.length > 0 &&
    s.floorPlans.every(looksLikeFloorPlan) &&
    s.activeFloor >= 0 &&
    s.activeFloor < s.floorPlans.length
  )
}

/**
 * Version 8 adds the upgrade tracks. Every one starts at zero, which is by
 * definition the game as it was before they existed — an old gym resumes with
 * nothing bought and nothing changed.
 */
function migrateV7(raw: Record<string, unknown>): Record<string, unknown> {
  return { ...raw, version: 8, upgrades: emptyUpgrades() }
}

/**
 * A save claiming v8 must carry a whole-number level for every track. Missing
 * or fractional entries are not an old save awaiting migration — that is what
 * `migrateV7` is for — but corrupt data, and handing it to the engine would put
 * `undefined` into the fee multiplier.
 */
function looksLikeV8(s: Record<string, unknown>): boolean {
  const upgrades = s.upgrades
  if (typeof upgrades !== 'object' || upgrades === null) return false
  const levels = upgrades as Record<string, unknown>
  return UPGRADE_IDS.every(id => {
    const level = levels[id]
    return typeof level === 'number' && Number.isInteger(level) && level >= 0
  })
}

/**
 * Version 9 opens the three v2 systems — advertising, equipment contracts and
 * sponsors. Each starts from its own module's empty state, which is by
 * definition the game as it was before they existed.
 *
 * This is the last migration any of the three will ever need. Their state is
 * sealed inside one sub-object apiece, and `hydrateFeatures` below rebuilds
 * every missing field from the module's own defaults on *every* load — so a
 * field added to a feature next week lands on a save written today without a
 * version bump, and without three branches queuing up to edit this file.
 */
function migrateV8(raw: Record<string, unknown>): Record<string, unknown> {
  const today = raw.today as Record<string, unknown>
  const previousReport = raw.dayReport
  const zeroed = { marketingSpend: 0, contractFees: 0, sponsorIncome: 0 }

  return {
    ...raw,
    version: 9,
    marketing: initialMarketing(),
    contracts: initialContracts(),
    sponsors: initialSponsors(),
    today: { ...today, ...zeroed },
    dayReport:
      typeof previousReport === 'object' && previousReport !== null
        ? { ...previousReport, ...zeroed }
        : previousReport,
  }
}

/** Version 10 adds diamonds, their separate upgrade tracks and social receipts. */
function migrateV9(raw: Record<string, unknown>): Record<string, unknown> {
  const previousReport = raw.dayReport
  const dayReport = typeof previousReport === 'object' && previousReport !== null
    ? { ...previousReport, diamondReward: 0 }
    : previousReport

  return {
    ...raw,
    version: 10,
    diamonds: 0,
    diamondUpgrades: emptyDiamondUpgrades(),
    lastDiamondRewardDay: 0,
    allianceIncomeMultiplier: 1,
    appliedSabotageIds: [],
    dayReport,
  }
}

function looksLikeV10(s: Record<string, unknown>): boolean {
  if (typeof s.diamondUpgrades !== 'object' || s.diamondUpgrades === null) return false
  const upgrades = s.diamondUpgrades as Record<string, unknown>
  const levelsOkay = ['queue_patience', 'repair_discount', 'xp_boost'].every(id => (
    typeof upgrades[id] === 'number' &&
    Number.isInteger(upgrades[id]) &&
    (upgrades[id] as number) >= 0 &&
    (upgrades[id] as number) <= 3
  ))
  const report = s.dayReport
  const reportOkay = report === null || (
    typeof report === 'object' &&
    ((report as Record<string, unknown>).diamondReward === undefined ||
      typeof (report as Record<string, unknown>).diamondReward === 'number')
  )

  return (
    typeof s.diamonds === 'number' && Number.isInteger(s.diamonds) && s.diamonds >= 0 &&
    typeof s.lastDiamondRewardDay === 'number' && Number.isInteger(s.lastDiamondRewardDay) &&
    (s.allianceIncomeMultiplier === 1 || s.allianceIncomeMultiplier === 1.5) &&
    Array.isArray(s.appliedSabotageIds) &&
    s.appliedSabotageIds.every(id => typeof id === 'string') &&
    levelsOkay && reportOkay
  )
}

/** Version 11 persists store receipts and the three lifetime premium rewards. */
function migrateV10(raw: Record<string, unknown>): Record<string, unknown> {
  return {
    ...raw,
    version: 11,
    premium: initialPremiumState(),
  }
}

function looksLikeV11(s: Record<string, unknown>): boolean {
  if (typeof s.premium !== 'object' || s.premium === null) return false
  const premium = s.premium as Record<string, unknown>
  const productIds = new Set(PREMIUM_PRODUCTS.map(product => product.id))
  return (
    (premium.luckMultiplier === 1 || premium.luckMultiplier === 1.5) &&
    (premium.incomeMultiplier === 1 || premium.incomeMultiplier === 2) &&
    Array.isArray(premium.ownedProductIds) &&
    premium.ownedProductIds.every(id => typeof id === 'string' && productIds.has(id as never)) &&
    Array.isArray(premium.appliedTransactionIds) &&
    premium.appliedTransactionIds.every(id => typeof id === 'string')
  )
}

/**
 * Re-seats the three feature sub-states over their current defaults. Runs on
 * every load, not only on migration — that is what makes a feature's own
 * schema changes free.
 */
function hydrateFeatures(s: Record<string, unknown>): Record<string, unknown> {
  const today = s.today as Record<string, unknown>
  const number = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

  // The receipt gained a breakdown of the weekly pass collection after some
  // saves were already written. Same reasoning as the ledger lines below —
  // a stored receipt missing them would print `NaN` rather than fail loudly —
  // and same treatment, so it costs no version bump. Zero is honest here: the
  // totals the receipt does carry are left exactly as they were.
  const report = s.dayReport
  const dayReport = typeof report === 'object' && report !== null
    ? (() => {
        const r = report as Record<string, unknown>
        return {
          ...r,
          renewals: number(r.renewals),
          renewalCount: number(r.renewalCount),
          diamondReward: number(r.diamondReward),
        }
      })()
    : report

  return {
    ...s,
    marketing: normalizeMarketing(s.marketing),
    contracts: normalizeContracts(s.contracts),
    sponsors: normalizeSponsors(s.sponsors),
    dayReport,
    // The ledger's three v2 lines get the same treatment for the same reason:
    // a missing number here would print `NaN` on the receipt rather than fail
    // loudly, which is the worst of both worlds.
    today: {
      ...today,
      marketingSpend: number(today.marketingSpend),
      contractFees: number(today.contractFees),
      sponsorIncome: number(today.sponsorIncome),
    },
  }
}

/**
 * Returns a fresh state on unparseable, malformed, or future-version input
 * rather than throwing — a corrupt save must never brick the app.
 */
export function deserialize(raw: string, now: number): GameState {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!looksLikeSave(parsed)) return initialState(now, now)

    const version = parsed.version as number
    if (version > SAVE_VERSION || version < 3) return initialState(now, now)

    // Migrations chain, so a v3 save walks up through every step rather than
    // needing its own path to the current version.
    let state = parsed
    if (state.version === 3) state = migrateV3(state)
    // Only meaningful once the save is at v4's shape, which is also the point
    // the v4 fields become required rather than pending migration.
    if (!looksLikeV4(state)) return initialState(now, now)
    if (state.version === 4) state = migrateV4(state)
    if (state.version === 5) state = migrateV5(state)
    if (!looksLikeV6(state)) return initialState(now, now)
    if (state.version === 6) state = migrateV6(state)
    if (!looksLikeV7(state)) return initialState(now, now)
    if (state.version === 7) state = migrateV7(state)
    if (!looksLikeV8(state)) return initialState(now, now)
    if (state.version === 8) state = migrateV8(state)
    if (state.version === 9) state = migrateV9(state)
    if (!looksLikeV10(state)) return initialState(now, now)
    if (state.version === 10) state = migrateV10(state)
    if (!looksLikeV11(state)) return initialState(now, now)

    return hydrateFeatures(state) as unknown as GameState
  } catch {
    return initialState(now, now)
  }
}
