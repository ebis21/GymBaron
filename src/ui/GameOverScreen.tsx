import type { GameState } from '../game/types'
import { useI18n } from '../i18n'

interface Props {
  state: GameState
  onRestart: () => void
}

export default function GameOverScreen({ state, onRestart }: Props) {
  const { t, money } = useI18n()

  return (
    <div className="overlay">
      <div className="modal">
        <h2>{t.gameOver.title}</h2>
        <p>{t.gameOver.copy}</p>

        <div className="stat-grid">
          <div className="stat-card">
            <div className="k">{t.gameOver.survived}</div>
            <div className="v">{t.gameOver.days(state.day)}</div>
          </div>
          <div className="stat-card">
            <div className="k">{t.gameOver.balance}</div>
            <div className="v">{money(state.cash)}</div>
          </div>
          <div className="stat-card">
            <div className="k">{t.gameOver.served}</div>
            <div className="v">{state.stats.clientsServed}</div>
          </div>
          <div className="stat-card">
            <div className="k">{t.gameOver.earned}</div>
            <div className="v">{money(state.stats.totalEarned)}</div>
          </div>
        </div>

        <button className="btn block" onClick={onRestart}>
          {t.gameOver.restart}
        </button>
      </div>
    </div>
  )
}
