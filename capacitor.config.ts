import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.ironempire.gym',
  appName: 'IRON EMPIRE',
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
