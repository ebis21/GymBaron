import { useLayoutEffect, useRef } from 'react'
import type { GameState } from '../game/types'
import { dayProgress, formatClock, isClosingTime } from '../game/clock'
import { gymClass, passPrice } from '../game/economy'
import { daysToPayday, isPayday } from '../game/members'
import { useI18n } from '../i18n'
import { floorName } from '../game/floors'

const cashClass = (cash: number) =>
  cash < -10_000 ? 'cash-bad' : cash < 0 ? 'cash-warn' : 'cash-ok'

interface Props {
  state: GameState
  onOpenSettings: () => void
}

export default function TopBar({ state, onOpenSettings }: Props) {
  const { t, money } = useI18n()
  // The whole gym bills on one week, so this is a date rather than an estimate:
  // every pass in the building is collected when the counter reaches zero.
  const untilPayday = daysToPayday(state.day)
  const paydayToday = isPayday(state.day)
  // Anyone who joined today already paid at the desk — see `chargeRenewals` —
  // so a gym whose whole membership signed up this morning collects nothing
  // tonight even though it is payday. Worth still saying it is payday: the
  // number is what is missing, not the date.
  const duePasses = state.members.filter(m => m.joinedDay < state.day).length
  const closing = isClosingTime(state.dayMs) && !state.dayEnded
  const wrapRef = useRef<HTMLDivElement>(null)

  /*
   * This bar is not a fixed height: going into the red adds a debt banner, and
   * a second floor adds a line under the clock. Everything pinned below it —
   * the phone rail, the panels — used to hardcode 86px and was simply wrong
   * whenever the gym was in debt, so the measured height is published instead
   * and `--below-topbar` in the stylesheet does the arithmetic.
   */
  useLayoutEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return

    const publish = () =>
      document.documentElement.style.setProperty('--topbar-h', `${wrap.offsetHeight}px`)

    publish()
    const observer = new ResizeObserver(publish)
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="topbar-wrap" ref={wrapRef}>
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
        <div className="topbar-cell diamond-cell">
          <span className="topbar-label">Diamenty</span>
          <span className="topbar-value">💎 {state.diamonds}</span>
        </div>
        <div className={`topbar-cell${paydayToday && duePasses > 0 ? ' payday' : ''}`}>
          <span className="topbar-label">{t.topbar.members}</span>
          <span className="topbar-value">
            {state.members.length}
            {state.members.length > 0 && (
              paydayToday ? (
                <span className="topbar-sub payday-sub">
                  {duePasses > 0
                    ? t.topbar.paydayToday(money(duePasses * passPrice(state)))
                    : t.topbar.paydayTodayEmpty}
                </span>
              ) : (
                <span className="topbar-sub">{t.topbar.payday(untilPayday)}</span>
              )
            )}
          </span>
        </div>
        <div className="topbar-cell">
          <span className="topbar-label">{t.topbar.gymClass}</span>
          <span className="topbar-value">
            ×{gymClass(state).toFixed(2)}
            {state.allianceIncomeMultiplier === 1.5 && (
              <span className="topbar-sub">Sojusz ×1,5</span>
            )}
          </span>
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
