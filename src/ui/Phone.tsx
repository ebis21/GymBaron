import type { GameState } from '../game/types'
import { formatClock } from '../game/clock'
import { HIRING_UNLOCK_LEVEL } from '../game/constants'
import { useI18n } from '../i18n'

/** Everything reachable from the phone. */
export type PhoneApp =
  | 'gym' | 'build' | 'shop' | 'stats' | 'staff' | 'upgrades'
  | 'marketing' | 'contracts' | 'sponsors'

interface Props {
  state: GameState
  open: boolean
  active: PhoneApp
  onToggle: () => void
  onOpen: (app: PhoneApp) => void
}

interface Tile {
  id: PhoneApp
  glyph: string
  tint: string
  /** Listed, but not built yet. Shows a badge and cannot be opened. */
  soon?: boolean
  /** Grayed out and unopenable until the player reaches this level. */
  minLevel?: number
}

const APPS: Tile[] = [
  { id: 'gym', glyph: '🏋️', tint: 'coral' },
  { id: 'build', glyph: '🔨', tint: 'gold' },
  { id: 'shop', glyph: '🛒', tint: 'leaf' },
  // No `minLevel`: the price of the first rung is the only gate, which is the
  // whole design of the track — see `buyUpgrade`.
  { id: 'upgrades', glyph: '⬆️', tint: 'sky' },
  { id: 'stats', glyph: '📊', tint: 'sky' },
  // Trainers unlock long before the automation roles, and they are hired from
  // this same screen — so the app opens at the earliest level that can hire
  // anybody at all, and the panel itself explains what is still locked.
  { id: 'staff', glyph: '👔', tint: 'plum', minLevel: HIRING_UNLOCK_LEVEL },
  // The three v2 apps. Each ships listed but marked `soon`, so the home screen
  // already has its final shape and the branch that finishes a feature clears
  // exactly one flag on one line — three edits that can never collide.
  { id: 'marketing', glyph: '📣', tint: 'coral', soon: true },
  { id: 'contracts', glyph: '📝', tint: 'gold', soon: true },
  { id: 'sponsors', glyph: '🤝', tint: 'leaf', soon: true },
]

/**
 * The menu, as a phone the player slides out of the right edge. Everything the
 * game can do lives on this one home screen, which keeps the bottom of the
 * display clear for the joystick and leaves room for more apps later without
 * another row of tabs appearing from nowhere.
 */
export default function Phone({ state, open, active, onToggle, onOpen }: Props) {
  const { t, money } = useI18n()

  return (
    <div className={`phone${open ? ' open' : ''}`}>
      <button
        className="phone-handle"
        onClick={onToggle}
        aria-label={open ? t.phone.hide : t.phone.show}
      >
        {open ? '›' : '📱'}
      </button>

      <div className="phone-shell">
        <div className="phone-speaker" />

        <div className="phone-status">
          <span>{formatClock(state.dayMs)}</span>
          <span>{t.phone.day(state.day)}</span>
          <span>{money(state.cash)}</span>
        </div>

        <div className="phone-apps">
          {APPS.map(app => {
            const locked = app.minLevel !== undefined && state.level < app.minLevel
            return (
              <button
                key={app.id}
                className={`phone-app${active === app.id ? ' active' : ''}${app.soon ? ' soon' : ''}${locked ? ' locked' : ''}`}
                disabled={app.soon || locked}
                onClick={() => onOpen(app.id)}
                aria-label={t.phone.apps[app.id]}
              >
                <span className={`phone-icon ${app.tint}`}>{app.glyph}</span>
                <span className="phone-label">{t.phone.apps[app.id]}</span>
                {app.soon && <span className="phone-soon">SOON</span>}
                {locked && <span className="phone-lock">🔒 Lv {app.minLevel}</span>}
              </button>
            )
          })}
        </div>

        <div className="phone-home" />
      </div>
    </div>
  )
}
