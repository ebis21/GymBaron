import type { GameState } from '../game/types'
import { formatClock } from '../game/clock'
import { STAFF_UNLOCK_LEVEL } from '../game/constants'
import { money } from './format'

/** Everything reachable from the phone. `staff` is a placeholder for now. */
export type PhoneApp = 'gym' | 'build' | 'shop' | 'stats' | 'staff'

interface Props {
  state: GameState
  open: boolean
  active: PhoneApp
  onToggle: () => void
  onOpen: (app: PhoneApp) => void
}

interface Tile {
  id: PhoneApp
  label: string
  glyph: string
  tint: string
  /** Listed, but not built yet. Shows a badge and cannot be opened. */
  soon?: boolean
  /** Grayed out and unopenable until the player reaches this level. */
  minLevel?: number
}

const APPS: Tile[] = [
  { id: 'gym', label: 'Sala', glyph: '🏋️', tint: 'coral' },
  { id: 'build', label: 'Buduj', glyph: '🔨', tint: 'gold' },
  { id: 'shop', label: 'Sklep', glyph: '🛒', tint: 'leaf' },
  { id: 'stats', label: 'Statystyki', glyph: '📊', tint: 'sky' },
  { id: 'staff', label: 'Personel', glyph: '👔', tint: 'plum', minLevel: STAFF_UNLOCK_LEVEL },
]

/**
 * The menu, as a phone the player slides out of the right edge. Everything the
 * game can do lives on this one home screen, which keeps the bottom of the
 * display clear for the joystick and leaves room for more apps later without
 * another row of tabs appearing from nowhere.
 */
export default function Phone({ state, open, active, onToggle, onOpen }: Props) {
  return (
    <div className={`phone${open ? ' open' : ''}`}>
      <button
        className="phone-handle"
        onClick={onToggle}
        aria-label={open ? 'Schowaj telefon' : 'Pokaż telefon'}
      >
        {open ? '›' : '📱'}
      </button>

      <div className="phone-shell">
        <div className="phone-speaker" />

        <div className="phone-status">
          <span>{formatClock(state.dayMs)}</span>
          <span>Dzień {state.day}</span>
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
              >
                <span className={`phone-icon ${app.tint}`}>{app.glyph}</span>
                <span className="phone-label">{app.label}</span>
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
