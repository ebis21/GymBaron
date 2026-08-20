/// <reference types="vite/client" />

declare module '*.css' {
  const content: string
  export default content
}

/**
 * Vite inlines every VITE_* variable into the shipped bundle, so only values
 * that are safe in public may be declared here. The Supabase anon key is one;
 * a service_role key never is.
 */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_REVENUECAT_IOS_API_KEY?: string
  readonly VITE_REVENUECAT_ANDROID_API_KEY?: string
  readonly VITE_REVENUECAT_OFFERING_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
