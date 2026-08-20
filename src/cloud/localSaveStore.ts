import { loadRaw, saveRaw } from '../store/storage'
import { SAVE_KEY } from '../game/constants'
import type { LocalSaveStore } from './types'

/**
 * The device save, as the cloud layer sees it: the very same Preferences key
 * the game already writes, so a download lands where the next cold start will
 * look for it.
 */
export const localSaveStore: LocalSaveStore = {
  read: () => loadRaw(SAVE_KEY),
  write: raw => saveRaw(SAVE_KEY, raw),
}
