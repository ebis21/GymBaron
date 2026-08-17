import { assetFor } from '../assets/assetFor'
import { useI18n } from '../i18n'
import { useDialogFocus } from './useDialogFocus'

interface Props {
  earned: number
  awayMs: number
  onDismiss: () => void
}

export default function WelcomeBack({ earned, awayMs, onDismiss }: Props) {
  const { t, money, duration } = useI18n()
  const Logo = assetFor('logo')
  const dialogRef = useDialogFocus<HTMLDivElement>(onDismiss)

  return (
    <div className="overlay" role="presentation">
      <div ref={dialogRef} tabIndex={-1} className="modal" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
        <Logo />
        <h2 id="welcome-title">{t.welcome.title}</h2>
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
