import { create } from 'zustand'
import { loadRaw, saveRaw } from '../store/storage'
import { en, type Strings } from './en'
import { pl } from './pl'

export type Language = 'en' | 'pl'

/** The only two on offer, in the order the settings list them. */
export const LANGUAGES: Language[] = ['en', 'pl']

export const DEFAULT_LANGUAGE: Language = 'en'

const LANG_KEY = 'iron-empire.language'

const DICTIONARIES: Record<Language, Strings> = { en, pl }

/**
 * Number and date formatting follows the language rather than the currency:
 * `1,234 kr` in English, `1 234 kr` in Polish. The currency itself does not —
 * it belongs to the world of the game, not to whoever is reading.
 */
const LOCALES: Record<Language, string> = { en: 'en-GB', pl: 'pl-PL' }

/** Keep assistive technology and browser language tools in step with the UI. */
const setDocumentLanguage = (language: Language): void => {
  if (typeof document !== 'undefined') document.documentElement.lang = language
}

const isLanguage = (v: unknown): v is Language =>
  typeof v === 'string' && (LANGUAGES as string[]).includes(v)

interface I18nStore {
  language: Language
  /** False until the stored choice has been read back; see `hydrate`. */
  ready: boolean
  t: Strings
  setLanguage: (next: Language) => void
}

export const useI18nStore = create<I18nStore>(set => ({
  language: DEFAULT_LANGUAGE,
  ready: false,
  t: DICTIONARIES[DEFAULT_LANGUAGE],
  setLanguage: next => {
    setDocumentLanguage(next)
    set({ language: next, t: DICTIONARIES[next] })
    void saveRaw(LANG_KEY, next)
  },
}))

/**
 * Reads the stored choice once at boot. Until it resolves the store reports
 * `ready: false` and the app holds on its loading screen — otherwise a Polish
 * player would watch the game paint in English and then switch under them.
 */
export async function hydrateLanguage(): Promise<void> {
  const stored = await loadRaw(LANG_KEY)
  const language = isLanguage(stored) ? stored : DEFAULT_LANGUAGE
  setDocumentLanguage(language)
  useI18nStore.setState({ language, t: DICTIONARIES[language], ready: true })
}

export const money = (v: number, language: Language): string =>
  `${v < 0 ? '−' : ''}${Math.abs(Math.floor(v)).toLocaleString(LOCALES[language])} kr`

export function duration(ms: number, language: Language): string {
  const totalMin = Math.floor(ms / 60_000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (language === 'pl') return h > 0 ? `${h} godz. ${m} min` : `${m} min`
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export interface I18n {
  language: Language
  t: Strings
  money: (v: number) => string
  duration: (ms: number) => string
}

/**
 * Everything a component needs to render text. Bundling the formatters with
 * the dictionary is what keeps `language` from having to be threaded through
 * every call site that happens to print a price.
 */
export function useI18n(): I18n {
  const language = useI18nStore(s => s.language)
  const t = useI18nStore(s => s.t)
  return {
    language,
    t,
    money: v => money(v, language),
    duration: ms => duration(ms, language),
  }
}

/** For code outside React — texture builders, name pools — where hooks cannot go. */
export const currentLanguage = (): Language => useI18nStore.getState().language
export const strings = (): Strings => useI18nStore.getState().t
