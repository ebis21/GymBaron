import type { DiamondUpgradeId, GameState } from '../game/types'
import { DIAMOND_UPGRADE_SPECS, diamondUpgradeCost } from '../game/diamondUpgrades'
import { useI18n } from '../i18n'

interface Props {
  state: GameState
  onBuy: (id: DiamondUpgradeId) => void
}

export default function UpgradeScreen({ state, onBuy }: Props) {
  const { t } = useI18n()
  const copy = t.club.diamondUpgrades

  return (
    <div className="screen upgrades-screen">
      <header className="screen-head upgrades-head">
        <div>
          <h2>{copy.title}</h2>
          <p>{copy.hint}</p>
        </div>
        <div className="diamond-balance" aria-label={copy.balance(state.diamonds)}>
          <span>💎</span>
          <strong>{state.diamonds}</strong>
        </div>
      </header>

      <div className="diamond-rules">
        {copy.rules.map(rule => <span key={rule}>{rule}</span>)}
      </div>

      <div className="upgrade-list">
        {DIAMOND_UPGRADE_SPECS.map(spec => {
          const level = state.diamondUpgrades[spec.id]
          const cost = diamondUpgradeCost(state, spec.id)
          const maxed = cost === null
          const affordable = cost !== null && state.diamonds >= cost
          const item = copy.items[spec.id]

          return (
            <article className={`upgrade-card${maxed ? ' maxed' : ''}`} key={spec.id}>
              <div className="upgrade-card-head">
                <div>
                  <h3>{item.name}</h3>
                  <span>{copy.level(level, spec.costs.length)}</span>
                </div>
                <span className="upgrade-effect">
                  {level === 0 ? copy.noBonus : `${item.effect} × ${level}`}
                </span>
              </div>

              <div className="upgrade-pips" aria-label={copy.levelAria(level, spec.costs.length)}>
                {spec.costs.map((_, index) => (
                  <span className={index < level ? 'filled' : ''} key={index} />
                ))}
              </div>

              <p>{item.description}</p>
              <button
                className="btn primary block"
                disabled={maxed || !affordable || state.gameOver}
                onClick={() => onBuy(spec.id)}
              >
                {maxed ? copy.maxed : copy.buy(cost)}
              </button>
              {!maxed && !affordable && (
                <small>{copy.short(cost - state.diamonds)}</small>
              )}
            </article>
          )
        })}
      </div>
    </div>
  )
}
