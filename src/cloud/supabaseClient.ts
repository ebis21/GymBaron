import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { clearRaw, loadRaw, saveRaw } from '../store/storage'
import { readCloudConfig, type CloudConfig } from './config'

/**
 * supabase-js defaults to `localStorage`, which a Capacitor build on iOS is
 * free to evict. Routing the session through the same Preferences plugin the
 * save already uses is what makes "stay signed in after a restart" true on a
 * phone and not just in a browser tab.
 */
const preferencesStorage = {
  getItem: (key: string) => loadRaw(key),
  setItem: (key: string, value: string) => saveRaw(key, value),
  removeItem: (key: string) => clearRaw(key),
}

let cached: SupabaseClient | null = null

export function createSupabaseClient(config: CloudConfig): SupabaseClient {
  return createClient(config.url, config.anonKey, {
    auth: {
      storage: preferencesStorage,
      storageKey: 'iron-empire-auth',
      persistSession: true,
      autoRefreshToken: true,
      // There is no OAuth redirect to parse, and on a Capacitor origin the
      // URL scan only ever produces noise.
      detectSessionInUrl: false,
    },
  })
}

/**
 * The app-wide client, or null when the build carries no Supabase config.
 * Callers must handle null — that is the offline/local-only build.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (cached) return cached
  const config = readCloudConfig()
  if (!config) return null
  cached = createSupabaseClient(config)
  return cached
}
