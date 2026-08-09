import type { GameState } from '../game/types'
import type { ContractAction } from '../game/contracts'
import { blockedBy, signed, suppliers } from '../game/contracts'
import { machineType } from '../game/content/machines'
import { ENTRY_FEE_BASE } from '../game/constants'
import { assetFor } from '../assets/assetFor'
import { useI18n } from '../i18n'

interface Props {
  state: GameState
  /** The feature's one dispatcher, wired straight through from the store. */
  onContract: (action: ContractAction) => void
}

/**
 * Equipment supplier contracts.
 *
 * OWNER: `feat/v2-equipment-contracts`. Nobody else edits this file.
 *
 * Every deal is shown with the kit it unlocks, signed or not. A ladder the
 * player cannot see the top of is not a ladder — it is a surprise, and the
 * whole reason to sign Ferrum is knowing that Apex is up there.
 */
export default function ContractsScreen({ state, onContract }: Props) {
  const { t, money } = useI18n()
  const deals = suppliers()

  return (
    <div className="screen">
      <header className="screen-head">
        <h2>{t.contracts.title}</h2>
      </header>
      <p className="hint">{t.contracts.hint}</p>

      <div className="shop-list">
        {deals.map(deal => {
          const names = t.contracts.supplier[deal.id]
          const held = signed(state, deal.id)
          const blocker = blockedBy(state, deal.id)

          // One reason, the one that actually stands in the way. `blockedBy`
          // returns them in the order the player has to clear them, so the
          // label always names the next thing to do rather than the last.
          const reason =
            blocker === 'level'
              ? t.contracts.needsLevel(deal.minLevel)
              : blocker === 'requires' && deal.requires !== null
                ? t.contracts.needsSupplier(t.contracts.supplier[deal.requires].name)
                : blocker === 'cash'
                  ? t.contracts.short(money(deal.signingFee - state.cash))
                  : null

          return (
            <div className={`shop-row${!held && reason ? ' locked' : ''}`} key={deal.id}>
              <div className="shop-info">
                <div className="shop-name">
                  {names.name}
                  {held && <span className="shop-mult"> · {t.contracts.held}</span>}
                </div>
                <div className="shop-meta">{names.blurb}</div>
                <div className="shop-mult">
                  {t.contracts.unlocks(deal.catalogue.length)} ·{' '}
                  {t.contracts.dailyFee(money(deal.dailyFee))}
                </div>
                {reason && !held && <div className="shop-reason">{reason}</div>}

                <div className="shop-list">
                  {deal.catalogue.map(machine => {
                    const spec = machineType(machine.id)
                    const Icon = assetFor(machine.id)

                    return (
                      <div className="shop-row" key={machine.id}>
                        <Icon />
                        <div className="shop-info">
                          <div className="shop-name">{t.content.machines[machine.id]}</div>
                          <div className="shop-mult">
                            {t.shop.machineMult(
                              spec.revenueMultiplier.toFixed(2),
                              money(ENTRY_FEE_BASE * spec.revenueMultiplier),
                              (spec.revenueMultiplier - 1).toFixed(2),
                            )}
                          </div>
                        </div>
                        <span className="shop-meta">{money(spec.price)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {held ? (
                <button
                  className="btn ghost"
                  onClick={() => onContract({ type: 'cancel', supplier: deal.id })}
                >
                  {t.contracts.cancel}
                </button>
              ) : (
                <button
                  className="btn"
                  disabled={reason !== null}
                  onClick={() => onContract({ type: 'sign', supplier: deal.id })}
                >
                  {t.contracts.sign(money(deal.signingFee))}
                </button>
              )}
            </div>
          )
        })}
      </div>

      <p className="hint">{t.contracts.keepsKit}</p>
    </div>
  )
}
