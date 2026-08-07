import { FLOOR_UNLOCK_COST } from '../game/constants'
import { canSwitchFloor, floorName } from '../game/floors'
import type { GameState } from '../game/types'
import { money } from './format'

interface Props {
  state: GameState
  onBuy: () => void
  onSwitch: (floor: number) => void
  onClose: () => void
}

export default function FloorAccessModal({ state, onBuy, onSwitch, onClose }: Props) {
  const unlocked = state.floorPlans.length > 1

  return (
    <div className="modal-backdrop" role="presentation" onPointerDown={onClose}>
      <section
        className="modal floor-access-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="floor-access-title"
        onPointerDown={event => event.stopPropagation()}
      >
        <button className="modal-x" onClick={onClose} aria-label="Zamknij">
          ✕
        </button>

        {!unlocked ? (
          <>
            <div className="floor-lock-glyph" aria-hidden="true">🔒</div>
            <h2 id="floor-access-title">Odblokuj 1. piętro</h2>
            <p className="floor-access-copy">
              Parter jest już maksymalnie rozbudowany. Wykup kłódkę, aby otworzyć
              pustą kondygnację i powiększać siłownię dalej.
            </p>
            <div className="floor-requirement done">
              <span>✓</span>
              Wszystkie rozbudowy parteru
            </div>
            <button
              className="btn primary floor-buy"
              disabled={state.cash < FLOOR_UNLOCK_COST || state.gameOver}
              onClick={onBuy}
            >
              Wykup kłódkę · {money(FLOOR_UNLOCK_COST)}
            </button>
            {state.cash < FLOOR_UNLOCK_COST && (
              <p className="floor-warning">
                Brakuje {money(FLOOR_UNLOCK_COST - state.cash)}.
              </p>
            )}
          </>
        ) : (
          <>
            <div className="floor-lock-glyph open" aria-hidden="true">🔓</div>
            <h2 id="floor-access-title">Wybierz piętro</h2>
            <p className="floor-access-copy">
              Każda kondygnacja zachowuje własny układ, sprzęt i rozbudowę.
            </p>
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
                    <span className="floor-number">{floor === 0 ? 'P' : floor}</span>
                    <span>
                      <strong>{floorName(floor)}</strong>
                      <small>{current ? 'Jesteś tutaj' : 'Przejdź na piętro'}</small>
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
