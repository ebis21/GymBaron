import { describe, it, expect, beforeEach } from 'vitest'
import {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  currentLanguage,
  duration,
  money,
  strings,
  useI18nStore,
} from './index'
import { en } from './en'
import { pl } from './pl'
import { MACHINE_TYPES } from '../game/content/machines'
import { DECOR_TYPES } from '../game/content/decor'
import { EXPANSIONS } from '../game/content/expansion'
import { STAFF_ROLES } from '../game/content/staff'
import { FIRST_NAMES } from '../game/recruit'

describe('language store', () => {
  beforeEach(() => {
    useI18nStore.setState({ language: DEFAULT_LANGUAGE, t: en, ready: false })
  })

  it('starts in English, which is what a player who has never chosen gets', () => {
    expect(DEFAULT_LANGUAGE).toBe('en')
    expect(currentLanguage()).toBe('en')
    expect(strings().settings.title).toBe('Settings')
  })

  it('offers exactly Polish and English', () => {
    expect(LANGUAGES).toEqual(['en', 'pl'])
  })

  it('swaps the dictionary along with the language', () => {
    useI18nStore.getState().setLanguage('pl')
    expect(currentLanguage()).toBe('pl')
    expect(strings().settings.title).toBe('Ustawienia')

    useI18nStore.getState().setLanguage('en')
    expect(strings().settings.title).toBe('Settings')
  })
})

describe('Baron Club copy', () => {
  it('keeps every destination in English when English is selected', () => {
    expect(en.club.home.store.title).toBe('Premium store')
    expect(en.club.diamondUpgrades.title).toBe('Diamond upgrades')
    expect(en.club.account.title).toBe('Account')
    expect(en.club.nickname.title).toBe('What should everyone call you?')
    expect(en.club.multiplayer.title).toBe('Friends and alliances')
    expect(en.club.friendGym.back).toBe('Back')
    expect(en.club.account.service.invalidCredentials).toBe('Incorrect email or password.')
  })

  it('keeps the same destinations available in Polish', () => {
    expect(pl.club.home.store.title).toBe('Sklep premium')
    expect(pl.club.diamondUpgrades.title).toBe('Ulepszenia za diamenty')
    expect(pl.club.account.title).toBe('Konto')
    expect(pl.club.nickname.title).toBe('Jak mają Cię nazywać?')
    expect(pl.club.multiplayer.title).toBe('Znajomi i sojusze')
    expect(pl.club.friendGym.back).toBe('Wróć')
  })
})

describe('money', () => {
  it('keeps the currency in both languages — it belongs to the game, not the reader', () => {
    expect(money(1234, 'en')).toContain('kr')
    expect(money(1234, 'pl')).toContain('kr')
  })

  it('groups thousands the way each language does', () => {
    // Polish groups with a non-breaking space, English with a comma.
    expect(money(45_000, 'en')).toBe('45,000 kr')
    expect(money(45_000, 'pl').replace(/\u00a0/g, ' ')).toBe('45 000 kr')
  })

  it('leaves four digits ungrouped in Polish, which is what pl-PL does', () => {
    expect(money(1234, 'en')).toBe('1,234 kr')
    expect(money(1234, 'pl')).toBe('1234 kr')
  })

  it('marks a negative balance with a minus in both', () => {
    expect(money(-50, 'en').startsWith('−')).toBe(true)
    expect(money(-50, 'pl').startsWith('−')).toBe(true)
  })
})

describe('duration', () => {
  it('abbreviates in English and spells out in Polish', () => {
    const twoAndAHalfHours = 2.5 * 60 * 60 * 1000
    expect(duration(twoAndAHalfHours, 'en')).toBe('2h 30m')
    expect(duration(twoAndAHalfHours, 'pl')).toBe('2 godz. 30 min')
  })

  it('drops the hours when there are none', () => {
    const fortyMinutes = 40 * 60 * 1000
    expect(duration(fortyMinutes, 'en')).toBe('40m')
    expect(duration(fortyMinutes, 'pl')).toBe('40 min')
  })
})

/**
 * The dictionaries are structurally checked by `Strings`, so these guard the
 * one thing the type cannot: that every id in the content tables actually has
 * a name, rather than an empty string that types fine and renders as nothing.
 */
describe('content names', () => {
  const dictionaries = { en, pl }

  for (const [code, t] of Object.entries(dictionaries)) {
    it(`names every machine in ${code}`, () => {
      for (const m of MACHINE_TYPES) expect(t.content.machines[m.id]).toBeTruthy()
    })

    it(`names every piece of furniture in ${code}`, () => {
      for (const d of DECOR_TYPES) expect(t.content.decor[d.id]).toBeTruthy()
    })

    it(`names every expansion in ${code}`, () => {
      for (const e of EXPANSIONS) expect(t.content.expansions[e.id]).toBeTruthy()
    })

    it(`names every job in ${code}`, () => {
      for (const role of STAFF_ROLES) expect(t.content.roles[role]).toBeTruthy()
    })
  }

  it('does not leave English text sitting in the Polish dictionary', () => {
    for (const m of MACHINE_TYPES) {
      expect(pl.content.machines[m.id]).not.toBe(en.content.machines[m.id])
    }
  })
})

/**
 * The name pools have to stay parallel: `displayName` reads a stored name out
 * of the other pool by slot, so a length mismatch would silently strand names.
 */
describe('name pools', () => {
  it('keeps the pools the same length so every name has a counterpart', () => {
    expect(FIRST_NAMES.en).toHaveLength(FIRST_NAMES.pl.length)
  })
})

describe('the advertising schedule line', () => {
  /**
   * The open day is a one-day campaign, and every other offer runs for
   * several. A single unit is the case a length written as a bare number gets
   * wrong, in both languages.
   */
  it('counts a single day in the singular', () => {
    expect(en.marketing.schedule(1, '2,500 kr')).toContain('1 day ')
    expect(en.marketing.schedule(1, '2,500 kr')).not.toContain('1 days')
    expect(pl.marketing.schedule(1, '2500 kr')).toContain('1 dzień')
  })

  it('counts the rest in the plural', () => {
    expect(en.marketing.schedule(6, '1,400 kr')).toContain('6 days')
    expect(pl.marketing.schedule(6, '1400 kr')).toContain('6 dni')
  })
})
