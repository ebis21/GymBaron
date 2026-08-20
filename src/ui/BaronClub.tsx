import { useState } from 'react'
import type { DiamondUpgradeId, GameState } from '../game/types'
import { useI18n } from '../i18n'
import AccountScreen from './AccountScreen'
import DiamondUpgradeScreen from './UpgradeScreen'
import MultiplayerPanel from './MultiplayerPanel'
import PremiumStoreScreen from './PremiumStoreScreen'
import { useDialogFocus } from './useDialogFocus'
import type { StorePurchaseReceipt } from '../storefront/types'

type ClubSection = 'home' | 'store' | 'diamond-upgrades' | 'multiplayer' | 'account'

interface Props {
  state: GameState
  onBuyDiamondUpgrade: (id: DiamondUpgradeId) => void
  onRedeemPremiumPurchases: (receipts: StorePurchaseReceipt[]) => void
  onClose: () => void
}

export default function BaronClub({
  state,
  onBuyDiamondUpgrade,
  onRedeemPremiumPurchases,
  onClose,
}: Props) {
  const { t, money } = useI18n()
  const [section, setSection] = useState<ClubSection>('home')
  const leave = () => section === 'home' ? onClose() : setSection('home')
  const dialogRef = useDialogFocus<HTMLElement>(leave)
  const copy = t.club.home

  const tiles: Array<{
    id: Exclude<ClubSection, 'home'>
    glyph: string
    title: string
    description: string
    className: string
  }> = [
    { id: 'store', glyph: '🛍️', ...copy.store, className: 'store' },
    { id: 'diamond-upgrades', glyph: '💎', ...copy.diamonds, className: 'diamonds' },
    { id: 'multiplayer', glyph: '🤝', ...copy.friends, className: 'friends' },
    { id: 'account', glyph: '☁️', ...copy.account, className: 'account' },
  ]

  return (
    <div className="club-backdrop" role="presentation">
      <section
        ref={dialogRef}
        className="baron-club"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="baron-club-title"
      >
        <header className="club-topbar">
          <div className="club-brand">
            <span aria-hidden="true">♛</span>
            <div>
              <strong id="baron-club-title">BARON CLUB</strong>
              <small>GYMBARON</small>
            </div>
          </div>

          {section !== 'home' && (
            <button className="club-back" type="button" onClick={() => setSection('home')}>
              ← {copy.back}
            </button>
          )}

          <button className="club-close" type="button" onClick={onClose} aria-label={copy.close}>
            ✕
          </button>
        </header>

        <div className="club-body">
          {section === 'home' ? (
            <div className="club-home">
              <header className="club-hero">
                <div>
                  <p className="club-eyebrow">{copy.title}</p>
                  <h1>{copy.subtitle}</h1>
                </div>
                <div className="club-wallet" aria-label={copy.wallet}>
                  <span>{money(state.cash)}</span>
                  <span>💎 {state.diamonds}</span>
                </div>
              </header>

              <div className="club-tile-grid">
                {tiles.map(tile => (
                  <button
                    className={`club-tile is-${tile.className}`}
                    type="button"
                    key={tile.id}
                    onClick={() => setSection(tile.id)}
                  >
                    <span className="club-tile-glyph" aria-hidden="true">{tile.glyph}</span>
                    <span className="club-tile-copy">
                      <strong>{tile.title}</strong>
                      <small>{tile.description}</small>
                    </span>
                    <span className="club-tile-open">{copy.open} →</span>
                  </button>
                ))}
              </div>
            </div>
          ) : section === 'store' ? (
            <PremiumStoreScreen
              onOpenAccount={() => setSection('account')}
              onRedeem={onRedeemPremiumPurchases}
              ownedProductIds={state.premium.ownedProductIds}
            />
          ) : section === 'diamond-upgrades' ? (
            <div className="club-section club-embedded">
              <DiamondUpgradeScreen state={state} onBuy={onBuyDiamondUpgrade} />
            </div>
          ) : section === 'multiplayer' ? (
            <div className="club-section club-embedded">
              <MultiplayerPanel onOpenAccount={() => setSection('account')} />
            </div>
          ) : (
            <div className="club-section club-embedded">
              <AccountScreen />
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
