import type { GameState, Staff } from '../game/types'
import { RANK_LABEL, wageFor } from '../game/content/staff'
import { isTrainerFree, staffLimit } from '../game/staff'
import { displayName } from '../game/recruit'
import { useI18n, type I18n } from '../i18n'

interface Props {
  state: GameState
  onFire: (uid: string) => void
  onSettle: (uid: string) => void
  onOpenRecruit: () => void
}

/**
 * What this employee is doing right now, when that is worth a line. Only the
 * trainer has a state the player chose and can change — everybody else works
 * whatever the floor throws at them — so only the trainer says anything.
 */
function activity(state: GameState, s: Staff, t: I18n['t']): string | null {
  if (s.role !== 'trainer') return null
  return isTrainerFree(state, s.uid) ? t.staff.trainerFree : t.staff.trainerBusy
}

/**
 * The payroll. A striking employee is the one thing here that needs to shout:
 * they are still costing a slot and doing nothing, and the way out is a button.
 */
export default function StaffPanel({ state, onFire, onSettle, onOpenRecruit }: Props) {
  const { t, money, language } = useI18n()
  const arrears = state.staff.reduce((sum, s) => sum + s.owed, 0)
  const limit = staffLimit(state)
  const full = state.staff.length >= limit

  return (
    <div className="screen staff-panel">
      <header className="screen-head">
        <h2>{t.staff.title}</h2>
        <span className="muted">{state.staff.length} / {limit}</span>
      </header>

      {arrears > 0 && <p className="warn">{t.staff.arrears(money(arrears))}</p>}

      {state.staff.length === 0 && <p className="muted">{t.staff.none}</p>}

      <ul className="staff-list">
        {state.staff.map(s => {
          const striking = s.owed > 0
          const doing = striking ? null : activity(state, s, t)
          return (
            <li key={s.uid} className={`staff-row${striking ? ' striking' : ''}`}>
              <div className="staff-id">
                <strong>{displayName(s.name, language)}</strong>
                <span className="staff-role">{t.content.roles[s.role]}</span>
                <span className={`rank rank-${s.rank}`}>{RANK_LABEL[s.rank]}</span>
              </div>

              <div className="staff-state">
                {striking
                  ? <span className="warn">{t.staff.striking(money(s.owed))}</span>
                  : <span className="muted">{t.staff.perDay(money(wageFor(s.role, s.rank)))}</span>}
                {doing && <span className="muted">{doing}</span>}
              </div>

              <div className="staff-actions">
                {striking ? (
                  <button
                    className="btn ghost"
                    onClick={() => onSettle(s.uid)}
                    disabled={state.cash < s.owed}
                  >
                    {t.staff.pay(money(s.owed))}
                  </button>
                ) : (
                  <button className="btn danger" onClick={() => onFire(s.uid)}>
                    {t.staff.fire}
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      <button
        className="btn primary block"
        onClick={onOpenRecruit}
        disabled={full}
      >
        {full ? t.staff.full : t.staff.recruit}
      </button>
    </div>
  )
}
