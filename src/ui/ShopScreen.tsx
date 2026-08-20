import type { ReactNode } from 'react'
import type { DecorTypeId, GameState, MachineTypeId } from '../game/types'
import { machineType } from '../game/content/machines'
import { availableMachines } from '../game/contracts'
import { DECOR_TYPES, decorType, WALL_PRICE } from '../game/content/decor'
import { freeDesks, staffedDesks } from '../game/staff'
import { ENTRY_FEE_BASE } from '../game/constants'
import { expansionAt, nextExpansion } from '../game/content/expansion'
import { assetFor } from '../assets/assetFor'
import { useI18n } from '../i18n'
import ManagementIcon, { type ManagementIconName } from './ManagementIcon'
import { repairPrice } from '../game/diamondUpgrades'

interface Props {
  state: GameState
  onBuyMachine: (type: MachineTypeId) => void
  onBuyDecor: (type: DecorTypeId) => void
  onBuyWall: () => void
  /** Buys the next rung of the floor-space ladder; ignored on the top rung. */
  onBuyExpansion: () => void
}

interface ShopSectionProps {
  icon: ManagementIconName
  title: string
  hint: string
  children: ReactNode
}

function ShopSection({ icon, title, hint, children }: ShopSectionProps) {
  return (
    <section className="management-section">
      <header className="management-section-head">
        <div className="management-section-icon">
          <ManagementIcon name={icon} />
        </div>
        <div>
          <h2>{title}</h2>
          <p>{hint}</p>
        </div>
      </header>
      {children}
    </section>
  )
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

  const desk = decorType('reception')
  const deskReason = shortfall(desk.price)
  const desks = staffedDesks(state).length
  const crew = state.staff.filter(s => s.role === 'reception').length
  const idle = freeDesks(state)

  return (
    <div className="screen management-screen management-shop">
      <header className="management-hero">
        <div className="management-hero-mark">
          <ManagementIcon name="equipment" />
        </div>
        <div className="management-hero-copy">
          <h2>{t.phone.apps.shop}</h2>
        </div>
        <div className="management-wallet">
          <span>{t.topbar.cash}</span>
          <strong>{money(state.cash)}</strong>
        </div>
      </header>

      <ShopSection icon="equipment" title={t.shop.equipment} hint={t.shop.equipmentHint}>
        <div className="management-grid product-grid">
          {/* Only what the gym may actually buy today. Kit behind an unsigned
              contract is absent rather than greyed out; that ladder belongs
              on the contracts screen. */}
          {availableMachines(state).map(machineType).map(machine => {
            const reason = state.level < machine.minLevel
              ? t.shop.needsLevel(machine.minLevel)
              : shortfall(machine.price)
            const Icon = assetFor(machine.id)

            return (
              <article
                className={`management-card product-card${reason ? ' is-locked' : ''}`}
                key={machine.id}
              >
                <div className="management-card-head">
                  <div className="management-card-icon machine-art"><Icon /></div>
                  <div className="management-card-title">
                    <span className="management-eyebrow">
                      {t.shop.machineMeta(
                        money(machine.powerPerDay),
                        Math.round(machine.workoutMs / 1000),
                        money(repairPrice(state, machine.repairCost)),
                      )}
                    </span>
                    <h3>{t.content.machines[machine.id]}</h3>
                  </div>
                </div>

                <div className="product-value">
                  {t.shop.machineMult(
                    machine.revenueMultiplier.toFixed(2),
                    money(ENTRY_FEE_BASE * machine.revenueMultiplier),
                    (machine.revenueMultiplier - 1).toFixed(2),
                  )}
                </div>

                {reason && <div className="management-notice danger">{reason}</div>}

                <button
                  className="btn management-cta"
                  disabled={reason !== null}
                  onClick={() => onBuyMachine(machine.id)}
                >
                  {t.shop.buy(money(machine.price))}
                </button>
              </article>
            )
          })}
        </div>
      </ShopSection>

      <ShopSection icon="reception" title={t.shop.deskSection} hint={t.shop.deskHint}>
        <div className="management-grid compact-product-grid">
          <article className={`management-card utility-card${deskReason ? ' is-locked' : ''}`}>
            <div className="management-card-head">
              <div className="management-card-icon"><ManagementIcon name="reception" /></div>
              <div className="management-card-title">
                <span className="management-eyebrow">{t.shop.deskCount(desks, crew)}</span>
                <h3>{t.content.decor.reception}</h3>
              </div>
            </div>
            <p className="management-card-copy">
              {idle > 0 ? t.shop.deskIdle(idle) : t.shop.deskShortStaff}
            </p>
            {deskReason && <div className="management-notice danger">{deskReason}</div>}
            <button
              className="btn management-cta"
              disabled={deskReason !== null}
              onClick={() => onBuyDecor('reception')}
            >
              {t.shop.buy(money(desk.price))}
            </button>
          </article>
        </div>
      </ShopSection>

      <ShopSection icon="furniture" title={t.shop.furniture} hint={t.shop.furnitureHint}>
        <div className="management-grid compact-product-grid">
          {DECOR_TYPES.filter(item => item.id !== 'reception').map(item => {
            const reason = shortfall(item.price)
            const name = t.content.decor[item.id]
            return (
              <article
                className={`management-card utility-card${reason ? ' is-locked' : ''}`}
                key={item.id}
              >
                <div className="management-card-head">
                  <div className="management-card-icon"><ManagementIcon name="furniture" /></div>
                  <div className="management-card-title"><h3>{name}</h3></div>
                </div>
                {reason && <div className="management-notice danger">{reason}</div>}
                <button
                  className="btn management-cta"
                  disabled={reason !== null}
                  onClick={() => onBuyDecor(item.id)}
                >
                  {t.shop.buy(money(item.price))}
                </button>
              </article>
            )
          })}
        </div>
      </ShopSection>

      <ShopSection icon="partition" title={t.shop.partitions} hint={t.shop.partitionsHint}>
        <div className="management-grid compact-product-grid">
          <article className={`management-card utility-card${wallReason ? ' is-locked' : ''}`}>
            <div className="management-card-head">
              <div className="management-card-icon"><ManagementIcon name="partition" /></div>
              <div className="management-card-title">
                <span className="management-eyebrow">{t.shop.partitionMeta}</span>
                <h3>{t.shop.partitionName}</h3>
              </div>
            </div>
            {wallReason && <div className="management-notice danger">{wallReason}</div>}
            <button
              className="btn management-cta"
              disabled={wallReason !== null}
              onClick={onBuyWall}
            >
              {t.shop.buy(money(WALL_PRICE))}
            </button>
          </article>
        </div>
      </ShopSection>

      <ShopSection
        icon="expansion"
        title={t.shop.expansion}
        hint={t.shop.expansionHint(room.w, room.h)}
      >
        <div className="management-grid compact-product-grid">
          {nextRoom ? (
            <article className={`management-card utility-card${roomReason ? ' is-locked' : ''}`}>
              <div className="management-card-head">
                <div className="management-card-icon"><ManagementIcon name="expansion" /></div>
                <div className="management-card-title">
                  <span className="management-eyebrow">
                    {t.shop.expansionMeta(
                      nextRoom.w,
                      nextRoom.h,
                      nextRoom.w * nextRoom.h - room.w * room.h,
                    )}
                  </span>
                  <h3>{t.content.expansions[nextRoom.id]}</h3>
                </div>
              </div>
              {roomReason && <div className="management-notice danger">{roomReason}</div>}
              <button
                className="btn management-cta"
                disabled={roomReason !== null}
                onClick={onBuyExpansion}
              >
                {t.shop.buy(money(nextRoom.price))}
              </button>
            </article>
          ) : (
            <article className="management-card utility-card is-complete">
              <div className="management-card-head">
                <div className="management-card-icon"><ManagementIcon name="expansion" /></div>
                <div className="management-card-title">
                  <h3>{t.content.expansions[room.id]}</h3>
                  <p className="management-card-copy">{t.shop.biggest}</p>
                </div>
                <span className="management-state complete">✓</span>
              </div>
            </article>
          )}
        </div>
      </ShopSection>
    </div>
  )
}
