import { useCallback, useEffect, useState } from 'react'
import { getAccountService, type AccountService, type AccountState } from './account'
import type { CloudSaveEvent } from './cloudSave'

export interface UseAccount {
  state: AccountState
  signUp: (email: string, password: string) => Promise<boolean>
  signIn: (email: string, password: string) => Promise<boolean>
  signOut: () => Promise<boolean>
  /** Sends the queued save now. Use before backgrounding the app. */
  flush: () => Promise<void>
}

/**
 * Subscribes a component to the account service and starts it on first mount.
 * Passing an explicit service is what lets a screen be exercised against a
 * fake instead of a live Supabase project.
 */
export function useAccount(service: AccountService = getAccountService()): UseAccount {
  const [state, setState] = useState<AccountState>(() => service.state())

  useEffect(() => {
    const unsubscribe = service.subscribe(setState)
    void service.start()
    return unsubscribe
  }, [service])

  return {
    state,
    signUp: useCallback((email, password) => service.signUp(email, password), [service]),
    signIn: useCallback((email, password) => service.signIn(email, password), [service]),
    signOut: useCallback(() => service.signOut(), [service]),
    flush: useCallback(async () => {
      await service.cloud.flush()
    }, [service]),
  }
}

/**
 * Fires for every save that arrives from the cloud. This is the hook the store
 * layer uses to swap the running game over to a downloaded save.
 */
export function useCloudSaveEvents(
  listener: (event: CloudSaveEvent) => void,
  service: AccountService = getAccountService(),
): void {
  useEffect(() => service.onCloudEvent(listener), [service, listener])
}
