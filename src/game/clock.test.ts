import { describe, it, expect } from 'vitest'
import { clockAt, formatClock, dayProgress, msLeftInDay } from './clock'
import { DAY_MS, DAY_END_HOUR, DAY_START_HOUR, HOUR_MS } from './constants'

describe('clockAt', () => {
  it('opens at 8:00', () => {
    expect(clockAt(0)).toEqual({ hour: DAY_START_HOUR, minute: 0 })
  })

  it('reads exactly 20:00 at closing, not 20:01', () => {
    expect(clockAt(DAY_MS)).toEqual({ hour: DAY_END_HOUR, minute: 0 })
  })

  it('advances one hour per HOUR_MS', () => {
    expect(clockAt(HOUR_MS)).toEqual({ hour: 9, minute: 0 })
    expect(clockAt(HOUR_MS * 4)).toEqual({ hour: 12, minute: 0 })
  })

  it('reads half past at half an HOUR_MS', () => {
    expect(clockAt(HOUR_MS / 2)).toEqual({ hour: 8, minute: 30 })
  })

  it('clamps input outside the day', () => {
    expect(clockAt(-5_000)).toEqual({ hour: DAY_START_HOUR, minute: 0 })
    expect(clockAt(DAY_MS * 3)).toEqual({ hour: DAY_END_HOUR, minute: 0 })
  })
})

describe('formatClock', () => {
  it('pads both fields to two digits', () => {
    expect(formatClock(0)).toBe('08:00')
    expect(formatClock(HOUR_MS + HOUR_MS / 12)).toBe('09:05')
    expect(formatClock(DAY_MS)).toBe('20:00')
  })
})

describe('dayProgress', () => {
  it('runs 0 at opening to 1 at closing', () => {
    expect(dayProgress(0)).toBe(0)
    expect(dayProgress(DAY_MS / 2)).toBeCloseTo(0.5, 5)
    expect(dayProgress(DAY_MS)).toBe(1)
  })

  it('never leaves the 0..1 range', () => {
    expect(dayProgress(-1)).toBe(0)
    expect(dayProgress(DAY_MS * 9)).toBe(1)
  })
})

describe('msLeftInDay', () => {
  it('is the whole day at opening and nothing at closing', () => {
    expect(msLeftInDay(0)).toBe(DAY_MS)
    expect(msLeftInDay(DAY_MS)).toBe(0)
  })

  it('never goes negative', () => {
    expect(msLeftInDay(DAY_MS * 4)).toBe(0)
  })
})
