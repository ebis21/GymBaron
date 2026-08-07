import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  // The bundle id is an identity, not a name. Changing it makes a brand-new
  // app on both stores — new listing, no update path, every installed copy
  // stranded — so it keeps the original spelling even though the app is now
  // called GYMBARON. Only worth changing before the first store release.
  appId: 'com.ironempire.gym',
  appName: 'GYMBARON',
  webDir: 'dist',
  android: {
    backgroundColor: '#12141a',
  },
  ios: {
    backgroundColor: '#12141a',
    contentInset: 'always',
  },
}

export default config
