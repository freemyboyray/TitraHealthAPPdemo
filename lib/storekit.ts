/**
 * StoreKit 2 Integration for TitraHealth Pro subscriptions.
 *
 * Uses `react-native-iap` for cross-platform StoreKit 2 (iOS) and
 * Google Play Billing (Android) support.
 *
 * Setup required:
 * 1. `npx expo install react-native-iap`
 * 2. Configure product in App Store Connect / Google Play Console
 * 3. Set appAccountToken to Supabase user ID at purchase time
 */

import { Platform } from 'react-native';
import {
  initConnection,
  endConnection,
  fetchProducts,
  requestPurchase,
  purchaseUpdatedListener,
  purchaseErrorListener,
  finishTransaction,
  getAvailablePurchases,
} from 'react-native-iap';
import type {
  Purchase,
  PurchaseError,
  ProductSubscription,
} from 'react-native-iap';
import { supabase } from './supabase';
import { useSubscriptionStore } from '../stores/subscription-store';

// ─── Product IDs ─────────────────────────────────────────────────────────────

export const PRODUCT_IDS = {
  MONTHLY: Platform.select({
    ios: 'com.titrahealth.pro.monthly',
    android: 'com.titrahealth.pro.monthly',
  }) ?? 'com.titrahealth.pro.monthly',
  ANNUAL: Platform.select({
    ios: 'com.titrahealth.pro.annual',
    android: 'com.titrahealth.pro.annual',
  }) ?? 'com.titrahealth.pro.annual',
};

const SUBSCRIPTION_SKUS = [PRODUCT_IDS.MONTHLY, PRODUCT_IDS.ANNUAL];

// ─── State ───────────────────────────────────────────────────────────────────

let purchaseUpdateSubscription: { remove: () => void } | null = null;
let purchaseErrorSubscription: { remove: () => void } | null = null;
let isInitialized = false;
let initPromise: Promise<void> | null = null;
let lastInitError: string | null = null;
let lastFetchError: string | null = null;

export function getIAPDiagnostics(): { initialized: boolean; initError: string | null; fetchError: string | null } {
  return { initialized: isInitialized, initError: lastInitError, fetchError: lastFetchError };
}

// ─── Initialize IAP Connection ───────────────────────────────────────────────

export function initIAP(): Promise<void> {
  if (isInitialized) return Promise.resolve();
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      await initConnection();
      isInitialized = true;
      lastInitError = null;

      // Listen for purchase updates (renewals, initial purchases)
      purchaseUpdateSubscription = purchaseUpdatedListener(
        async (purchase: Purchase) => {
          console.log('[IAP] Purchase updated:', purchase.productId);

          // Finish the transaction (acknowledge receipt)
          await finishTransaction({ purchase, isConsumable: false });

          // Update local state optimistically for instant UI feedback
          useSubscriptionStore.getState().setPremium(true);

          // Give the webhook a moment to process, then confirm from DB
          setTimeout(() => {
            useSubscriptionStore.getState().refreshPremiumStatus();
          }, 3000);
        },
      );

      // Listen for purchase errors
      purchaseErrorSubscription = purchaseErrorListener(
        (error: PurchaseError) => {
          console.warn('[IAP] Purchase error:', error.code, error.message);
        },
      );
    } catch (err) {
      lastInitError = (err as Error)?.message ?? String(err);
      console.error('[IAP] Init connection failed:', err);
    }
  })();

  return initPromise;
}

// ─── Teardown ────────────────────────────────────────────────────────────────

export function teardownIAP(): void {
  purchaseUpdateSubscription?.remove();
  purchaseErrorSubscription?.remove();
  purchaseUpdateSubscription = null;
  purchaseErrorSubscription = null;
  endConnection();
  isInitialized = false;
}

// ─── Fetch Product Details ───────────────────────────────────────────────────

export async function getProducts(): Promise<ProductSubscription[]> {
  // Make sure StoreKit is connected before asking for products — otherwise
  // fetchProducts can return an empty list silently on a cold start.
  await initIAP();
  if (!isInitialized) return [];

  try {
    const products = await fetchProducts({
      skus: SUBSCRIPTION_SKUS,
      type: 'subs',
    });
    const list = (products ?? []) as ProductSubscription[];
    lastFetchError = list.length === 0 ? 'StoreKit returned 0 products' : null;
    return list;
  } catch (err) {
    lastFetchError = (err as Error)?.message ?? String(err);
    console.error('[IAP] Failed to get products:', err);
    return [];
  }
}

// ─── Purchase Subscription ───────────────────────────────────────────────────

export async function purchaseMonthly(): Promise<void> {
  // Get the current user ID to pass as appAccountToken
  // This links the Apple subscription to our Supabase user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Must be signed in to purchase');

  await requestPurchase({
    type: 'subs',
    request: {
      apple: {
        sku: PRODUCT_IDS.MONTHLY,
        appAccountToken: user.id,
      },
      google: {
        skus: [PRODUCT_IDS.MONTHLY],
        obfuscatedAccountId: user.id,
      },
    },
  });
}

export async function purchaseAnnual(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Must be signed in to purchase');

  await requestPurchase({
    type: 'subs',
    request: {
      apple: {
        sku: PRODUCT_IDS.ANNUAL,
        appAccountToken: user.id,
      },
      google: {
        skus: [PRODUCT_IDS.ANNUAL],
        obfuscatedAccountId: user.id,
      },
    },
  });
}

// ─── Restore Purchases ───────────────────────────────────────────────────────

export async function restorePurchases(): Promise<boolean> {
  try {
    const purchases = await getAvailablePurchases();
    const hasActive = purchases.some(
      (p) => SUBSCRIPTION_SKUS.includes(p.productId),
    );

    if (hasActive) {
      // Update local state immediately
      useSubscriptionStore.getState().setPremium(true);
      // Confirm with server
      await useSubscriptionStore.getState().refreshPremiumStatus();
    }

    return hasActive;
  } catch (err) {
    console.error('[IAP] Restore purchases failed:', err);
    return false;
  }
}

// ─── Format Price ────────────────────────────────────────────────────────────

function periodSuffix(unit: string | null | undefined): string {
  switch ((unit ?? '').toLowerCase()) {
    case 'year': return '/yr';
    case 'month': return '/mo';
    case 'week': return '/wk';
    case 'day': return '/day';
    default: return '';
  }
}

export function formatSubscriptionPrice(product: ProductSubscription): string {
  const p = product as any;

  if (Platform.OS === 'ios') {
    // v15: localized price string is `displayPrice` (was `localizedPrice` pre-v15).
    const price: string | undefined = p.displayPrice ?? p.localizedPrice;
    const unit = p.subscriptionInfoIOS?.subscriptionPeriod?.unit ?? p.subscriptionPeriodUnitIOS;
    if (price) return `${price}${periodSuffix(unit)}`;
  } else {
    // Android: read the recurring (non-free) pricing phase for price + billing period.
    const offers = p.subscriptionOfferDetailsAndroid ?? p.subscriptionOfferDetails ?? [];
    for (const offer of offers) {
      const phases = offer?.pricingPhases?.pricingPhaseList ?? [];
      const paid = phases.find((ph: any) => ph.priceAmountMicros && ph.priceAmountMicros !== '0')
        ?? phases[phases.length - 1];
      if (paid?.formattedPrice) {
        const m = (paid.billingPeriod ?? '').match(/P\d*([DWMY])/);
        const unitMap: Record<string, string> = { D: 'day', W: 'week', M: 'month', Y: 'year' };
        return `${paid.formattedPrice}${periodSuffix(m ? unitMap[m[1]] : null)}`;
      }
    }
    if (p.displayPrice) return p.displayPrice;
  }

  return '';
}

// ─── Introductory Offer Info ────────────────────────────────────────────────

export type IntroOfferInfo = {
  hasOffer: boolean;
  trialDays: number | null;
  trialLabel: string | null;
};

// Convert a StoreKit period (unit + per-period length + number of periods) to total days.
// react-native-iap v15 uses lowercase units ('day' | 'week' | 'month' | 'year').
const UNIT_DAYS: Record<string, number> = { day: 1, week: 7, month: 30, year: 365 };
function periodToDays(unit: string | null | undefined, perValue = 1, periodCount = 1): number {
  const base = UNIT_DAYS[(unit ?? '').toLowerCase()] ?? 0;
  return base * (perValue || 1) * (periodCount || 1);
}

export function getIntroOfferInfo(product: ProductSubscription): IntroOfferInfo {
  const p = product as any;
  const trial = (days: number): IntroOfferInfo =>
    ({ hasOffer: true, trialDays: days, trialLabel: `${days}-day free trial` });

  // 1. Standardized cross-platform offers (react-native-iap v15 / OpenIAP — preferred).
  //    Each offer carries paymentMode ('free-trial') + period {unit, value} + periodCount.
  const stdOffers: any[] = Array.isArray(p.subscriptionOffers) ? p.subscriptionOffers : [];
  for (const o of stdOffers) {
    const isFreeTrial = o?.paymentMode === 'free-trial' || (o?.type === 'introductory' && o?.price === 0);
    if (isFreeTrial) {
      const days = periodToDays(o?.period?.unit, o?.period?.value ?? 1, o?.periodCount ?? 1);
      if (days > 0) return trial(days);
    }
  }

  // 2. iOS: nested introductory offer (subscriptionInfoIOS.introductoryOffer).
  if (Platform.OS === 'ios') {
    const io = p.subscriptionInfoIOS?.introductoryOffer;
    if (io && (io.paymentMode === 'free-trial' || io.price === 0)) {
      const days = periodToDays(io.period?.unit, io.period?.value ?? 1, io.periodCount ?? 1);
      if (days > 0) return trial(days);
    }

    // 3. iOS: legacy flat fields (older shape / safety net).
    const period = p.introductoryPriceSubscriptionPeriodIOS;
    const numPeriods = parseInt(p.introductoryPriceNumberOfPeriodsIOS ?? '', 10) || 0;
    const mode = p.introductoryPricePaymentModeIOS;
    const priceStr = p.introductoryPriceIOS ?? p.introductoryPrice;
    const isFree = mode === 'free-trial' || !priceStr || priceStr === '0' || priceStr === '0.00';
    if (period && numPeriods > 0 && isFree) {
      const days = periodToDays(period, 1, numPeriods);
      if (days > 0) return trial(days);
    }
  }

  // 4. Android: pricing phases with a zero-price (free trial) phase.
  const androidOffers = p.subscriptionOfferDetailsAndroid ?? p.subscriptionOfferDetails ?? [];
  for (const offer of androidOffers) {
    const phases = offer?.pricingPhases?.pricingPhaseList ?? [];
    for (const phase of phases) {
      if (phase.priceAmountMicros === '0' || phase.formattedPrice === 'Free') {
        const match = (phase.billingPeriod ?? '').match(/P(\d+)([DWMY])/);
        if (match) {
          const count = parseInt(match[1], 10);
          const unitMap: Record<string, string> = { D: 'day', W: 'week', M: 'month', Y: 'year' };
          const days = periodToDays(unitMap[match[2]], count, 1);
          if (days > 0) return trial(days);
        }
      }
    }
  }

  return { hasOffer: false, trialDays: null, trialLabel: null };
}
