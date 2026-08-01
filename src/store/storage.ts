import { Preferences } from '@capacitor/preferences'

/**
 * One call path for saving in the browser and natively. Capacitor's
 * Preferences plugin falls back to localStorage on web, so this needs no
 * platform branch — but it does need to survive a full storage quota.
 */
export async function loadRaw(key: string): Promise<string | null> {
  try {
    const { value } = await Preferences.get({ key })
    return value
  } catch {
    return null
  }
}

export async function saveRaw(key: string, value: string): Promise<void> {
  try {
    await Preferences.set({ key, value })
  } catch {
    // A failed autosave must never interrupt play.
  }
}

export async function clearRaw(key: string): Promise<void> {
  try {
    await Preferences.remove({ key })
  } catch {
    // Nothing to do — the next save overwrites anyway.
  }
}
