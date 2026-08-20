import type { GameState, Staff } from '../game/types'
import { RANK_LABEL, wageFor } from '../game/content/staff'
import { isTrainerFree, staffLimit } from '../game/staff'
import { displayName } from '../game/recruit'
import { HIRING_UNLOCK_LEVEL, STAFF_UNLOCK_LEVEL } from '../game/constants'
import { useI18n, type I18n } from '../i18n'
import ManagementIcon from './ManagementIcon'

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

/** The first visit to Staff uses the same ledger chrome, even before hiring opens. */
export function StaffLockedScreen({ state }: { state: GameState }) {
  const { t, money } = useI18n()

  return (
    <div className="screen management-screen staff-management">
      <header className="management-hero staff-ledger-hero">
        <div className="management-hero-mark"><ManagementIcon name="staff" /></div>
        <div className="management-hero-copy">
          <h2>{t.staff.title}</h2>
          <p>{t.staff.hint}</p>
        </div>
        <div className="management-wallet">
          <span>{t.topbar.cash}</span>
          <strong>{money(state.cash)}</strong>
        </div>
      </header>

      <article className="management-card staff-ledger-locked is-locked">
        <div className="management-card-head">
          <div className="management-card-icon"><ManagementIcon name="recruit" /></div>
          <div className="management-card-title">
            <span className="management-eyebrow">{t.stats.level}</span>
            <h3>{state.level}</h3>
          </div>
        </div>
        <div className="management-notice warning">
          {t.staff.locked(HIRING_UNLOCK_LEVEL, STAFF_UNLOCK_LEVEL, state.level)}
        </div>
      </article>
    </div>
  )
}

/**
 * The payroll, presented as the owner's physical staff ledger. A striking
 * employee is the one entry that needs to shout: they still occupy a slot and
 * do no work, with the remedy kept on that same card.
 */
export default function StaffPanel({ state, onFire, onSettle, onOpenRecruit }: Props) {
  const { t, money, language } = useI18n()
  const arrears = state.staff.reduce((sum, s) => sum + s.owed, 0)
  const payroll = state.staff.reduce((sum, s) => sum + wageFor(s.role, s.rank), 0)
  const limit = staffLimit(state)
  const full = state.staff.length >= limit

  return (
    <div className="screen management-screen staff-management">
      <header className="management-hero staff-ledger-hero">
        <div className="management-hero-mark">
          <ManagementIcon name="staff" />
        </div>
        <div className="management-hero-copy">
          <h2 id="staff-ledger-title">{t.staff.title}</h2>
          <p>{t.staff.hint}</p>
        </div>
        <div className="management-wallet">
          <span>{t.topbar.cash}</span>
          <strong>{money(state.cash)}</strong>
        </div>
      </header>

      <div
        className="management-summary-grid staff-ledger-summary"
        aria-labelledby="staff-ledger-title"
      >
        <div className="management-summary-card">
          <span>{t.staff.team}</span>
          <strong>{state.staff.length} / {limit}</strong>
          <small>
            {full ? t.staff.full : t.staff.slotsOpen(Math.max(0, limit - state.staff.length))}
          </small>
        </div>
        <div className="management-summary-card">
          <span>{t.staff.payroll}</span>
          <strong>{money(payroll)}</strong>
          <small>{t.staff.payrollDue}</small>
        </div>
      </div>

      {arrears > 0 && (
        <div className="management-notice danger staff-ledger-arrears" role="status">
          {t.staff.arrears(money(arrears))}
        </div>
      )}

      {state.staff.length === 0 ? (
        <article className="management-card staff-ledger-empty">
          <div className="management-card-head">
            <div className="management-card-icon">
              <ManagementIcon name="staff" />
            </div>
            <div className="management-card-title">
              <span className="management-eyebrow">{t.staff.title}</span>
              <h3>{t.staff.emptyTitle}</h3>
            </div>
          </div>
          <p className="management-card-copy">{t.staff.none}</p>
        </article>
      ) : (
        <div
          className="management-grid staff-ledger-grid"
          role="list"
          aria-labelledby="staff-ledger-title"
        >
          {state.staff.map(s => {
            const striking = s.owed > 0
            const doing = striking ? null : activity(state, s, t)

            return (
              <article
                key={s.uid}
                className={`management-card staff-ledger-card role-${s.role}${striking ? ' is-striking' : ''}`}
                role="listitem"
              >
                <div className="management-card-head">
                  <div className="management-card-icon">
                    <ManagementIcon name={s.role} />
                  </div>
                  <div className="management-card-title">
                    <span className="management-eyebrow">{t.content.roles[s.role]}</span>
                    <h3>{displayName(s.name, language)}</h3>
                  </div>
                  <span className={`management-state rank rank-${s.rank}`}>
                    {RANK_LABEL[s.rank]}
                  </span>
                </div>

                <div className="product-value staff-ledger-wage">
                  <span className="management-eyebrow">{t.report.wages}</span>
                  <strong>{t.staff.perDay(money(wageFor(s.role, s.rank)))}</strong>
                </div>

                {striking ? (
                  <>
                    <div className="management-notice danger staff-ledger-status" role="status">
                      {t.staff.striking(money(s.owed))}
                    </div>
                    {state.cash < s.owed && (
                      <div className="management-notice danger staff-ledger-shortfall">
                        {t.shop.short(money(s.owed - state.cash))}
                      </div>
                    )}
                  </>
                ) : doing ? (
                  <p className="management-card-copy staff-ledger-status">{doing}</p>
                ) : null}

                {striking ? (
                  <button
                    type="button"
                    className="btn ghost management-cta staff-ledger-action"
                    onClick={() => onSettle(s.uid)}
                    disabled={state.cash < s.owed}
                  >
                    {t.staff.pay(money(s.owed))}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn danger management-cta staff-ledger-action"
                    onClick={() => onFire(s.uid)}
                  >
                    {t.staff.fire}
                  </button>
                )}
              </article>
            )
          })}
        </div>
      )}

      <button
        type="button"
        className="btn primary management-cta staff-ledger-recruit"
        onClick={onOpenRecruit}
        disabled={full}
      >
        {full ? t.staff.full : t.staff.recruit}
      </button>
    </div>
  )
}
