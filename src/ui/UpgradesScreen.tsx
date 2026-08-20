import type { GameState } from '../game/types'
import {
  type UpgradeId,
  UPGRADES,
  maxLevel,
  nextUpgrade,
  upgradeValueAt,
} from '../game/content/upgrades'
import { upgradeLevel } from '../game/upgrades'
import { useI18n } from '../i18n'
import ManagementIcon from './ManagementIcon'

interface Props {
  state: GameState
  onBuy: (id: UpgradeId) => void
}

/**
 * Three tracks are measured in milliseconds and two are bare multipliers, so
 * they cannot share one formatter. Keeping the choice in a `Record` rather than
 * on the track itself keeps presentation out of `content/upgrades.ts` while
 * still making a forgotten track a compile error here.
 */
const UNIT: Record<UpgradeId, 'seconds' | 'mult'> = {
  cleaning: 'seconds',
  repair: 'seconds',
  earnings: 'mult',
  luck: 'mult',
  patience: 'seconds',
}

/**
 * Everything the player can pay to get better at, one focused card per track.
 * The cards share the management chrome with the shop and advertising, but
 * keep progress as their primary visual rather than pretending to sell an
 * item that can be placed on the floor.
 */
export default function UpgradesScreen({ state, onBuy }: Props) {
  const { t, money } = useI18n()

  /**
   * Seconds are printed to one decimal only when there is one, so a 2.5s rung
   * reads `2.5s` and a 30s rung reads `30s` rather than `30.0s`.
   */
  const format = (id: UpgradeId, value: number): string => {
    if (UNIT[id] === 'mult') return t.upgrades.mult(value.toFixed(1))
    const seconds = value / 1000
    return t.upgrades.seconds(
      Number.isInteger(seconds) ? String(seconds) : seconds.toFixed(1),
    )
  }

  return (
    <div className="screen management-screen management-upgrades">
      <header className="management-hero">
        <div className="management-hero-mark">
          <ManagementIcon name="upgrade" />
        </div>
        <div className="management-hero-copy">
          <h2>{t.upgrades.title}</h2>
          <p>{t.upgrades.hint}</p>
        </div>
        <div className="management-wallet">
          <span>{t.topbar.cash}</span>
          <strong>{money(state.cash)}</strong>
        </div>
      </header>

      <div className="management-grid upgrade-grid">
        {UPGRADES.map(track => {
          const level = upgradeLevel(state, track.id)
          const max = maxLevel(track.id)
          const next = nextUpgrade(track.id, level)
          const current = upgradeValueAt(track.id, level)

          const short = next && state.cash < next.price
          const reason = short ? t.shop.short(money(next.price - state.cash)) : null

          return (
            <article
              className={`management-card upgrade-card tone-${track.id}${reason ? ' is-locked' : ''}${!next ? ' is-complete' : ''}`}
              key={track.id}
            >
              <div className="management-card-head">
                <div className="management-card-icon">
                  <ManagementIcon name={track.id} />
                </div>
                <div className="management-card-title">
                  <span className="management-eyebrow">{t.upgrades.level(level, max)}</span>
                  <h3>{t.content.upgrades[track.id]}</h3>
                </div>
                {!next && <span className="management-state complete">{t.upgrades.maxed}</span>}
              </div>

              <p className="management-card-copy">{t.upgrades.blurb[track.id]}</p>

              <div className="upgrade-step">
                <strong>
                  {next
                    ? t.upgrades.step(format(track.id, current), format(track.id, next.value))
                    : t.upgrades.current(format(track.id, current))}
                </strong>
              </div>

              <div className="upgrade-rungs" aria-hidden="true">
                {Array.from({ length: max }, (_, rung) => (
                  <span
                    className={`${rung < level ? 'done' : ''}${rung === level && next ? ' next' : ''}`}
                    key={rung}
                  />
                ))}
              </div>

              {reason && <div className="management-notice danger">{reason}</div>}

              {next ? (
                <button
                  className="btn management-cta"
                  disabled={reason !== null}
                  onClick={() => onBuy(track.id)}
                >
                  {t.upgrades.buy(money(next.price))}
                </button>
              ) : (
                <div className="management-complete-mark" aria-hidden="true">✓</div>
              )}
            </article>
          )
        })}
      </div>
    </div>
  )
}
