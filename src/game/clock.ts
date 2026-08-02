import { DAY_MS, DAY_START_HOUR, HOUR_MS } from './constants'

export interface Clock {
  hour: number
  minute: number
}

const clampDayMs = (dayMs: number) => Math.max(0, Math.min(dayMs, DAY_MS))

/**
 * Position inside the day as a wall clock. At `DAY_MS` this reads exactly
 * 20:00 rather than rolling into 20:01 — closing time is an instant the
 * player watches for, not an approximation.
 */
export function clockAt(dayMs: number): Clock {
  const t = clampDayMs(dayMs)
  return {
    hour: DAY_START_HOUR + Math.floor(t / HOUR_MS),
    minute: Math.floor(((t % HOUR_MS) / HOUR_MS) * 60),
  }
}

export function formatClock(dayMs: number): string {
  const { hour, minute } = clockAt(dayMs)
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

/** 0 at opening, 1 at closing. Drives the day progress bar. */
export function dayProgress(dayMs: number): number {
  return clampDayMs(dayMs) / DAY_MS
}

/** Milliseconds of simulation left before the day must close. */
export function msLeftInDay(dayMs: number): number {
  return DAY_MS - clampDayMs(dayMs)
}
