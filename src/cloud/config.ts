export interface CloudConfig {
  url: string
  anonKey: string
}

/**
 * Reads the Supabase credentials out of Vite's compile-time env.
 *
 * Returns null rather than throwing when they are absent: a build without
 * Supabase is a supported configuration — the game simply stays local-only,
 * exactly as it did before accounts existed.
 */
export function readCloudConfig(
  env: Record<string, string | undefined> = import.meta.env as unknown as Record<
    string,
    string | undefined
  >,
): CloudConfig | null {
  const url = env.VITE_SUPABASE_URL?.trim()
  const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim()
  if (!url || !anonKey) return null

  // The example file ships with placeholders; treating those as real
  // credentials would turn a forgotten setup step into a runtime error storm.
  if (url.includes('your-project-ref') || anonKey.startsWith('your-')) return null

  return { url, anonKey }
}

export function isCloudConfigured(
  env?: Record<string, string | undefined>,
): boolean {
  return readCloudConfig(env) !== null
}
