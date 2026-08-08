import type { GameState } from '../game/types'
import { DAY_MS } from '../game/constants'
import {
  CAMPAIGNS,
  type CampaignId,
  campaignById,
} from '../game/content/campaigns'
import type { MarketingAction } from '../game/marketing'
import { useI18n } from '../i18n'

interface Props {
  state: GameState
  /** The feature's one dispatcher, wired straight through from the store. */
  onMarketing: (action: MarketingAction) => void
}

const GLYPH: Record<CampaignId, string> = {
  flyers: '📬',
  social: '📱',
  billboards: '🏙️',
}

/**
 * Advertising campaigns.
 *
 * OWNER: `feat/v2-marketing`. Nobody else edits this file.
 *
 * The rows borrow the shop's visual language because advertising is another
 * purchase decision, but the live status sits above them: starting a second
 * campaign is forbidden, so the player needs to see what owns that slot before
 * comparing the offers below it.
 */
export default function MarketingScreen({ state, onMarketing }: Props) {
  const { t, money } = useI18n()
  const activeId = state.marketing.activeCampaignId
  const active = activeId === null ? null : campaignById(activeId)
  const closingsLeft = Math.max(1, Math.ceil(state.marketing.remainingMs / DAY_MS))
  const closed = state.dayEnded || state.dayMs >= DAY_MS

  return (
    <div className="screen">
      <header className="screen-head">
        <h2>{t.marketing.title}</h2>
      </header>
      <p className="hint">{t.marketing.hint}</p>

      {active && (
        <div className="stat-grid">
          <div className="stat-card">
            <div className="k">{t.marketing.activeTitle}</div>
            <div className="v">{t.marketing.campaigns[active.id].name}</div>
            <div className="shop-meta">{t.marketing.remainingClosings(closingsLeft)}</div>
          </div>
          <div className="stat-card">
            <div className="k">{t.marketing.trafficTitle}</div>
            <div className="v">{t.marketing.effect(active.spawnMultiplier)}</div>
            <div className="shop-meta">{t.marketing.billing(money(active.dailyCost))}</div>
          </div>
        </div>
      )}

      <div className="shop-list" style={{ marginTop: active ? 14 : 0 }}>
        {CAMPAIGNS.map(campaign => {
          const isActive = campaign.id === activeId
          const short = active === null && state.cash < campaign.dailyCost
          const reason = isActive
            ? null
            : active !== null
              ? t.marketing.oneAtTime
              : closed
                ? t.marketing.closed
                : short
                  ? t.marketing.short(money(campaign.dailyCost - state.cash))
                  : null

          return (
            <div className={`shop-row${reason ? ' locked' : ''}`} key={campaign.id}>
              <div className="inv-glyph">{GLYPH[campaign.id]}</div>

              <div className="shop-info">
                <div className="shop-name">{t.marketing.campaigns[campaign.id].name}</div>
                <div className="shop-meta">{t.marketing.campaigns[campaign.id].blurb}</div>
                <div className="shop-mult">{t.marketing.effect(campaign.spawnMultiplier)}</div>
                <div className="shop-meta">
                  {t.marketing.schedule(campaign.durationDays, money(campaign.dailyCost))}
                </div>
                {reason && <div className="shop-reason">{reason}</div>}
              </div>

              <button
                className={`btn${isActive ? ' primary' : ''}`}
                disabled={active !== null || closed || short}
                onClick={() => onMarketing({ type: 'start', campaignId: campaign.id })}
              >
                {isActive ? t.marketing.running : t.marketing.start}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
