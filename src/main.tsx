import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import { Analytics } from '@vercel/analytics/react'
import App from './App'
import { hydrateLanguage } from './i18n'
import './ui/styles.css'

const root = document.getElementById('root')
if (!root) throw new Error('Brak elementu #root')

// Kicked off before the first render; App holds its loading screen until this
// lands, so nobody sees the default language flash past their own.
void hydrateLanguage()

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
