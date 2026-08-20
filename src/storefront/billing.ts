import { Capacitor } from '@capacitor/core'
import {
  PURCHASES_ERROR_CODE,
  Purchases,
  type CustomerInfo,
  type PurchasesError,
  type PurchasesPackage,
} from '@revenuecat/purchases-capacitor'
import { getAccountService } from '../cloud'
import { PREMIUM_PRODUCTS, premiumProduct } from './catalog'
import type { PremiumProductId, StorePurchaseReceipt } from './types'

export type BillingStatus =
  | 'configuration-required'
  | 'account-required'
  | 'loading'
  | 'ready'
  | 'offline'
  | 'error'

export interface BillingProduct {
  id: PremiumProductId
  localizedPrice: string
}

export interface BillingSnapshot {
  status: BillingStatus
  products: Partial<Record<PremiumProductId, BillingProduct>>
  message: string | null
}

export interface BillingGateway {
  snapshot(): BillingSnapshot
  subscribe(listener: () => void): () => void
  refresh(): Promise<void>
  purchase(id: PremiumProductId): Promise<StorePurchaseReceipt>
  restore(): Promise<StorePurchaseReceipt[]>
}

const UNAVAILABLE_SNAPSHOT: BillingSnapshot = {
  status: 'configuration-required',
  products: {},
  message: null,
}

/** Never opens a fake checkout and never grants a reward. */
export const unavailableBillingGateway: BillingGateway = {
  snapshot: () => UNAVAILABLE_SNAPSHOT,
  subscribe: () => () => undefined,
  refresh: async () => undefined,
  purchase: async () => {
    throw new Error('Native billing is not configured.')
  },
  restore: async () => {
    throw new Error('Native billing is not configured.')
  },
}

const nativeKey = (): string | null => {
  const platform = Capacitor.getPlatform()
  const raw = platform === 'ios'
    ? import.meta.env.VITE_REVENUECAT_IOS_API_KEY
    : platform === 'android'
      ? import.meta.env.VITE_REVENUECAT_ANDROID_API_KEY
      : undefined
  const key = raw?.trim()
  return key ? key : null
}

const errorCode = (cause: unknown): PURCHASES_ERROR_CODE | null => {
  if (typeof cause !== 'object' || cause === null || !('code' in cause)) return null
  return String((cause as Partial<PurchasesError>).code) as PURCHASES_ERROR_CODE
}

function friendlyError(cause: unknown): Error {
  const code = errorCode(cause)
  if (code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
    return new Error('Zakup został anulowany.')
  }
  if (code === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR) {
    return new Error('Płatność oczekuje na potwierdzenie sklepu. Nagroda nie została jeszcze naliczona.')
  }
  if (code === PURCHASES_ERROR_CODE.NETWORK_ERROR || code === PURCHASES_ERROR_CODE.OFFLINE_CONNECTION_ERROR) {
    return new Error('Brak połączenia ze sklepem. Spróbuj ponownie za chwilę.')
  }
  if (cause instanceof Error && cause.message) return cause
  return new Error('Sklep nie mógł dokończyć operacji.')
}

const restoredReceipts = (info: CustomerInfo): StorePurchaseReceipt[] => {
  const receipts: StorePurchaseReceipt[] = []
  for (const product of PREMIUM_PRODUCTS) {
    if (!product.entitlementId) continue
    const entitlement = info.entitlements.active[product.entitlementId]
    if (!entitlement || entitlement.productIdentifier !== product.storeProductId) continue

    const transaction = [...info.nonSubscriptionTransactions]
      .reverse()
      .find(item => item.productIdentifier === product.storeProductId)
    receipts.push({
      productId: product.id,
      transactionId: transaction?.transactionIdentifier ??
        `restore:${product.entitlementId}:${entitlement.originalPurchaseDateMillis}`,
    })
  }
  return receipts
}

/**
 * RevenueCat adapter for the native Capacitor builds. It identifies purchases
 * with the Supabase UUID, reads localized prices from the platform store and
 * exposes only store-confirmed transaction receipts to the game reducer.
 */
export class RevenueCatBillingGateway implements BillingGateway {
  private current: BillingSnapshot = UNAVAILABLE_SNAPSHOT
  private listeners = new Set<() => void>()
  private packages = new Map<PremiumProductId, PurchasesPackage>()
  private configured = false
  private userId: string | null = null
  private observedUserId: string | null = null
  private generation = 0
  private identityQueue: Promise<void> = Promise.resolve()

  constructor() {
    getAccountService().subscribe(account => {
      const userId = account.session?.userId ?? null
      if (userId === this.observedUserId) return
      this.observedUserId = userId
      this.identityQueue = this.identityQueue
        .then(() => userId ? this.load(userId) : this.clearUser())
        .catch(() => undefined)
    })
  }

  snapshot = (): BillingSnapshot => this.current

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  refresh = async (): Promise<void> => {
    const userId = getAccountService().state().session?.userId
    if (!userId) return
    if (this.observedUserId === userId &&
      (this.current.status === 'loading' || this.current.status === 'ready')) {
      await this.identityQueue
      return
    }
    this.identityQueue = this.identityQueue.then(() => this.load(userId))
    await this.identityQueue
  }

  private publish(snapshot: BillingSnapshot): void {
    this.current = snapshot
    for (const listener of [...this.listeners]) listener()
  }

  private async clearUser(): Promise<void> {
    this.generation += 1
    const shouldLogOut = this.configured && this.userId !== null
    this.userId = null
    this.packages.clear()
    this.publish({ status: 'account-required', products: {}, message: null })
    if (shouldLogOut) {
      try {
        await Purchases.logOut()
      } catch {
        // Checkout is already disabled. A later logIn still moves the SDK to
        // the next explicit Supabase UUID, without exposing anonymous buying.
      }
    }
  }

  private async load(userId: string): Promise<void> {
    const key = nativeKey()
    if (!Capacitor.isNativePlatform() || !key) {
      this.publish({
        status: 'configuration-required',
        products: {},
        message: Capacitor.isNativePlatform()
          ? 'Brakuje publicznego klucza RevenueCat dla tej platformy.'
          : 'Zakupy mobilne są dostępne w aplikacji iOS i Android.',
      })
      return
    }

    const generation = ++this.generation
    this.publish({ status: 'loading', products: {}, message: null })

    try {
      if (!this.configured) {
        await Purchases.configure({ apiKey: key, appUserID: userId })
        this.configured = true
      } else if (this.userId !== userId) {
        await Purchases.logIn({ appUserID: userId })
      }
      this.userId = userId

      const offerings = await Purchases.getOfferings()
      const requested = import.meta.env.VITE_REVENUECAT_OFFERING_ID?.trim()
      const offering = requested ? offerings.all[requested] ?? null : offerings.current
      if (!offering) throw new Error(`Brak aktywnej oferty RevenueCat „${requested ?? 'current'}”.`)

      const nextPackages = new Map<PremiumProductId, PurchasesPackage>()
      const products: BillingSnapshot['products'] = {}
      for (const item of PREMIUM_PRODUCTS) {
        const aPackage = offering.availablePackages.find(pkg => pkg.product.identifier === item.storeProductId)
        if (!aPackage) continue
        nextPackages.set(item.id, aPackage)
        products[item.id] = { id: item.id, localizedPrice: aPackage.product.priceString }
      }
      if (generation !== this.generation) return
      this.packages = nextPackages
      const missing = PREMIUM_PRODUCTS.length - nextPackages.size
      this.publish({
        status: nextPackages.size > 0 ? 'ready' : 'configuration-required',
        products,
        message: missing > 0 ? `Brakuje ${missing} produktów w aktywnej ofercie RevenueCat.` : null,
      })
    } catch (cause) {
      if (generation !== this.generation) return
      const code = errorCode(cause)
      const offline = code === PURCHASES_ERROR_CODE.NETWORK_ERROR ||
        code === PURCHASES_ERROR_CODE.OFFLINE_CONNECTION_ERROR
      this.publish({ status: offline ? 'offline' : 'error', products: {}, message: friendlyError(cause).message })
    }
  }

  async purchase(id: PremiumProductId): Promise<StorePurchaseReceipt> {
    const aPackage = this.packages.get(id)
    if (this.current.status !== 'ready' || !aPackage || !this.userId) {
      throw new Error('Ten produkt nie jest jeszcze dostępny w sklepie.')
    }

    try {
      const result = await Purchases.purchasePackage({ aPackage })
      const product = premiumProduct(id)
      if (result.productIdentifier !== product.storeProductId || !result.transaction.transactionIdentifier) {
        throw new Error('Sklep zwrócił nieprawidłowe potwierdzenie zakupu.')
      }
      return { productId: id, transactionId: result.transaction.transactionIdentifier }
    } catch (cause) {
      throw friendlyError(cause)
    }
  }

  async restore(): Promise<StorePurchaseReceipt[]> {
    if (this.current.status !== 'ready' || !this.userId) {
      throw new Error('Zaloguj się i połącz ze sklepem, aby przywrócić zakupy.')
    }
    try {
      const { customerInfo } = await Purchases.restorePurchases()
      return restoredReceipts(customerInfo)
    } catch (cause) {
      throw friendlyError(cause)
    }
  }
}

export const revenueCatBillingGateway: BillingGateway = new RevenueCatBillingGateway()
