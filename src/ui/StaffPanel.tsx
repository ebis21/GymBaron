import type { GameState } from '../game/types'
import { ROLE_LABEL, RANK_LABEL, wageFor, STAFF_LIMIT } from '../game/content/staff'
import { money } from './format'

interface Props {
  state: GameState
  onFire: (uid: string) => void
  onSettle: (uid: string) => void
  onOpenRecruit: () => void
}

/**
 * The payroll. A striking employee is the one thing here that needs to shout:
 * they are still costing a slot and doing nothing, and the way out is a button.
 */
export default function StaffPanel({ state, onFire, onSettle, onOpenRecruit }: Props) {
  const arrears = state.staff.reduce((sum, s) => sum + s.owed, 0)

  return (
    <div className="screen staff-panel">
      <header className="screen-head">
        <h2>Personel</h2>
        <span className="muted">{state.staff.length} / {STAFF_LIMIT}</span>
      </header>

      {arrears > 0 && (
        <p className="warn">
          Zaległe wypłaty: {money(arrears)}. Nikt z zaległością nie przyjdzie do pracy.
        </p>
      )}

      {state.staff.length === 0 && (
        <p className="muted">Nikogo jeszcze nie zatrudniłeś. Wszystko robisz sam.</p>
      )}

      <ul className="staff-list">
        {state.staff.map(s => {
          const striking = s.owed > 0
          return (
            <li key={s.uid} className={`staff-row${striking ? ' striking' : ''}`}>
              <div className="staff-id">
                <strong>{s.name}</strong>
                <span className="staff-role">{ROLE_LABEL[s.role]}</span>
                <span className={`rank rank-${s.rank}`}>{RANK_LABEL[s.rank]}</span>
              </div>

              <div className="staff-state">
                {striking
                  ? <span className="warn">Strajk — zalega {money(s.owed)}</span>
                  : <span className="muted">{money(wageFor(s.role, s.rank))} / dzień</span>}
              </div>

              <div className="staff-actions">
                {striking ? (
                  <button
                    onClick={() => onSettle(s.uid)}
                    disabled={state.cash < s.owed}
                  >
                    Zapłać {money(s.owed)}
                  </button>
                ) : (
                  <button className="danger" onClick={() => onFire(s.uid)}>Zwolnij</button>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      <button
        className="primary"
        onClick={onOpenRecruit}
        disabled={state.staff.length >= STAFF_LIMIT}
      >
        {state.staff.length >= STAFF_LIMIT ? 'Komplet' : 'Rekrutacja'}
      </button>
    </div>
  )
}
