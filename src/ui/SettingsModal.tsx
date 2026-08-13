import { LANGUAGES, useI18n, useI18nStore, type Language } from '../i18n'
import { usePrefsStore } from '../store/prefs'

interface Props {
  onClose: () => void
}

/**
 * Two settings, still a plain list: each is a labelled row of buttons, which
 * is enough shape for a panel this short and keeps the language picker looking
 * exactly as it did before it had company.
 */
export default function SettingsModal({ onClose }: Props) {
  const { t, language } = useI18n()
  const setLanguage = useI18nStore(s => s.setLanguage)
  const alerts = usePrefsStore(s => s.alerts)
  const setAlerts = usePrefsStore(s => s.setAlerts)

  return (
    <div className="modal-backdrop" role="presentation" onPointerDown={onClose}>
      <section
        className="modal settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onPointerDown={event => event.stopPropagation()}
      >
        <button className="modal-x" onClick={onClose} aria-label={t.settings.close}>
          ✕
        </button>

        <h2 id="settings-title">{t.settings.title}</h2>

        <h3 className="settings-label">{t.settings.language}</h3>
        <div className="settings-langs">
          {LANGUAGES.map((code: Language) => (
            <button
              key={code}
              className={`settings-lang${code === language ? ' current' : ''}`}
              aria-pressed={code === language}
              onClick={() => setLanguage(code)}
            >
              <span className="settings-lang-name">{t.languageName[code]}</span>
              <span className="settings-lang-mark">{code === language ? '✓' : ''}</span>
            </button>
          ))}
        </div>

        <h3 className="settings-label">{t.settings.alerts}</h3>
        <div className="settings-toggle">
          <button
            className={`settings-lang${alerts ? ' current' : ''}`}
            aria-pressed={alerts}
            onClick={() => setAlerts(true)}
          >
            <span className="settings-lang-name">{t.settings.alertsOn}</span>
            <span className="settings-lang-mark">{alerts ? '✓' : ''}</span>
          </button>
          <button
            className={`settings-lang${alerts ? '' : ' current'}`}
            aria-pressed={!alerts}
            onClick={() => setAlerts(false)}
          >
            <span className="settings-lang-name">{t.settings.alertsOff}</span>
            <span className="settings-lang-mark">{alerts ? '' : '✓'}</span>
          </button>
        </div>
        <p className="settings-note">{t.settings.alertsHint}</p>

        <button className="btn primary block" onClick={onClose}>
          {t.settings.close}
        </button>
      </section>
    </div>
  )
}
