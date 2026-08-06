import type { DecorTypeId, GameState, MachineTypeId } from '../game/types'
import { MACHINE_TYPES } from '../game/content/machines'
import { DECOR_TYPES, WALL_PRICE } from '../game/content/decor'
import { ENTRY_FEE_BASE } from '../game/constants'
import { expansionAt, nextExpansion } from '../game/content/expansion'
import { assetFor } from '../assets/assetFor'
import { money } from './format'

interface Props {
  state: GameState
  onBuyMachine: (type: MachineTypeId) => void
  onBuyDecor: (type: DecorTypeId) => void
  onBuyWall: () => void
  /** Buys the next rung of the floor-space ladder; ignored on the top rung. */
  onBuyExpansion: () => void
}

/**
 * Nothing bought here lands on the floor. Purchases go into the bag and the
 * player decides where they stand in build mode — so the shop never has to
 * care whether there is room.
 */
export default function ShopScreen({
  state,
  onBuyMachine,
  onBuyDecor,
  onBuyWall,
  onBuyExpansion,
}: Props) {
  const shortfall = (price: number) =>
    state.cash < price ? `Brakuje ${money(price - state.cash)}` : null

  const wallReason = shortfall(WALL_PRICE)

  const room = expansionAt(state.expansion)
  const nextRoom = nextExpansion(state.expansion)
  const roomReason = !nextRoom
    ? null
    : state.level < nextRoom.minLevel
      ? `Wymaga poziomu ${nextRoom.minLevel}`
      : shortfall(nextRoom.price)

  return (
    <div className="screen">
      <h2 className="section-title">Sprzęt</h2>
      <p className="hint">
        Mnożnik podbija wejściówkę na danej maszynie, a jego nadwyżka ponad 1,0
        dokłada się do klasy siłowni, czyli do ceny każdego karnetu. Kupione
        rzeczy trafiają do ekwipunku.
      </p>

      <div className="shop-list">
        {MACHINE_TYPES.map(m => {
          const reason =
            state.level < m.minLevel ? `Wymaga poziomu ${m.minLevel}` : shortfall(m.price)
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
                <div className="shop-mult">
                  ×{m.revenueMultiplier.toFixed(2)} · wejściówka{' '}
                  {money(ENTRY_FEE_BASE * m.revenueMultiplier)} · klasa +
                  {(m.revenueMultiplier - 1).toFixed(2)}
                </div>
                {reason && <div className="shop-reason">{reason}</div>}
              </div>
              <button className="btn" disabled={reason !== null} onClick={() => onBuyMachine(m.id)}>
                {money(m.price)}
              </button>
            </div>
          )
        })}
      </div>

      <h2 className="section-title" style={{ marginTop: 20 }}>
        Meble
      </h2>
      <p className="hint">Nic nie zarabiają i zajmują pole w sali — kupujesz je dla wyglądu.</p>

      <div className="shop-list">
        {DECOR_TYPES.map(d => {
          const reason = shortfall(d.price)
          return (
            <div className={`shop-row${reason ? ' locked' : ''}`} key={d.id}>
              <div className="inv-glyph">{d.name.charAt(0)}</div>
              <div className="shop-info">
                <div className="shop-name">{d.name}</div>
                {reason && <div className="shop-reason">{reason}</div>}
              </div>
              <button className="btn" disabled={reason !== null} onClick={() => onBuyDecor(d.id)}>
                {money(d.price)}
              </button>
            </div>
          )
        })}
      </div>

      <h2 className="section-title" style={{ marginTop: 20 }}>
        Ścianki
      </h2>
      <p className="hint">
        Stają na krawędziach kafli, więc nie zabierają miejsca pod sprzęt. W
        trybie budowania weź ściankę z ekwipunku i kliknij krawędź kafla.
        Kliknięcie postawionej ścianki wybiera ją — wtedy możesz ją przestawić
        albo schować z powrotem do ekwipunku.
      </p>

      <div className="shop-list">
        <div className={`shop-row${wallReason ? ' locked' : ''}`}>
          <div className="inv-glyph">Ś</div>
          <div className="shop-info">
            <div className="shop-name">Ścianka działowa</div>
            <div className="shop-meta">Jeden odcinek na jedną krawędź</div>
            {wallReason && <div className="shop-reason">{wallReason}</div>}
          </div>
          <button className="btn" disabled={wallReason !== null} onClick={onBuyWall}>
            {money(WALL_PRICE)}
          </button>
        </div>
      </div>

      <h2 className="section-title" style={{ marginTop: 20 }}>
        Rozbudowa
      </h2>
      <p className="hint">
        Więcej pól pod sprzęt. Wszystko, co już stoi, zostaje na swoim polu —
        sala rozrasta się dookoła. Teraz masz {room.w} × {room.h} pól.
      </p>

      <div className="shop-list">
        {nextRoom ? (
          <div className={`shop-row${roomReason ? ' locked' : ''}`}>
            <div className="inv-glyph">+</div>
            <div className="shop-info">
              <div className="shop-name">{nextRoom.name}</div>
              <div className="shop-meta">
                {nextRoom.w} × {nextRoom.h} pól · o {nextRoom.w * nextRoom.h - room.w * room.h} pól
                więcej
              </div>
              {roomReason && <div className="shop-reason">{roomReason}</div>}
            </div>
            <button className="btn" disabled={roomReason !== null} onClick={onBuyExpansion}>
              {money(nextRoom.price)}
            </button>
          </div>
        ) : (
          <div className="shop-row">
            <div className="inv-glyph">✓</div>
            <div className="shop-info">
              <div className="shop-name">{room.name}</div>
              <div className="shop-meta">Największa sala — nie ma czego dokupić</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
