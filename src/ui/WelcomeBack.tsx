import { assetFor } from '../assets/assetFor'
import { duration, money } from './format'

interface Props {
  earned: number
  awayMs: number
  onDismiss: () => void
}

export default function WelcomeBack({ earned, awayMs, onDismiss }: Props) {
  const Logo = assetFor('logo')
  return (
    <div className="overlay">
      <div className="modal">
        <Logo />
        <h2>Witaj z powrotem</h2>
        <p>
          Siłownia działała bez Ciebie przez {duration(awayMs)}. Klienci wchodzili,
          rachunki leciały dalej.
        </p>

        <div className="stat-card" style={{ marginBottom: 16 }}>
          <div className="k">Bilans nieobecności</div>
          <div className={`v ${earned < 0 ? 'cash-bad' : 'cash-ok'}`}>{money(earned)}</div>
        </div>

        <button className="btn block" onClick={onDismiss}>
          Wracam do roboty
        </button>
      </div>
    </div>
  )
}
