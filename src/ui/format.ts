export const money = (v: number) =>
  `${v < 0 ? '−' : ''}${Math.abs(Math.floor(v)).toLocaleString('pl-PL')} kr`

export function duration(ms: number): string {
  const totalMin = Math.floor(ms / 60_000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h > 0) return `${h} godz. ${m} min`
  return `${m} min`
}
