import { useState } from 'react'
import type { GameState } from '../game/types'
import type { ContractAction } from '../game/contracts'
import type { SupplierId } from '../game/content/suppliers'
import { blockedBy, signed, suppliers } from '../game/contracts'
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
 *
 * The kit itself is folded away, though. Printed flat, two suppliers put ten
 * machines and their small print on one scrolling screen, and the decision the
 * screen exists for — sign this, or not yet — was somewhere in the middle of
 * it. Collapsed, each supplier is a name, a price and a fee; the catalogue is
 * one tap away, and only ever one of them is open at a time.
 */
export default function ContractsScreen({ state, onContract }: Props) {
  const { t, money } = useI18n()
  const deals = suppliers()

  /** The supplier whose catalogue is unfolded, or null for all folded. */
  const [open, setOpen] = useState<SupplierId | null>(null)

  return (
    <div className="screen">
      <header className="screen-head">
        <h2>{t.contracts.title}</h2>
      </header>
      <p className="hint">{t.contracts.hint}</p>

      <div className="deal-list">
        {deals.map(deal => {
          const names = t.contracts.supplier[deal.id]
          const held = signed(state, deal.id)
          const blocker = blockedBy(state, deal.id)
          const unfolded = open === deal.id

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
            <section
              className={`deal${held ? ' held' : ''}${!held && reason ? ' locked' : ''}`}
              key={deal.id}
            >
              <div className="deal-head">
                <div className="deal-name">
                  {names.name}
                  {held && <span className="deal-tag">{t.contracts.held}</span>}
                </div>
                <div className="deal-meta">
                  {t.contracts.unlocks(deal.catalogue.length)} ·{' '}
                  {t.contracts.dailyFee(money(deal.dailyFee))}
                </div>
                {reason && !held && <div className="deal-reason">{reason}</div>}
              </div>

              <div className="deal-actions">
                <button
                  className="deal-more"
                  aria-expanded={unfolded}
                  onClick={() => setOpen(unfolded ? null : deal.id)}
                >
                  {t.contracts.kit}
                  <span className="deal-caret">{unfolded ? '▴' : '▾'}</span>
                </button>

                {held ? (
                  <button
                    className="btn ghost tiny"
                    onClick={() => onContract({ type: 'cancel', supplier: deal.id })}
                  >
                    {t.contracts.cancel}
                  </button>
                ) : (
                  <button
                    className="btn tiny"
                    disabled={reason !== null}
                    onClick={() => onContract({ type: 'sign', supplier: deal.id })}
                  >
                    {t.contracts.sign(money(deal.signingFee))}
                  </button>
                )}
              </div>

              {unfolded && (
                <div className="deal-body">
                  <p className="deal-blurb">{names.blurb}</p>

                  <ul className="deal-kit">
                    {/* The catalogue is already the spec — weakest rung first,
                        which is the order the player climbs it in. */}
                    {deal.catalogue.map(spec => {
                      const Icon = assetFor(spec.id)

                      return (
                        <li className="deal-kit-row" key={spec.id}>
                          <Icon />
                          <span className="deal-kit-name">{t.content.machines[spec.id]}</span>
                          {/* The multiplier alone. What it does to the door fee
                              and to the class is the shop's explanation to give,
                              and it gives it beside the buy button. */}
                          <span className="deal-kit-mult">
                            ×{spec.revenueMultiplier.toFixed(2)}
                          </span>
                          <span className="deal-kit-price">{money(spec.price)}</span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </section>
          )
        })}
      </div>

      {/* Only once something can actually be cancelled: until then it answers
          a fear nobody has yet, and this screen is short on purpose. */}
      {deals.some(deal => signed(state, deal.id)) && (
        <p className="hint">{t.contracts.keepsKit}</p>
      )}
    </div>
  )
}
