import type { GameState, StaffRole } from '../game/types'
import { RANK_LABEL, wageFor, workMsFor, roleUnlockLevel } from '../game/content/staff'
import { freeDesks, staffLimit } from '../game/staff'
import { REFRESH_PRICE, displayName } from '../game/recruit'
import { TRAINER_FEE_MULT } from '../game/constants'
import { useI18n, type I18n } from '../i18n'
import ManagementIcon from './ManagementIcon'

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

/** The hiring board is the second leaf of the owner's staff ledger. */
export default function RecruitScreen({ state, onHire, onReroll, onBack }: Props) {
  const { t, money, language } = useI18n()
  const limit = staffLimit(state)
  const full = state.staff.length >= limit
  // A desk already claimed by somebody is not a vacancy: `pickJob` gives one
  // counter to one receptionist, so hiring past that buys a wage and no scans.
  const deskFree = freeDesks(state) > 0

  return (
    <div className="screen management-screen staff-management recruit-management">
      <header className="management-hero recruit-management-hero">
        <div className="management-hero-mark">
          <ManagementIcon name="recruit" />
        </div>
        <div className="management-hero-copy">
          <h2 id="recruit-management-title">{t.recruit.title}</h2>
          <p>{t.recruit.hint}</p>
        </div>
        <div className="management-wallet">
          <span>{t.topbar.cash}</span>
          <strong>{money(state.cash)}</strong>
        </div>
      </header>

      <div className="recruit-management-toolbar">
        <button type="button" className="btn ghost" onClick={onBack}>
          ‹ {t.staff.title}
        </button>
        <div className="management-summary-card recruit-management-capacity">
          <span>{t.staff.team}</span>
          <strong>{state.staff.length} / {limit}</strong>
          <small>
            {full ? t.staff.full : t.staff.slotsOpen(Math.max(0, limit - state.staff.length))}
          </small>
        </div>
        <button
          type="button"
          className="btn ghost"
          onClick={onReroll}
          disabled={state.cash < REFRESH_PRICE}
        >
          {t.recruit.refresh(money(REFRESH_PRICE))}
        </button>
      </div>

      <div
        className="management-grid recruit-management-grid"
        role="list"
        aria-labelledby="recruit-management-title"
      >
        {state.candidates.map(c => {
          const needsDesk = c.role === 'reception' && !deskFree
          const needsLevel = roleUnlockLevel(c.role)
          const locked = state.level < needsLevel
          const afford = state.cash >= c.price

          return (
            <article
              key={c.uid}
              className={`management-card recruit-management-card role-${c.role}${full || needsDesk || locked || !afford ? ' is-locked' : ''}`}
              role="listitem"
            >
              <div className="management-card-head">
                <div className="management-card-icon">
                  <ManagementIcon name={c.role} />
                </div>
                <div className="management-card-title">
                  <span className="management-eyebrow">{t.content.roles[c.role]}</span>
                  <h3>{displayName(c.name, language)}</h3>
                </div>
                <span className={`management-state rank rank-${c.rank}`}>
                  {RANK_LABEL[c.rank]}
                </span>
              </div>

              <div className="product-value recruit-management-job">
                <strong>{jobHint(c.role, workMsFor(c.role, c.rank), t)}</strong>
              </div>
              <p className="management-card-copy recruit-management-wage">
                {t.staff.payroll}: {t.recruit.perDay(money(wageFor(c.role, c.rank)))}
              </p>

              {!afford && !full && !needsDesk && !locked && (
                <div className="management-notice danger">
                  {t.recruit.tooPoor(money(c.price - state.cash))}
                </div>
              )}

              <button
                type="button"
                className="btn primary management-cta recruit-management-action"
                onClick={() => onHire(c.uid)}
                disabled={full || needsDesk || locked || !afford}
              >
                {locked
                  ? t.recruit.fromLevel(needsLevel)
                  : needsDesk ? t.recruit.needsDesk
                  : full ? t.recruit.full
                  : t.recruit.hire(money(c.price))}
              </button>
            </article>
          )
        })}
      </div>
    </div>
  )
}
