import type { GameState, StaffRole } from '../game/types'
import {
  ROLE_LABEL, RANK_LABEL, wageFor, workMsFor, roleUnlockLevel, STAFF_LIMIT,
} from '../game/content/staff'
import { REFRESH_PRICE } from '../game/recruit'
import { TRAINER_FEE_MULT } from '../game/constants'
import { money } from './format'

interface Props {
  state: GameState
  onHire: (uid: string) => void
  onReroll: () => void
  onBack: () => void
}

/**
 * The one number that says what hiring this person changes. A trainer has no
 * such clock — they are booked per visit, not per task — so theirs is the fee
 * the booking earns instead.
 */
const JOB_HINT: Record<StaffRole, (ms: number) => string> = {
  reception: ms => `skan co ${(ms / 1000).toFixed(1)} s`,
  cleaner: ms => `plama w ${(ms / 1000).toFixed(1)} s`,
  repair: ms => `naprawa w ${(ms / 1000).toFixed(0)} s`,
  trainer: () => `trening 1:1 — ×${TRAINER_FEE_MULT} za wejście`,
}

export default function RecruitScreen({ state, onHire, onReroll, onBack }: Props) {
  const full = state.staff.length >= STAFF_LIMIT
  const hasDesk = state.decor.some(d => d.type === 'reception')

  return (
    <div className="screen recruit">
      <header className="screen-head">
        <button className="btn ghost tiny" onClick={onBack}>‹</button>
        <h2>Rekrutacja</h2>
        <button className="btn ghost tiny" onClick={onReroll} disabled={state.cash < REFRESH_PRICE}>
          Odśwież {money(REFRESH_PRICE)}
        </button>
      </header>

      <ul className="candidate-list">
        {state.candidates.map(c => {
          const needsDesk = c.role === 'reception' && !hasDesk
          const needsLevel = roleUnlockLevel(c.role)
          const locked = state.level < needsLevel
          const afford = state.cash >= c.price
          return (
            <li key={c.uid} className="candidate">
              <div className="candidate-id">
                <strong>{c.name}</strong>
                <span className="staff-role">{ROLE_LABEL[c.role]}</span>
                <span className={`rank rank-${c.rank}`}>{RANK_LABEL[c.rank]}</span>
              </div>

              <div className="candidate-stats">
                <span>{JOB_HINT[c.role]!(workMsFor(c.role, c.rank))}</span>
                <span>{money(wageFor(c.role, c.rank))} / dzień</span>
              </div>

              {!afford && !full && !needsDesk && !locked && (
                <div className="shop-reason">Za mało gotówki — brakuje {money(c.price - state.cash)}</div>
              )}

              <button
                className="btn primary block"
                onClick={() => onHire(c.uid)}
                disabled={full || needsDesk || locked || !afford}
              >
                {locked
                  ? `Od poziomu ${needsLevel}`
                  : needsDesk ? 'Brak biurka'
                  : full ? 'Komplet'
                  : `Zatrudnij za ${money(c.price)}`}
              </button>
            </li>
          )
        })}
      </ul>

      <p className="muted">
        Pensja schodzi codziennie na zamknięciu dnia. Kto nie dostanie wypłaty,
        ten nie przyjdzie następnego dnia do pracy.
      </p>
    </div>
  )
}
