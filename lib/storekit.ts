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

// ─── Initialize IAP Connection ───────────────────────────────────────────────

export async function initIAP(): Promise<void> {
  if (isInitialized) return;

  try {
    await initConnection();
    isInitialized = true;

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
    console.error('[IAP] Init connection failed:', err);
  }
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
  try {
    const products = await fetchProducts({
      skus: SUBSCRIPTION_SKUS,
      type: 'subs',
    });
    return products as ProductSubscription[];
  } catch (err) {
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

export function formatSubscriptionPrice(product: ProductSubscription): string {
  // iOS products have localizedPrice on the product
  if (Platform.OS === 'ios' && 'localizedPrice' in product) {
    return (product as any).localizedPrice ?? '$9.99/month';
  }
  // Android subscription offer details
  if ('subscriptionOfferDetails' in product) {
    const offer = (product as any).subscriptionOfferDetails?.[0];
    const phase = offer?.pricingPhases?.pricingPhaseList?.[0];
    if (phase?.formattedPrice) return phase.formattedPrice;
  }
  return '$9.99/month';
}
