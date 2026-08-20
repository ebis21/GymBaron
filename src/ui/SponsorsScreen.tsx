import type { GameState } from '../game/types'
import type { SponsorAction, ConditionStatus } from '../game/sponsors'
import { canSign, conditionStatuses, signCost } from '../game/sponsors'
import { type SponsorId, SPONSORS, STRIKES_TO_LAPSE } from '../game/content/sponsors'
import { useI18n } from '../i18n'
import ManagementIcon from './ManagementIcon'

interface Props {
  state: GameState
  /** The feature's one dispatcher, wired straight through from the store. */
  onSponsor: (action: SponsorAction) => void
}

/** Do not round 14.6 reputation into a visually contradictory `✗ 15 / 15`. */
const displayProgress = (value: number): number =>
  Number.isInteger(value) ? value : Number(value.toFixed(1))

/**
 * Sponsorship deals.
 *
 * OWNER: `feat/v2-sponsors`. Nobody else edits this file.
 *
 * The running deal is not given a panel of its own. Every deal on the board
 * shows the same conditions against the same live figures, so lifting one out
 * would print the whole thing twice — and the player learns the bar for the
 * next rung by watching how far off it is while holding this one.
 */
export default function SponsorsScreen({ state, onSponsor }: Props) {
  const { t, money } = useI18n()
  const { activeId, signedDay, strikes, lapsed, lastMiss } = state.sponsors

  /**
   * The reason the button is refusing, or null when it is not. Standing
   * conditions come first: a player who cannot meet the brand should be told
   * that rather than the price of a second chance they are not being offered.
   */
  const refusal = (id: SponsorId, conditions: ConditionStatus[]): string | null => {
    if (conditions.some(c => c.standing && !c.met)) return t.sponsors.needsStanding
    const fee = signCost(state, id)
    if (state.cash < fee) return t.sponsors.short(money(fee - state.cash))
    return null
  }

  return (
    <div className="screen management-screen management-sponsors">
      <header className="management-hero">
        <div className="management-hero-mark">
          <ManagementIcon name="sponsor" />
        </div>
        <div className="management-hero-copy">
          <h2>{t.sponsors.title}</h2>
          <p>{t.sponsors.hint}</p>
        </div>
        <div className="management-wallet">
          <span>{t.topbar.cash}</span>
          <strong>{money(state.cash)}</strong>
        </div>
      </header>

      {activeId === null && <p className="hint muted">{t.sponsors.empty}</p>}

      <div className="management-grid sponsor-grid">
        {SPONSORS.map(deal => {
          const conditions = conditionStatuses(state, deal.id)
          const active = activeId === deal.id
          const broken = lapsed.includes(deal.id)
          const fee = signCost(state, deal.id)
          const reason = refusal(deal.id, conditions)

          return (
            <article
              className={`management-card sponsor-card sponsor-${deal.id}${reason && !active ? ' is-locked' : ''}${active ? ' is-live' : ''}`}
              key={deal.id}
            >
              <div className="management-card-head">
                <div className="management-card-icon sponsor-brand-icon">
                  <ManagementIcon name={deal.id} />
                </div>
                <div className="management-card-title">
                  <h3>{t.sponsors.names[deal.id]}</h3>
                </div>
                {active && <span className="management-state live">{t.sponsors.running}</span>}
                {broken && !active && (
                  <span className="management-state broken">{t.sponsors.lapsed}</span>
                )}
              </div>

              <p className="management-card-copy">{t.sponsors.blurb[deal.id]}</p>

              <div className="product-value">
                {t.sponsors.perDay(money(deal.payout))}
              </div>

              <div className="sponsor-conditions">
                {conditions.map(condition => {
                  const description = t.sponsors.condition[condition.kind](condition.target)
                  return (
                    <div
                      className={`sponsor-condition${condition.met ? ' is-met' : ' is-pending'}${condition.standing ? ' is-standing' : ' is-daily'}`}
                      key={condition.kind}
                    >
                      <span className="sponsor-condition-mark" aria-hidden="true">
                        {condition.met ? '✓' : '!'}
                      </span>
                      <span className="sponsor-condition-copy">{description}</span>
                      <strong>{t.sponsors.progress(
                        displayProgress(condition.current),
                        condition.target,
                      )}</strong>
                    </div>
                  )
                })}
              </div>

              {active && signedDay >= state.day && (
                <div className="management-notice warning">{t.sponsors.startsTomorrow}</div>
              )}

              {active && (strikes > 0 || lastMiss.length > 0) && (
                <div className="management-notice danger">
                  {strikes > 0 && (
                    <div>{t.sponsors.strikes(strikes, STRIKES_TO_LAPSE)}</div>
                  )}

                  {lastMiss.length > 0 && (
                    <div>
                      {t.sponsors.missed(
                        lastMiss.map(kind => t.sponsors.condition[kind](
                          conditions.find(c => c.kind === kind)?.target ?? 0,
                        )).join(', '),
                      )}
                    </div>
                  )}
                </div>
              )}

              {broken && !active && (
                <div className="management-notice danger">
                  <strong>{t.sponsors.lapsed}</strong> · {t.sponsors.lapsedHint(money(fee))}
                </div>
              )}

              {!active && reason && <div className="management-notice danger">{reason}</div>}

              {active ? (
                <button
                  className="btn ghost management-cta"
                  onClick={() => onSponsor({ type: 'drop' })}
                >
                  {t.sponsors.drop}
                </button>
              ) : (
                <button
                  className="btn management-cta"
                  disabled={!canSign(state, deal.id)}
                  onClick={() => onSponsor({ type: 'sign', id: deal.id })}
                >
                  {broken ? t.sponsors.resign(money(fee)) : t.sponsors.sign}
                </button>
              )}
            </article>
          )
        })}
      </div>
    </div>
  )
}
