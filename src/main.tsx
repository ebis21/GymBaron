import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import { Analytics } from '@vercel/analytics/react'
import App from './App'
import { hydrateLanguage } from './i18n'
import { hydratePrefs } from './store/prefs'
import './ui/styles.css'

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')

// Kicked off before the first render; App holds its loading screen until these
// land, so nobody sees the default language flash past their own — or a chip
// they switched off appear and then think better of itself.
void hydrateLanguage()
void hydratePrefs()

/*
 * Vercel counts visits on the deployed web build only. The native shells serve
 * the same bundle off the device, where the analytics script — a path relative
 * to the deployment — resolves to nothing, so it is left out there rather than
 * left to fail quietly.
 */
const onWeb = !Capacitor.isNativePlatform()

createRoot(root).render(
  <StrictMode>
    <App />
    {onWeb && <Analytics />}
  </StrictMode>,
)
