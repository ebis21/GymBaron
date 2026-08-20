import { create } from 'zustand'
import { loadRaw, saveRaw } from './storage'

const ALERTS_KEY = 'gymbaron.alerts'

/**
 * Player preferences that are not the language and not part of the save. A
 * separate store from `gameStore` on purpose: none of this belongs in a
 * savegame, and a setting that survived a restart-save would be lost with it.
 */
interface PrefsStore {
  /** Whether the floor's trouble chips and their guide arrow are shown. */
  alerts: boolean
  /** False until the stored choice has been read back; see `hydratePrefs`. */
  ready: boolean
  setAlerts: (on: boolean) => void
}

export const usePrefsStore = create<PrefsStore>(set => ({
  alerts: true,
  ready: false,
  setAlerts: on => {
    set({ alerts: on })
    void saveRaw(ALERTS_KEY, on ? 'on' : 'off')
  },
}))

/**
 * Reads the stored choices once at boot, alongside the language. App holds its
 * loading screen for this the same way: chips that appear and then vanish a
 * frame later would look like a bug to whoever turned them off.
 */
export async function hydratePrefs(): Promise<void> {
  const stored = await loadRaw(ALERTS_KEY)
  usePrefsStore.setState({ alerts: stored !== 'off', ready: true })
}
