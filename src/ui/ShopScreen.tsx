import type { GameState, MachineTypeId } from '../game/types'
import { MACHINE_TYPES } from '../game/content/machines'
import { assetFor } from '../assets/assetFor'
import { money } from './format'

interface Props {
  state: GameState
  onSelect: (type: MachineTypeId) => void
}

export default function ShopScreen({ state, onSelect }: Props) {
  const full = state.machines.length >= 48

  return (
    <div className="screen">
      <h2 className="section-title">Sklep ze sprzętem</h2>
      <p className="hint">
        Kup maszynę, potem wskaż dla niej wolne pole w sali. Każda maszyna
        kosztuje prąd co dzień i zużywa się przy każdym treningu.
      </p>

      <div className="shop-list">
        {MACHINE_TYPES.map(m => {
          const tooLowLevel = state.level < m.minLevel
          const tooExpensive = state.cash < m.price
          const reason = tooLowLevel
            ? `Wymaga poziomu ${m.minLevel}`
            : tooExpensive
              ? `Brakuje ${money(m.price - state.cash)}`
              : full
                ? 'Brak wolnego miejsca w sali'
                : null
          const Icon = assetFor(m.id)

          return (
            <div className={`shop-row${reason ? ' locked' : ''}`} key={m.id}>
              <Icon />
              <div className="shop-info">
                <div className="shop-name">{m.name}</div>
                <div className="shop-meta">
                  Prąd {money(m.powerPerDay)}/dzień · Trening {Math.round(m.workoutMs / 1000)} s ·
                  Naprawa {money(m.repairCost)}
                </div>
                {reason && <div className="shop-reason">{reason}</div>}
              </div>
              <button className="btn" disabled={reason !== null} onClick={() => onSelect(m.id)}>
                {money(m.price)}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
