import { useI18n } from '../i18n'

export default function ClubLauncher({ onOpen }: { onOpen: () => void }) {
  const { language } = useI18n()
  const label = language === 'pl' ? 'Otwórz Baron Club' : 'Open Baron Club'

  return (
    <button className="club-launcher" type="button" onClick={onOpen} aria-label={label} title={label}>
      <span className="club-launcher-crown" aria-hidden="true">♛</span>
      <span>{language === 'pl' ? 'CLUB' : 'CLUB'}</span>
      <i aria-hidden="true">›</i>
    </button>
  )
}
