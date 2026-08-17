import { Preferences } from '@capacitor/preferences'

/* Native Preferences writes are asynchronous. Queue them so an older
 * autosave can never finish after a newer one and roll the gym back. */
let writeQueue: Promise<void> = Promise.resolve()

const enqueueWrite = (write: () => Promise<void>): Promise<void> => {
  const queued = writeQueue.then(write, write)
  // Storage errors are intentionally non-fatal, but must not poison every
  // later write in the chain.
  writeQueue = queued.catch(() => undefined)
  return queued
}

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
  return enqueueWrite(async () => {
    try {
      await Preferences.set({ key, value })
    } catch {
      // A failed autosave must never interrupt play.
    }
  })
}

export async function clearRaw(key: string): Promise<void> {
  return enqueueWrite(async () => {
    try {
      await Preferences.remove({ key })
    } catch {
      // Nothing to do — the next save overwrites anyway.
    }
  })
}
