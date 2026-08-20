import type { GameState } from '../game/types'
import { dayProgress, formatClock, isClosingTime } from '../game/clock'
import { gymClass } from '../game/economy'
import { BILLING_PERIOD_DAYS } from '../game/constants'
import { money } from './format'
import { floorName } from '../game/floors'

const cashClass = (cash: number) =>
  cash < -10_000 ? 'cash-bad' : cash < 0 ? 'cash-warn' : 'cash-ok'

/**
 * Days until the next pass renews for anyone. Members run on staggered
 * cycles, so this reports the soonest one rather than a gym-wide date.
 */
function daysToNextRenewal(state: GameState): number | null {
  if (state.members.length === 0) return null

  return state.members.reduce<number>((soonest, m) => {
    const age = state.day - m.joinedDay
    return Math.min(soonest, BILLING_PERIOD_DAYS - (age % BILLING_PERIOD_DAYS))
  }, BILLING_PERIOD_DAYS)
}

export default function TopBar({ state }: { state: GameState }) {
  const renewal = daysToNextRenewal(state)
  const closing = isClosingTime(state.dayMs) && !state.dayEnded

  return (
    <div className="topbar-wrap">
      <div className="topbar">
        <div className={`topbar-cell clock-cell${closing ? ' closing' : ''}`}>
          <span className="topbar-label">{closing ? 'Po godzinach' : `Dzień ${state.day}`}</span>
          <span className="topbar-value clock">
            {formatClock(state.dayMs)}
            {state.floorPlans.length > 1 && (
              <span className="topbar-sub">{floorName(state.activeFloor)}</span>
            )}
          </span>
        </div>
        <div className="topbar-cell">
          <span className="topbar-label">Kasa</span>
          <span className={`topbar-value ${cashClass(state.cash)}`}>{money(state.cash)}</span>
        </div>
        <div className="topbar-cell diamond-cell">
          <span className="topbar-label">Diamenty</span>
          <span className="topbar-value">💎 {state.diamonds}</span>
        </div>
        <div className="topbar-cell">
          <span className="topbar-label">Członkowie</span>
          <span className="topbar-value">
            {state.members.length}
            {renewal !== null && <span className="topbar-sub">karnet za {renewal} dni</span>}
          </span>
        </div>
        <div className="topbar-cell">
          <span className="topbar-label">Klasa</span>
          <span className="topbar-value">
            ×{gymClass(state).toFixed(2)}
            {state.allianceIncomeMultiplier === 1.5 && (
              <span className="topbar-sub">Sojusz ×1,5</span>
            )}
          </span>
        </div>
        <div className="topbar-cell">
          <span className="topbar-label">Renoma</span>
          <span className="topbar-value">{Math.round(state.reputation)}</span>
        </div>
      </div>

      <div className="day-bar" title="8:00 → 20:00">
        <div className="day-bar-fill" style={{ width: `${dayProgress(state.dayMs) * 100}%` }} />
      </div>

      {state.cash < 0 && (
        <div className="debt-banner">
          Jesteś na minusie. Poniżej −20 000 wchodzi komornik.
        </div>
      )}
    </div>
  )
}
