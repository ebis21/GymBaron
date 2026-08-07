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

interface Props {
  state: GameState
  onBuy: (id: UpgradeId) => void
}

/** The emoji standing in for each track, in place of the shop's drawn icons. */
const GLYPH: Record<UpgradeId, string> = {
  cleaning: '🧹',
  repair: '🔧',
  earnings: '💰',
  luck: '🍀',
  patience: '⏳',
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
 * Everything the player can pay to get better at, one row per track. Styled
 * with the shop's own classes on purpose — this is a shop, and it should not
 * look like a different game.
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
    <div className="screen">
      <h2 className="section-title">{t.upgrades.title}</h2>
      <p className="hint">{t.upgrades.hint}</p>

      <div className="shop-list">
        {UPGRADES.map(track => {
          const level = upgradeLevel(state, track.id)
          const max = maxLevel(track.id)
          const next = nextUpgrade(track.id, level)
          const current = upgradeValueAt(track.id, level)

          const short = next && state.cash < next.price
          const reason = short ? t.shop.short(money(next.price - state.cash)) : null

          return (
            <div className={`shop-row${reason ? ' locked' : ''}`} key={track.id}>
              <div className="inv-glyph">{GLYPH[track.id]}</div>

              <div className="shop-info">
                <div className="shop-name">{t.content.upgrades[track.id]}</div>
                <div className="shop-meta">{t.upgrades.blurb[track.id]}</div>

                <div className="shop-mult">
                  {next
                    ? t.upgrades.step(
                        format(track.id, current),
                        format(track.id, next.value),
                      )
                    : t.upgrades.current(format(track.id, current))}
                </div>

                <div className="shop-meta">{t.upgrades.level(level, max)}</div>
                <div className="meter">
                  <div className="meter-fill" style={{ width: `${(level / max) * 100}%` }} />
                </div>

                {reason && <div className="shop-reason">{reason}</div>}
              </div>

              {next ? (
                <button
                  className="btn"
                  disabled={reason !== null}
                  onClick={() => onBuy(track.id)}
                >
                  {money(next.price)}
                </button>
              ) : (
                <div className="shop-meta">{t.upgrades.maxed}</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
