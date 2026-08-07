import type { GameState, StaffRole } from '../game/types'
import { RANK_LABEL, wageFor, workMsFor, roleUnlockLevel, STAFF_LIMIT } from '../game/content/staff'
import { REFRESH_PRICE, displayName } from '../game/recruit'
import { TRAINER_FEE_MULT } from '../game/constants'
import { useI18n, type I18n } from '../i18n'

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
function jobHint(role: StaffRole, ms: number, t: I18n['t']): string {
  const hints = t.recruit.jobHint
  if (role === 'reception') return hints.reception((ms / 1000).toFixed(1))
  if (role === 'cleaner') return hints.cleaner((ms / 1000).toFixed(1))
  if (role === 'repair') return hints.repair((ms / 1000).toFixed(0))
  return hints.trainer(TRAINER_FEE_MULT)
}

export default function RecruitScreen({ state, onHire, onReroll, onBack }: Props) {
  const { t, money, language } = useI18n()
  const full = state.staff.length >= STAFF_LIMIT
  const hasDesk = state.decor.some(d => d.type === 'reception')

  return (
    <div className="screen recruit">
      <header className="screen-head">
        <button className="btn ghost tiny" onClick={onBack}>‹</button>
        <h2>{t.recruit.title}</h2>
        <button className="btn ghost tiny" onClick={onReroll} disabled={state.cash < REFRESH_PRICE}>
          {t.recruit.refresh(money(REFRESH_PRICE))}
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
                <strong>{displayName(c.name, language)}</strong>
                <span className="staff-role">{t.content.roles[c.role]}</span>
                <span className={`rank rank-${c.rank}`}>{RANK_LABEL[c.rank]}</span>
              </div>

              <div className="candidate-stats">
                <span>{jobHint(c.role, workMsFor(c.role, c.rank), t)}</span>
                <span>{t.recruit.perDay(money(wageFor(c.role, c.rank)))}</span>
              </div>

              {!afford && !full && !needsDesk && !locked && (
                <div className="shop-reason">{t.recruit.tooPoor(money(c.price - state.cash))}</div>
              )}

              <button
                className="btn primary block"
                onClick={() => onHire(c.uid)}
                disabled={full || needsDesk || locked || !afford}
              >
                {locked
                  ? t.recruit.fromLevel(needsLevel)
                  : needsDesk ? t.recruit.needsDesk
                  : full ? t.recruit.full
                  : t.recruit.hire(money(c.price))}
              </button>
            </li>
          )
        })}
      </ul>

      <p className="muted">{t.recruit.footer}</p>
    </div>
  )
}
