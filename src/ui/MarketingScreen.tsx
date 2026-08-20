import type { GameState } from '../game/types'
import { DAY_MS } from '../game/constants'
import { CAMPAIGNS } from '../game/content/campaigns'
import type { MarketingAction } from '../game/marketing'
import { dailyMarketingCost, spawnRateMultiplier } from '../game/marketing'
import { outlookFor, servablePerDay } from '../game/capacity'
import { useI18n } from '../i18n'
import ManagementIcon from './ManagementIcon'

interface Props {
  state: GameState
  /** The feature's one dispatcher, wired straight through from the store. */
  onMarketing: (action: MarketingAction) => void
}

/**
 * Advertising campaigns.
 *
 * OWNER: `feat/v2-marketing`. Nobody else edits this file.
 *
 * The offers share the shop's visual language because advertising is another
 * purchase decision. Two things sit above them: what is already live, since
 * campaigns stack and the player is buying a multiplier on top of a multiplier,
 * and what the gym can actually serve — the number that decides whether any of
 * this is worth paying for.
 *
 * Every offer stays clickable even when the gym cannot cope with it. The
 * warning is advice, not a lock: a player who is about to buy machines this
 * afternoon is entitled to run the ad first, and the one thing worse than an
 * unheeded warning is a button that refuses without saying what would fix it.
 */
export default function MarketingScreen({ state, onMarketing }: Props) {
  const { t, money } = useI18n()
  const running = state.marketing.running
  const closed = state.dayEnded || state.dayMs >= DAY_MS
  const servable = Math.round(servablePerDay(state))
  const totalCost = dailyMarketingCost(state)

  return (
    <div className="screen management-screen management-marketing">
      <header className="management-hero">
        <div className="management-hero-mark">
          <ManagementIcon name="marketing" />
        </div>
        <div className="management-hero-copy">
          <h2>{t.marketing.title}</h2>
          <p>{t.marketing.hint}</p>
        </div>
        <div className="management-wallet">
          <span>{t.topbar.cash}</span>
          <strong>{money(state.cash)}</strong>
        </div>
      </header>

      <div className="management-summary-grid">
        {running.length > 0 && (
          <div className="management-summary-card active-campaigns">
            <span>{t.marketing.activeTitle}</span>
            <div className="active-campaign-list">
              {running.map(r => (
                <div className="active-campaign" key={r.id}>
                  <ManagementIcon name={r.id} />
                  <strong>{t.marketing.campaigns[r.id].name}</strong>
                  <small>
                    {t.marketing.remainingClosings(
                      Math.max(1, Math.ceil(r.remainingMs / DAY_MS)),
                    )}
                  </small>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="management-summary-card">
          <span>{t.marketing.trafficTitle}</span>
          <strong>{t.marketing.effect(spawnRateMultiplier(state))}</strong>
          <small>{t.marketing.totalBilling(money(totalCost))}</small>
        </div>

        <div className="management-summary-card">
          <span>{t.marketing.capacityTitle}</span>
          <strong>{servable}</strong>
          <small>{t.marketing.capacity(servable)}</small>
        </div>
      </div>

      <div className="management-grid campaign-grid">
        {CAMPAIGNS.map(campaign => {
          const isRunning = running.some(r => r.id === campaign.id)
          // Priced against everything that would then be live, exactly as
          // `applyMarketing` prices it — so the reason shown is the real one.
          const owed = totalCost + campaign.dailyCost
          const short = !isRunning && state.cash < owed
          const outlook = outlookFor(state, campaign.id)
          const arrivals = Math.round(outlook.arrivals)

          const reason = isRunning
            ? t.marketing.alreadyRunning
            : closed
              ? t.marketing.closed
              : short
                ? t.marketing.short(money(owed - state.cash))
                : null

          const advice = isRunning || outlook.shortOf === null
            ? null
            : outlook.shortOf === 'reception'
              ? t.marketing.shortReception(arrivals, Math.round(outlook.servable))
              : t.marketing.shortMachines(arrivals, Math.round(outlook.servable))

          return (
            <article
              className={`management-card campaign-card tone-${campaign.id}${reason ? ' is-locked' : ''}${isRunning ? ' is-live' : ''}`}
              key={campaign.id}
            >
              <div className="management-card-head">
                <div className="management-card-icon">
                  <ManagementIcon name={campaign.id} />
                </div>
                <div className="management-card-title">
                  <span className="management-eyebrow">
                    {t.marketing.schedule(campaign.durationDays, money(campaign.dailyCost))}
                  </span>
                  <h3>{t.marketing.campaigns[campaign.id].name}</h3>
                </div>
                {isRunning && <span className="management-state live">{t.marketing.running}</span>}
              </div>

              <p className="management-card-copy">{t.marketing.campaigns[campaign.id].blurb}</p>

              <div className="campaign-metrics">
                <strong>{t.marketing.effect(campaign.spawnMultiplier)}</strong>
                {!isRunning && <span>{t.marketing.projected(arrivals)}</span>}
              </div>

              {advice && <div className="management-notice warning">{advice}</div>}
              {reason && !isRunning && <div className="management-notice danger">{reason}</div>}

              <button
                className="btn management-cta"
                disabled={isRunning || closed || short}
                onClick={() => onMarketing({ type: 'start', campaignId: campaign.id })}
              >
                {isRunning ? t.marketing.running : t.marketing.start}
              </button>
            </article>
          )
        })}
      </div>
    </div>
  )
}
