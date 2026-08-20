import { describe, expect, it } from 'vitest'
import { isCloudConfigured, readCloudConfig } from './config'

describe('reading Supabase config', () => {
  it('accepts a filled-in pair', () => {
    expect(
      readCloudConfig({
        VITE_SUPABASE_URL: 'https://abc.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'sb_publishable_key',
      }),
    ).toEqual({ url: 'https://abc.supabase.co', anonKey: 'sb_publishable_key' })
  })

  it('trims stray whitespace from a copied .env line', () => {
    expect(
      readCloudConfig({
        VITE_SUPABASE_URL: '  https://abc.supabase.co  ',
        VITE_SUPABASE_ANON_KEY: ' key ',
      })?.url,
    ).toBe('https://abc.supabase.co')
  })

  it('treats a missing half as no config at all', () => {
    expect(readCloudConfig({ VITE_SUPABASE_URL: 'https://abc.supabase.co' })).toBeNull()
    expect(readCloudConfig({ VITE_SUPABASE_ANON_KEY: 'key' })).toBeNull()
    expect(readCloudConfig({})).toBeNull()
  })

  it('rejects the placeholders shipped in .env.example', () => {
    // Copying the example without editing it is the likeliest setup mistake;
    // a local-only build beats a build that fires doomed requests.
    expect(
      readCloudConfig({
        VITE_SUPABASE_URL: 'https://your-project-ref.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'your-anon-or-publishable-key',
      }),
    ).toBeNull()
  })

  it('answers the yes/no question the UI actually asks', () => {
    expect(isCloudConfigured({})).toBe(false)
    expect(
      isCloudConfigured({ VITE_SUPABASE_URL: 'https://a.co', VITE_SUPABASE_ANON_KEY: 'k' }),
    ).toBe(true)
  })
})
