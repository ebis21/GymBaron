import type { GameState } from '../game/types'
import type { SponsorAction, ConditionStatus } from '../game/sponsors'
import { canSign, conditionStatuses, signCost } from '../game/sponsors'
import { type SponsorId, SPONSORS, STRIKES_TO_LAPSE } from '../game/content/sponsors'
import { useI18n } from '../i18n'

interface Props {
  state: GameState
  /** The feature's one dispatcher, wired straight through from the store. */
  onSponsor: (action: SponsorAction) => void
}

/** The emoji standing in for each brand, in the shop's own idiom. */
const GLYPH: Record<SponsorId, string> = {
  'juice-bar': '🥤',
  'city-apparel': '👕',
  supplements: '🥫',
  'energy-drink': '⚡',
  global: '🌐',
}

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
    <div className="screen">
      <header className="screen-head">
        <h2>{t.sponsors.title}</h2>
      </header>
      <p className="hint">{t.sponsors.hint}</p>

      {activeId === null && <p className="hint muted">{t.sponsors.empty}</p>}

      <div className="shop-list">
        {SPONSORS.map(deal => {
          const conditions = conditionStatuses(state, deal.id)
          const active = activeId === deal.id
          const broken = lapsed.includes(deal.id)
          const fee = signCost(state, deal.id)
          const reason = refusal(deal.id, conditions)

          return (
            <div className={`shop-row${reason && !active ? ' locked' : ''}`} key={deal.id}>
              <div className="inv-glyph">{GLYPH[deal.id]}</div>

              <div className="shop-info">
                <div className="shop-name">
                  {t.sponsors.names[deal.id]}{' '}
                  {active && <span className="rank rank-rare">{t.sponsors.running}</span>}
                  {broken && <span className="rank rank-epic">{t.sponsors.lapsed}</span>}
                </div>
                <div className="shop-meta">{t.sponsors.blurb[deal.id]}</div>
                <div className="shop-mult">{t.sponsors.perDay(money(deal.payout))}</div>

                {conditions.map(condition => (
                  <div
                    className={`shop-meta${condition.met ? '' : ' warn'}`}
                    key={condition.kind}
                  >
                    {condition.met ? '✓' : '✗'}{' '}
                    {t.sponsors.condition[condition.kind](condition.target)}
                    {' · '}
                    {t.sponsors.progress(Math.round(condition.current), condition.target)}
                  </div>
                ))}

                {active && signedDay >= state.day && (
                  <div className="shop-meta">{t.sponsors.startsTomorrow}</div>
                )}

                {active && strikes > 0 && (
                  <div className="shop-reason">{t.sponsors.strikes(strikes, STRIKES_TO_LAPSE)}</div>
                )}

                {active && lastMiss.length > 0 && (
                  <div className="shop-reason">
                    {t.sponsors.missed(
                      lastMiss.map(kind => t.sponsors.condition[kind](
                        conditions.find(c => c.kind === kind)?.target ?? 0,
                      )).join(', '),
                    )}
                  </div>
                )}

                {broken && !active && (
                  <div className="shop-reason">{t.sponsors.lapsedHint(money(fee))}</div>
                )}

                {!active && reason && <div className="shop-reason">{reason}</div>}
              </div>

              {active ? (
                <button className="btn" onClick={() => onSponsor({ type: 'drop' })}>
                  {t.sponsors.drop}
                </button>
              ) : (
                <button
                  className="btn"
                  disabled={!canSign(state, deal.id)}
                  onClick={() => onSponsor({ type: 'sign', id: deal.id })}
                >
                  {broken ? t.sponsors.resign(money(fee)) : t.sponsors.sign}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
