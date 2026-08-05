/**
 * A mess or a broken machine is only a reputation problem once it has been
 * left standing. Both get the same grace window, so "clean it up reasonably
 * promptly and you pay nothing" is one rule the player learns once rather
 * than two thresholds that happen to differ.
 */
export const NEGLECT_GRACE_MS = 15_000

export const clampRep = (v: number): number => Math.max(0, Math.min(100, v))
