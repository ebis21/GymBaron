import { getAccountService, getSupabaseClient } from '../cloud'
import type { MultiplayerApi } from './types'
import { SupabaseMultiplayerApi } from './supabaseMultiplayerApi'

type InvalidationListener = () => Promise<void> | void

const listeners = new Set<InvalidationListener>()
const beforeWalletListeners = new Set<InvalidationListener>()
const afterWalletListeners = new Set<InvalidationListener>()

async function notify(list: Set<InvalidationListener>, swallow: boolean): Promise<void> {
  for (const listener of [...list]) {
    try {
      await listener()
    } catch (cause) {
      if (!swallow) throw cause
    }
  }
}

async function notifyRelationshipChanged(): Promise<void> {
  await Promise.all([...listeners].map(async listener => {
    try { await listener() } catch { /* the next session poll retries */ }
  }))
}

let singleton: MultiplayerApi | null = null

export function getMultiplayerApi(): MultiplayerApi {
  singleton ??= new SupabaseMultiplayerApi(getSupabaseClient(), {
    afterWalletMutation: async () => {
      await getAccountService().cloud.pull()
    },
    beforeWalletMutation: () => notify(beforeWalletListeners, false),
    afterWalletMutationFinished: () => notify(afterWalletListeners, true),
    afterRelationshipMutation: notifyRelationshipChanged,
  })
  return singleton
}

export function onMultiplayerInvalidated(listener: InvalidationListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function onBeforeMultiplayerWalletMutation(listener: InvalidationListener): () => void {
  beforeWalletListeners.add(listener)
  return () => beforeWalletListeners.delete(listener)
}

export function onAfterMultiplayerWalletMutation(listener: InvalidationListener): () => void {
  afterWalletListeners.add(listener)
  return () => afterWalletListeners.delete(listener)
}
