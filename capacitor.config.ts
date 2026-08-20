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
    // CSS owns every safe-area inset. Letting WKWebView add another automatic
    // inset would double the notch/home-indicator spacing.
    contentInset: 'never',
    allowsLinkPreview: false,
    preferredContentMode: 'mobile',
  },
  plugins: {
    SystemBars: {
      // Capacitor injects these CSS fallbacks for Android WebView versions
      // whose env(safe-area-inset-*) values are wrong in edge-to-edge mode.
      insetsHandling: 'css',
      style: 'DARK',
      hidden: false,
      animation: 'NONE',
    },
  },
}

export default config
