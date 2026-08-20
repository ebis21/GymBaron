import type { DiamondUpgradeId, GameState } from '../game/types'
import { DIAMOND_UPGRADE_SPECS, diamondUpgradeCost } from '../game/diamondUpgrades'

interface Props {
  state: GameState
  onBuy: (id: DiamondUpgradeId) => void
}

export default function UpgradeScreen({ state, onBuy }: Props) {
  return (
    <div className="screen upgrades-screen">
      <header className="screen-head upgrades-head">
        <div>
          <h2>Ulepszenia</h2>
          <p>Diamenty zdobywasz za poziomy i świetnie zakończone dni.</p>
        </div>
        <div className="diamond-balance" aria-label={`${state.diamonds} diamentów`}>
          <span>💎</span>
          <strong>{state.diamonds}</strong>
        </div>
      </header>

      <div className="diamond-rules">
        <span>Poziom: +1 💎</span>
        <span>75% satysfakcji i 10 klientów: +1 💎</span>
        <span>90% satysfakcji i 20 klientów: +2 💎</span>
      </div>

      <div className="upgrade-list">
        {DIAMOND_UPGRADE_SPECS.map(spec => {
          const level = state.diamondUpgrades[spec.id]
          const cost = diamondUpgradeCost(state, spec.id)
          const maxed = cost === null
          const affordable = cost !== null && state.diamonds >= cost

          return (
            <article className={`upgrade-card${maxed ? ' maxed' : ''}`} key={spec.id}>
              <div className="upgrade-card-head">
                <div>
                  <h3>{spec.name}</h3>
                  <span>Poziom {level}/{spec.costs.length}</span>
                </div>
                <span className="upgrade-effect">
                  {level === 0 ? 'Brak bonusu' : `${spec.effectPerLevel} × ${level}`}
                </span>
              </div>

              <div className="upgrade-pips" aria-label={`Poziom ${level} z ${spec.costs.length}`}>
                {spec.costs.map((_, index) => (
                  <span className={index < level ? 'filled' : ''} key={index} />
                ))}
              </div>

              <p>{spec.description}</p>
              <button
                className="btn primary block"
                disabled={maxed || !affordable || state.gameOver}
                onClick={() => onBuy(spec.id)}
              >
                {maxed ? 'Maksymalny poziom' : `Ulepsz za ${cost} 💎`}
              </button>
              {!maxed && !affordable && (
                <small>Brakuje {cost - state.diamonds} 💎</small>
              )}
            </article>
          )
        })}
      </div>
    </div>
  )
}
