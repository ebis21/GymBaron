import { FLOOR_UNLOCK_COST } from '../game/constants'
import { canSwitchFloor, floorName } from '../game/floors'
import type { GameState } from '../game/types'
import { useI18n } from '../i18n'
import { useDialogFocus } from './useDialogFocus'

interface Props {
  state: GameState
  onBuy: () => void
  onSwitch: (floor: number) => void
  onClose: () => void
}

export default function FloorAccessModal({ state, onBuy, onSwitch, onClose }: Props) {
  const { t, money } = useI18n()
  const unlocked = state.floorPlans.length > 1
  const dialogRef = useDialogFocus<HTMLElement>(onClose)

  return (
    <div className="modal-backdrop" role="presentation" onPointerDown={onClose}>
      <section
        ref={dialogRef}
        tabIndex={-1}
        className="modal floor-access-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="floor-access-title"
        onPointerDown={event => event.stopPropagation()}
      >
        <button className="modal-x" onClick={onClose} aria-label={t.client.close}>
          ✕
        </button>

        {!unlocked ? (
          <>
            <div className="floor-lock-glyph" aria-hidden="true">🔒</div>
            <h2 id="floor-access-title">{t.floors.unlockTitle}</h2>
            <p className="floor-access-copy">{t.floors.unlockCopy}</p>
            <div className="floor-requirement done">
              <span>✓</span>
              {t.floors.requirement}
            </div>
            <button
              className="btn primary floor-buy"
              disabled={state.cash < FLOOR_UNLOCK_COST || state.gameOver}
              onClick={onBuy}
            >
              {t.floors.buy(money(FLOOR_UNLOCK_COST))}
            </button>
            {state.cash < FLOOR_UNLOCK_COST && (
              <p className="floor-warning">
                {t.floors.short(money(FLOOR_UNLOCK_COST - state.cash))}
              </p>
            )}
          </>
        ) : (
          <>
            <div className="floor-lock-glyph open" aria-hidden="true">🔓</div>
            <h2 id="floor-access-title">{t.floors.pickTitle}</h2>
            <p className="floor-access-copy">{t.floors.pickCopy}</p>
            <div className="floor-list">
              {state.floorPlans.map((_, floor) => {
                const current = floor === state.activeFloor
                const enabled = canSwitchFloor(state, floor)
                return (
                  <button
                    key={floor}
                    className={`floor-option${current ? ' current' : ''}`}
                    disabled={current || !enabled}
                    onClick={() => {
                      onSwitch(floor)
                      onClose()
                    }}
                  >
                    <span className="floor-number">
                      {floor === 0 ? t.floors.groundShort : floor}
                    </span>
                    <span>
                      <strong>{floorName(floor)}</strong>
                      <small>{current ? t.floors.here : t.floors.goTo}</small>
                    </span>
                    <span className="floor-arrow">{current ? '✓' : '→'}</span>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
