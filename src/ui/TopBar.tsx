import type { GameState } from '../game/types'
import { dayProgress, formatClock, isClosingTime } from '../game/clock'
import { gymClass } from '../game/economy'
import { BILLING_PERIOD_DAYS } from '../game/constants'
import { useI18n } from '../i18n'
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

interface Props {
  state: GameState
  onOpenSettings: () => void
}

export default function TopBar({ state, onOpenSettings }: Props) {
  const { t, money } = useI18n()
  const renewal = daysToNextRenewal(state)
  const closing = isClosingTime(state.dayMs) && !state.dayEnded

  return (
    <div className="topbar-wrap">
      <div className="topbar">
        <div className={`topbar-cell clock-cell${closing ? ' closing' : ''}`}>
          <span className="topbar-label">
            {closing ? t.topbar.afterHours : t.topbar.day(state.day)}
          </span>
          <span className="topbar-value clock">
            {formatClock(state.dayMs)}
            {state.floorPlans.length > 1 && (
              <span className="topbar-sub">{floorName(state.activeFloor)}</span>
            )}
          </span>
        </div>
        <div className="topbar-cell">
          <span className="topbar-label">{t.topbar.cash}</span>
          <span className={`topbar-value ${cashClass(state.cash)}`}>{money(state.cash)}</span>
        </div>
        <div className="topbar-cell">
          <span className="topbar-label">{t.topbar.members}</span>
          <span className="topbar-value">
            {state.members.length}
            {renewal !== null && <span className="topbar-sub">{t.topbar.renewal(renewal)}</span>}
          </span>
        </div>
        <div className="topbar-cell">
          <span className="topbar-label">{t.topbar.gymClass}</span>
          <span className="topbar-value">×{gymClass(state).toFixed(2)}</span>
        </div>
        <div className="topbar-cell">
          <span className="topbar-label">{t.topbar.reputation}</span>
          <span className="topbar-value">{Math.round(state.reputation)}</span>
        </div>

        {/*
          Its own cell rather than a sixth stat: the five to its left are
          numbers the player reads at a glance, and a button among them would
          be read as one too.
        */}
        <button
          className="topbar-settings"
          onClick={onOpenSettings}
          aria-label={t.topbar.settings}
          title={t.topbar.settings}
        >
          ⚙
        </button>
      </div>

      <div className="day-bar" title={t.topbar.hours}>
        <div className="day-bar-fill" style={{ width: `${dayProgress(state.dayMs) * 100}%` }} />
      </div>

      {state.cash < 0 && <div className="debt-banner">{t.topbar.debt}</div>}
    </div>
  )
}
