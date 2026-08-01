import type { GameState } from '../game/types'
import { money } from './format'

interface Props {
  state: GameState
  onRestart: () => void
}

export default function GameOverScreen({ state, onRestart }: Props) {
  return (
    <div className="overlay">
      <div className="modal">
        <h2>Komornik wbił</h2>
        <p>
          Dług przekroczył −20 000. Sprzęt pojechał na licytację, a sala stoi pusta.
        </p>

        <div className="stat-grid">
          <div className="stat-card">
            <div className="k">Przetrwałeś</div>
            <div className="v">{state.stats.daysPassed} dni</div>
          </div>
          <div className="stat-card">
            <div className="k">Saldo</div>
            <div className="v">{money(state.cash)}</div>
          </div>
          <div className="stat-card">
            <div className="k">Obsłużeni</div>
            <div className="v">{state.stats.clientsServed}</div>
          </div>
          <div className="stat-card">
            <div className="k">Zarobiono</div>
            <div className="v">{money(state.stats.totalEarned)}</div>
          </div>
        </div>

        <button className="btn block" onClick={onRestart}>
          Zacznij od nowa
        </button>
      </div>
    </div>
  )
}
