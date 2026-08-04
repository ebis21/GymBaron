import type { GameState } from '../game/types'
import { ROLE_LABEL, RANK_LABEL, wageFor, workMsFor, STAFF_LIMIT } from '../game/content/staff'
import { REFRESH_PRICE } from '../game/recruit'
import { money } from './format'

interface Props {
  state: GameState
  onHire: (uid: string) => void
  onReroll: () => void
  onBack: () => void
}

const JOB_HINT: Record<string, (ms: number) => string> = {
  reception: ms => `skan co ${(ms / 1000).toFixed(1)} s`,
  cleaner: ms => `plama w ${(ms / 1000).toFixed(1)} s`,
  repair: ms => `naprawa w ${(ms / 1000).toFixed(0)} s`,
}

export default function RecruitScreen({ state, onHire, onReroll, onBack }: Props) {
  const full = state.staff.length >= STAFF_LIMIT
  const hasDesk = state.decor.some(d => d.type === 'reception')

  return (
    <div className="screen recruit">
      <header className="screen-head">
        <button className="back" onClick={onBack}>‹</button>
        <h2>Rekrutacja</h2>
        <button onClick={onReroll} disabled={state.cash < REFRESH_PRICE}>
          Odśwież {money(REFRESH_PRICE)}
        </button>
      </header>

      <ul className="candidate-list">
        {state.candidates.map(c => {
          const needsDesk = c.role === 'reception' && !hasDesk
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

              <button
                className="primary"
                onClick={() => onHire(c.uid)}
                disabled={full || needsDesk}
              >
                {needsDesk ? 'Brak biurka' : full ? 'Komplet' : 'Zatrudnij'}
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
