import { assetFor } from '../assets/assetFor'
import { useI18n } from '../i18n'

interface Props {
  earned: number
  awayMs: number
  onDismiss: () => void
}

export default function WelcomeBack({ earned, awayMs, onDismiss }: Props) {
  const { t, money, duration } = useI18n()
  const Logo = assetFor('logo')

  return (
    <div className="overlay">
      <div className="modal">
        <Logo />
        <h2>{t.welcome.title}</h2>
        <p>{t.welcome.copy(duration(awayMs))}</p>

        <div className="stat-card" style={{ marginBottom: 16 }}>
          <div className="k">{t.welcome.balance}</div>
          <div className={`v ${earned < 0 ? 'cash-bad' : 'cash-ok'}`}>{money(earned)}</div>
        </div>

        <button className="btn block" onClick={onDismiss}>
          {t.welcome.dismiss}
        </button>
      </div>
    </div>
  )
}
