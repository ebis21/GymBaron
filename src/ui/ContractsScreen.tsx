import { useState } from 'react'
import type { GameState } from '../game/types'
import type { ContractAction } from '../game/contracts'
import type { SupplierId } from '../game/content/suppliers'
import { blockedBy, signed, suppliers } from '../game/contracts'
import { assetFor } from '../assets/assetFor'
import { useI18n } from '../i18n'
import ManagementIcon from './ManagementIcon'

interface Props {
  state: GameState
  /** The feature's one dispatcher, wired straight through from the store. */
  onContract: (action: ContractAction) => void
}

const MONOGRAM: Record<SupplierId, string> = {
  ferrum: 'FW',
  apex: 'AA',
}

/**
 * Equipment supplier contracts, presented as a small physical catalogue.
 * The commercial decision stays visible while each machine list folds open
 * beneath it, so a long catalogue never buries the sign or cancel action.
 */
export default function ContractsScreen({ state, onContract }: Props) {
  const { t, money } = useI18n()
  const deals = suppliers()
  const [open, setOpen] = useState<SupplierId | null>(null)

  return (
    <div className="screen management-screen management-contracts">
      <header className="management-hero">
        <div className="management-hero-mark">
          <ManagementIcon name="contract" />
        </div>
        <div className="management-hero-copy">
          <h2>{t.contracts.title}</h2>
          <p>{t.contracts.hint}</p>
        </div>
        <div className="management-wallet">
          <span>{t.topbar.cash}</span>
          <strong>{money(state.cash)}</strong>
        </div>
      </header>

      <div className="supplier-grid">
        {deals.map(deal => {
          const names = t.contracts.supplier[deal.id]
          const held = signed(state, deal.id)
          const blocker = blockedBy(state, deal.id)
          const unfolded = open === deal.id
          const reason = blocker === 'level'
            ? t.contracts.needsLevel(deal.minLevel)
            : blocker === 'requires' && deal.requires !== null
              ? t.contracts.needsSupplier(t.contracts.supplier[deal.requires].name)
              : blocker === 'cash'
                ? t.contracts.short(money(deal.signingFee - state.cash))
                : null

          return (
            <section
              className={`management-card supplier-card supplier-${deal.id}${held ? ' is-held' : ''}${!held && reason ? ' is-locked' : ''}`}
              key={deal.id}
            >
              <div className="supplier-head">
                <div className="supplier-mark" aria-hidden="true">{MONOGRAM[deal.id]}</div>
                <div className="management-card-title">
                  <span className="management-eyebrow">{t.contracts.unlocks(deal.catalogue.length)}</span>
                  <h3>{names.name}</h3>
                </div>
                {held && <span className="management-state complete">{t.contracts.held}</span>}
              </div>

              <p className="management-card-copy">{names.blurb}</p>

              <div className="supplier-terms">
                <div>
                  <span>{t.contracts.signingFee}</span>
                  <strong>{money(deal.signingFee)}</strong>
                </div>
                <div>
                  <span>{t.contracts.reportLine}</span>
                  <strong>{t.contracts.dailyFee(money(deal.dailyFee))}</strong>
                </div>
              </div>

              {reason && !held && <div className="management-notice danger">{reason}</div>}

              <div className="supplier-actions">
                <button
                  className="supplier-toggle"
                  aria-expanded={unfolded}
                  onClick={() => setOpen(unfolded ? null : deal.id)}
                >
                  <ManagementIcon name="equipment" />
                  <span>{t.contracts.kit}</span>
                  <span className="supplier-caret" aria-hidden="true">{unfolded ? '−' : '+'}</span>
                </button>

                {held ? (
                  <button
                    className="btn ghost management-cta"
                    onClick={() => onContract({ type: 'cancel', supplier: deal.id })}
                  >
                    {t.contracts.cancel}
                  </button>
                ) : (
                  <button
                    className="btn management-cta"
                    disabled={reason !== null}
                    onClick={() => onContract({ type: 'sign', supplier: deal.id })}
                  >
                    {t.contracts.sign(money(deal.signingFee))}
                  </button>
                )}
              </div>

              {unfolded && (
                <ul className="supplier-kit">
                  {deal.catalogue.map(spec => {
                    const Icon = assetFor(spec.id)
                    return (
                      <li className="supplier-kit-row" key={spec.id}>
                        <div className="supplier-kit-art"><Icon /></div>
                        <div>
                          <strong>{t.content.machines[spec.id]}</strong>
                          <span>×{spec.revenueMultiplier.toFixed(2)}</span>
                        </div>
                        <b>{money(spec.price)}</b>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          )
        })}
      </div>

      {deals.some(deal => signed(state, deal.id)) && (
        <p className="management-footnote">{t.contracts.keepsKit}</p>
      )}
    </div>
  )
}
