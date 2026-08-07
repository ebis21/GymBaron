import { LANGUAGES, useI18n, useI18nStore, type Language } from '../i18n'

interface Props {
  onClose: () => void
}

/**
 * One setting so far, so this is deliberately a plain list rather than a
 * screen with sections: the panel is the language picker until there is a
 * second thing to put in it.
 */
export default function SettingsModal({ onClose }: Props) {
  const { t, language } = useI18n()
  const setLanguage = useI18nStore(s => s.setLanguage)

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

        <button className="btn primary block" onClick={onClose}>
          {t.settings.close}
        </button>
      </section>
    </div>
  )
}
