import type { GameState } from '../game/types'
import { DAY_MS } from '../game/constants'
import { CAMPAIGNS, type CampaignId } from '../game/content/campaigns'
import type { MarketingAction } from '../game/marketing'
import { dailyMarketingCost, spawnRateMultiplier, unmetRequirement } from '../game/marketing'
import { outlookFor, servablePerDay } from '../game/capacity'
import { useI18n } from '../i18n'

interface Props {
  state: GameState
  /** The feature's one dispatcher, wired straight through from the store. */
  onMarketing: (action: MarketingAction) => void
}

const GLYPH: Record<CampaignId, string> = {
  flyers: '📬',
  referral: '🤝',
  social: '📱',
  billboards: '🏙️',
  premium: '💎',
  openDay: '🎉',
  influencer: '🤳',
  tv: '📺',
  national: '🌍',
}

/**
 * Advertising campaigns.
 *
 * OWNER: `feat/v2-marketing`. Nobody else edits this file.
 *
 * The rows borrow the shop's visual language because advertising is another
 * purchase decision. Two things sit above them: what is already live, since
 * campaigns stack and the player is buying a multiplier on top of a multiplier,
 * and what the gym can actually serve — the number that decides whether any of
 * this is worth paying for.
 *
 * Every unlocked offer stays clickable even when the gym cannot cope with it.
 * The overshoot warning is advice, not a lock: a player who is about to buy
 * machines this afternoon is entitled to run the ad first, and the one thing
 * worse than an unheeded warning is a button that refuses without saying what
 * would fix it.
 *
 * An unlock is the one hard stop, and locked offers stay in the ladder rather
 * than being hidden. A player who can see the national campaign three rungs
 * above them knows what the next stretch of the game is for; one who cannot
 * see it only knows the list is short.
 */
export default function MarketingScreen({ state, onMarketing }: Props) {
  const { t, money } = useI18n()
  const running = state.marketing.running
  const closed = state.dayEnded || state.dayMs >= DAY_MS
  const servable = Math.round(servablePerDay(state))
  const totalCost = dailyMarketingCost(state)

  return (
    <div className="screen">
      <header className="screen-head">
        <h2>{t.marketing.title}</h2>
      </header>
      <p className="hint">{t.marketing.hint}</p>

      <div className="stat-grid">
        {running.length > 0 && (
          <>
            <div className="stat-card">
              <div className="k">{t.marketing.activeTitle}</div>
              <div className="v">
                {running.map(r => t.marketing.campaigns[r.id].name).join(' · ')}
              </div>
              <div className="shop-meta">
                {running
                  .map(r => t.marketing.remainingClosings(
                    Math.max(1, Math.ceil(r.remainingMs / DAY_MS)),
                  ))
                  .join(' · ')}
              </div>
            </div>
            <div className="stat-card">
              <div className="k">{t.marketing.trafficTitle}</div>
              <div className="v">{t.marketing.effect(spawnRateMultiplier(state))}</div>
              <div className="shop-meta">{t.marketing.totalBilling(money(totalCost))}</div>
            </div>
          </>
        )}

        <div className="stat-card">
          <div className="k">{t.marketing.capacityTitle}</div>
          <div className="v">{servable}</div>
          <div className="shop-meta">{t.marketing.capacity(servable)}</div>
        </div>
      </div>

      <div className="shop-list" style={{ marginTop: 14 }}>
        {CAMPAIGNS.map(campaign => {
          const isRunning = running.some(r => r.id === campaign.id)
          // Priced against everything that would then be live, exactly as
          // `applyMarketing` prices it — so the reason shown is the real one.
          const owed = totalCost + campaign.dailyCost
          const short = !isRunning && state.cash < owed
          const lock = unmetRequirement(state, campaign.id)
          const outlook = outlookFor(state, campaign.id)
          const arrivals = Math.round(outlook.arrivals)
          const net = Math.round(outlook.net)

          // The unlock comes before the closing time on purpose: "come back
          // tomorrow" is wrong advice for an offer tomorrow will not open.
          const reason = isRunning
            ? t.marketing.alreadyRunning
            : lock !== null
              ? t.marketing.locked[lock](campaign.requires![lock]!)
              : closed
                ? t.marketing.closed
                : short
                  ? t.marketing.short(money(owed - state.cash))
                  : null

          const advice = isRunning || lock !== null || outlook.shortOf === null
            ? null
            : outlook.shortOf === 'reception'
              ? t.marketing.shortReception(arrivals, Math.round(outlook.servable))
              : t.marketing.shortMachines(arrivals, Math.round(outlook.servable))

          // A locked offer gets its requirement and nothing else. Projecting
          // the takings of something the player cannot buy is noise on a list
          // that is already nine rows long.
          const projecting = !isRunning && lock === null

          return (
            <div
              className={`shop-row${reason ? ' locked' : ''}`}
              key={campaign.id}
            >
              <div className="inv-glyph">{GLYPH[campaign.id]}</div>

              <div className="shop-info">
                <div className="shop-name">{t.marketing.campaigns[campaign.id].name}</div>
                <div className="shop-meta">{t.marketing.campaigns[campaign.id].blurb}</div>
                <div className="shop-mult">{t.marketing.effect(campaign.spawnMultiplier)}</div>
                <div className="shop-meta">
                  {t.marketing.schedule(campaign.durationDays, money(campaign.dailyCost))}
                </div>
                {projecting && <div className="shop-meta">{t.marketing.projected(arrivals)}</div>}
                {projecting && (
                  <div className={`shop-net ${net >= 0 ? 'good' : 'bad'}`}>
                    {net >= 0
                      ? t.marketing.gain(money(net))
                      : t.marketing.loss(money(Math.abs(net)))}
                  </div>
                )}
                {advice && <div className="shop-reason">{advice}</div>}
                {reason && <div className="shop-reason">{reason}</div>}
              </div>

              <button
                className={`btn${isRunning ? ' primary' : ''}`}
                disabled={isRunning || closed || short || lock !== null}
                onClick={() => onMarketing({ type: 'start', campaignId: campaign.id })}
              >
                {isRunning ? t.marketing.running : t.marketing.start}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
