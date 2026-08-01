import type { GameState } from '../game/types'
import { XP_PER_LEVEL } from '../game/constants'
import { money } from './format'

const cashClass = (cash: number) =>
  cash < -10_000 ? 'cash-bad' : cash < 0 ? 'cash-warn' : 'cash-ok'

export default function TopBar({ state }: { state: GameState }) {
  return (
    <>
      <div className="topbar">
        <div className="topbar-cell">
          <span className="topbar-label">Kasa</span>
          <span className={`topbar-value ${cashClass(state.cash)}`}>{money(state.cash)}</span>
        </div>
        <div className="topbar-cell">
          <span className="topbar-label">Renoma</span>
          <span className="topbar-value">{Math.round(state.reputation)}</span>
        </div>
        <div className="topbar-cell">
          <span className="topbar-label">Poziom</span>
          <span className="topbar-value">
            {state.level}
            <span style={{ fontSize: 11, color: 'var(--muted)' }}> ·{Math.floor((state.xp / XP_PER_LEVEL) * 100)}%</span>
          </span>
        </div>
        <div className="topbar-cell">
          <span className="topbar-label">Dzień</span>
          <span className="topbar-value">{state.stats.daysPassed + 1}</span>
        </div>
      </div>

      {state.cash < 0 && (
        <div className="debt-banner">
          Jesteś na minusie. Poniżej −20 000 wchodzi komornik.
        </div>
      )}
    </>
  )
}
