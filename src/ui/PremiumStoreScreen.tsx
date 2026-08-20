import { useEffect, useState, useSyncExternalStore } from 'react'
import { useAccount } from '../cloud'
import { useI18n } from '../i18n'
import {
  PREMIUM_PRODUCTS,
  type PremiumProductId,
} from '../storefront/catalog'
import {
  revenueCatBillingGateway,
  type BillingGateway,
} from '../storefront/billing'
import type { StorePurchaseReceipt } from '../storefront/types'

interface Props {
  onOpenAccount: () => void
  onRedeem: (receipts: StorePurchaseReceipt[]) => void
  ownedProductIds: PremiumProductId[]
  billing?: BillingGateway
}

export default function PremiumStoreScreen({
  onOpenAccount,
  onRedeem,
  ownedProductIds,
  billing = revenueCatBillingGateway,
}: Props) {
  const { language } = useI18n()
  const { state: account } = useAccount()
  const snapshot = useSyncExternalStore(billing.subscribe, billing.snapshot, billing.snapshot)
  const [busy, setBusy] = useState<PremiumProductId | 'restore' | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (account.session) void billing.refresh()
  }, [account.session?.userId, billing])

  const copy = language === 'pl'
    ? {
        eyebrow: 'Sklep premium',
        title: 'Rozwijaj swoje imperium szybciej',
        hint: 'Płatność zawsze pokazuje cenę z App Store lub Google Play przed zatwierdzeniem.',
        login: 'Zaloguj się, żeby zakup był przypisany do konta i możliwy do odzyskania na innym urządzeniu.',
        loginCta: 'Otwórz konto',
        setup: 'Katalog jest gotowy. Dodaj produkty i publiczne klucze RevenueCat, aby włączyć natywne płatności.',
        buy: 'Kup',
        unavailable: 'Konfiguracja IAP',
        restore: 'Przywróć zakupy',
        restored: 'Zakupy zostały odświeżone.',
        success: 'Zakup potwierdzony przez sklep. Nagroda została dodana i zapisana.',
        owned: 'Posiadasz',
        consumable: 'Do wielokrotnego zakupu',
        permanent: 'Zakup stały',
      }
    : {
        eyebrow: 'Premium store',
        title: 'Grow your empire faster',
        hint: 'Checkout always shows the App Store or Google Play price before confirmation.',
        login: 'Sign in so the purchase belongs to your account and can be recovered on another device.',
        loginCta: 'Open account',
        setup: 'The catalogue is ready. Add the products and RevenueCat public SDK keys to enable native checkout.',
        buy: 'Buy',
        unavailable: 'Configure IAP',
        restore: 'Restore purchases',
        restored: 'Purchases refreshed.',
        success: 'Purchase confirmed by the store. The reward was granted and saved.',
        owned: 'Owned',
        consumable: 'Repeatable purchase',
        permanent: 'Permanent purchase',
      }

  const purchase = async (id: PremiumProductId) => {
    setBusy(id)
    setMessage(null)
    try {
      const receipt = await billing.purchase(id)
      onRedeem([receipt])
      setMessage(copy.success)
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(null)
    }
  }

  const restore = async () => {
    setBusy('restore')
    setMessage(null)
    try {
      const receipts = await billing.restore()
      onRedeem(receipts)
      setMessage(copy.restored)
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(null)
    }
  }

  const ready = snapshot.status === 'ready'

  return (
    <div className="club-section premium-store-screen">
      <header className="premium-store-hero">
        <div>
          <p className="club-eyebrow">{copy.eyebrow}</p>
          <h2>{copy.title}</h2>
          <p>{copy.hint}</p>
        </div>
        <div className="premium-store-mark" aria-hidden="true">♛</div>
      </header>

      {!account.session && (
        <div className="premium-store-notice">
          <span aria-hidden="true">☁️</span>
          <p>{copy.login}</p>
          <button className="btn primary" type="button" onClick={onOpenAccount}>
            {copy.loginCta}
          </button>
        </div>
      )}

      {snapshot.status === 'configuration-required' && (
        <div className="premium-store-notice is-setup">
          <span aria-hidden="true">🛡️</span>
          <p>{copy.setup}</p>
        </div>
      )}

      <div className="premium-product-grid">
        {PREMIUM_PRODUCTS.map(product => {
          const storeProduct = snapshot.products[product.id]
          const owned = product.kind === 'non-consumable' && ownedProductIds.includes(product.id)
          const disabled = !ready || !storeProduct || !account.session || busy !== null || owned
          return (
            <article className={`premium-product-card is-${product.accent}`} key={product.id}>
              {product.badge && (
                <span className="premium-product-badge">{product.badge[language]}</span>
              )}
              <div className="premium-product-glyph" aria-hidden="true">{product.glyph}</div>
              <div className="premium-product-copy">
                <span className="premium-product-kind">
                  {product.kind === 'consumable' ? copy.consumable : copy.permanent}
                </span>
                <h3>{product.title[language]}</h3>
                <p>{product.description[language]}</p>
              </div>
              <button
                className="btn primary block premium-buy"
                type="button"
                disabled={disabled}
                onClick={() => void purchase(product.id)}
              >
                {busy === product.id
                  ? '…'
                  : owned
                    ? copy.owned
                    : ready && storeProduct
                      ? `${copy.buy} · ${storeProduct.localizedPrice}`
                      : copy.unavailable}
              </button>
            </article>
          )
        })}
      </div>

      <footer className="premium-store-footer">
        <button className="btn ghost" type="button" disabled={!ready || !account.session || busy !== null} onClick={() => void restore()}>
          {copy.restore}
        </button>
        {(message ?? snapshot.message) && <p>{message ?? snapshot.message}</p>}
      </footer>
    </div>
  )
}
