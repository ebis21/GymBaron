/**
 * Seeded mulberry32. Returns the drawn value together with the next seed so
 * callers thread the seed through game state — the engine keeps no hidden
 * mutable RNG, which is what makes the whole simulation reproducible.
 */
export function nextRandom(seed: number): [number, number] {
  const t = (seed + 0x6d2b79f5) | 0
  let r = Math.imul(t ^ (t >>> 15), 1 | t)
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
  return [((r ^ (r >>> 14)) >>> 0) / 4294967296, t]
}
