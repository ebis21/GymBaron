import type { GameState } from './types'
import type { Point } from './layout'
import { tileToWorld } from './layout'
import { needsRepair } from './staff'
import { NEGLECT_GRACE_MS } from './neglect'

/**
 * The two things on the floor that quietly cost the player money if nobody
 * looks at them. Deliberately only these two: an alert the player cannot act
 * on by walking over to it has no arrow to draw, and the whole point of this
 * module is to be the source of that arrow.
 */
export type AlertKind = 'broken' | 'dirty'

export interface GymAlert {
  kind: AlertKind
  /** Machine or stain uid — whatever the guide arrow is aimed at. */
  uid: string
  /** Tile the trouble is standing on. */
  x: number
  y: number
  /** How long it has been left standing. */
  ageMs: number
  /**
   * Past the grace window, so it is already draining reputation rather than
   * merely waiting to. See `neglect.ts` — one window covers both kinds.
   */
  costing: boolean
}

/**
 * Everything on the active floor that wants a hand, worst first.
 *
 * Broken kit outranks any mess: a wreck turns paying visitors away, while a
 * stain only nudges reputation, so a machine that went down this second still
 * matters more than a puddle that has been there all morning. Within a kind
 * the oldest goes first, because that is the one already being charged for.
 *
 * Only the storey the player is standing on is reported. The arrow leads
 * somewhere by walking, and there is no walking to another floor.
 */
export function gymAlerts(state: GameState): GymAlert[] {
  const broken: GymAlert[] = state.machines.filter(needsRepair).map(m => ({
    kind: 'broken',
    uid: m.uid,
    x: m.x,
    y: m.y,
    ageMs: m.brokenMs,
    costing: m.brokenMs >= NEGLECT_GRACE_MS,
  }))

  const dirty: GymAlert[] = state.stains.map(s => ({
    kind: 'dirty',
    uid: s.uid,
    x: s.x,
    y: s.y,
    ageMs: s.ageMs,
    costing: s.ageMs >= NEGLECT_GRACE_MS,
  }))

  const oldestFirst = (a: GymAlert, b: GymAlert) => b.ageMs - a.ageMs
  return [...broken.sort(oldestFirst), ...dirty.sort(oldestFirst)]
}

export function countOf(alerts: GymAlert[], kind: AlertKind): number {
  return alerts.reduce((n, a) => (a.kind === kind ? n + 1 : n), 0)
}

/**
 * The one of its kind the player should walk to, which is simply the closest
 * — not the oldest. An arrow that points across the whole hall at a stain
 * three seconds staler than the one underfoot is an arrow nobody follows.
 *
 * Returns the world position too, since the caller wanted a direction and
 * would otherwise convert the tile itself.
 */
export function nearestAlert(
  alerts: GymAlert[],
  kind: AlertKind,
  from: Point,
): { alert: GymAlert; at: Point; distance: number } | null {
  let best: { alert: GymAlert; at: Point; distance: number } | null = null

  for (const alert of alerts) {
    if (alert.kind !== kind) continue

    const at = tileToWorld(alert.x, alert.y)
    const distance = Math.hypot(at.x - from.x, at.z - from.z)
    if (!best || distance < best.distance) best = { alert, at, distance }
  }

  return best
}
