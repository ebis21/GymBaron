import type { DecorTypeId, GameState, MachineTypeId } from '../game/types'
import { machineType } from '../game/content/machines'
import { availableMachines } from '../game/contracts'
import { DECOR_TYPES, WALL_PRICE } from '../game/content/decor'
import { ENTRY_FEE_BASE } from '../game/constants'
import { expansionAt, nextExpansion } from '../game/content/expansion'
import { assetFor } from '../assets/assetFor'
import { useI18n } from '../i18n'

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
  const { t, money } = useI18n()

  const shortfall = (price: number) =>
    state.cash < price ? t.shop.short(money(price - state.cash)) : null

  const wallReason = shortfall(WALL_PRICE)

  const room = expansionAt(state.expansion)
  const nextRoom = nextExpansion(state.expansion)
  const roomReason = !nextRoom
    ? null
    : state.level < nextRoom.minLevel
      ? t.shop.needsLevel(nextRoom.minLevel)
      : shortfall(nextRoom.price)

  return (
    <div className="screen">
      <h2 className="section-title">{t.shop.equipment}</h2>
      <p className="hint">{t.shop.equipmentHint}</p>

      <div className="shop-list">
        {/* Only what the gym may actually buy today. Kit behind an unsigned
            contract is absent rather than greyed out — a locked row the player
            has no way to unlock from here would be an advert, not a shop. The
            contracts screen is where that ladder is sold. */}
        {availableMachines(state).map(machineType).map(m => {
          const reason =
            state.level < m.minLevel ? t.shop.needsLevel(m.minLevel) : shortfall(m.price)
          const Icon = assetFor(m.id)

          return (
            <div className={`shop-row${reason ? ' locked' : ''}`} key={m.id}>
              <Icon />
              <div className="shop-info">
                <div className="shop-name">{t.content.machines[m.id]}</div>
                <div className="shop-meta">
                  {t.shop.machineMeta(
                    money(m.powerPerDay),
                    Math.round(m.workoutMs / 1000),
                    money(m.repairCost),
                  )}
                </div>
                <div className="shop-mult">
                  {t.shop.machineMult(
                    m.revenueMultiplier.toFixed(2),
                    money(ENTRY_FEE_BASE * m.revenueMultiplier),
                    (m.revenueMultiplier - 1).toFixed(2),
                  )}
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
        {t.shop.furniture}
      </h2>
      <p className="hint">{t.shop.furnitureHint}</p>

      <div className="shop-list">
        {DECOR_TYPES.map(d => {
          const reason = shortfall(d.price)
          const name = t.content.decor[d.id]
          return (
            <div className={`shop-row${reason ? ' locked' : ''}`} key={d.id}>
              <div className="inv-glyph">{name.charAt(0)}</div>
              <div className="shop-info">
                <div className="shop-name">{name}</div>
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
        {t.shop.partitions}
      </h2>
      <p className="hint">{t.shop.partitionsHint}</p>

      <div className="shop-list">
        <div className={`shop-row${wallReason ? ' locked' : ''}`}>
          <div className="inv-glyph">{t.shop.partitionName.charAt(0)}</div>
          <div className="shop-info">
            <div className="shop-name">{t.shop.partitionName}</div>
            <div className="shop-meta">{t.shop.partitionMeta}</div>
            {wallReason && <div className="shop-reason">{wallReason}</div>}
          </div>
          <button className="btn" disabled={wallReason !== null} onClick={onBuyWall}>
            {money(WALL_PRICE)}
          </button>
        </div>
      </div>

      <h2 className="section-title" style={{ marginTop: 20 }}>
        {t.shop.expansion}
      </h2>
      <p className="hint">{t.shop.expansionHint(room.w, room.h)}</p>

      <div className="shop-list">
        {nextRoom ? (
          <div className={`shop-row${roomReason ? ' locked' : ''}`}>
            <div className="inv-glyph">+</div>
            <div className="shop-info">
              <div className="shop-name">{t.content.expansions[nextRoom.id]}</div>
              <div className="shop-meta">
                {t.shop.expansionMeta(
                  nextRoom.w,
                  nextRoom.h,
                  nextRoom.w * nextRoom.h - room.w * room.h,
                )}
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
              <div className="shop-name">{t.content.expansions[room.id]}</div>
              <div className="shop-meta">{t.shop.biggest}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
