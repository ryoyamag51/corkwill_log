import type { CustomerInfo, Purchases } from "@revenuecat/purchases-capacitor";

export type SupportConfig = {
  enabled: true;
  apiKey: string;
  appUserId: string;
  entitlementId: string;
  productId: string;
};

type SupportSDK = Pick<typeof Purchases, "isConfigured" | "configure" | "getAppUserID" | "logIn" | "getCustomerInfo" | "getOfferings" | "purchasePackage" | "restorePurchases">;
export type SupportStatus = { active: boolean; price: string };

// The native SDK is a singleton. Serialize identity selection with each operation,
// including across component remounts and changes of CorkWill account.
let sdkTail: Promise<unknown> = Promise.resolve();

export function cancelledPurchase(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { userCancelled?: unknown; code?: unknown };
  return value.userCancelled === true || String(value.code) === "1";
}

export function hasTestSupport(info: CustomerInfo, config: SupportConfig): boolean {
  const entitlement = info.entitlements.active[config.entitlementId];
  return Boolean(entitlement?.isActive && entitlement.isSandbox && entitlement.store === "TEST_STORE"
    && entitlement.productIdentifier === config.productId);
}

export function createSupportClient(sdk: SupportSDK, config: SupportConfig) {
  // There is deliberately no real-store fallback in this Next Gen build.
  if (!/^test_[A-Za-z0-9]+$/.test(config.apiKey) || !config.appUserId.startsWith("corkwill-test:")) {
    throw new Error("Only RevenueCat Test Store configuration is supported.");
  }

  function run<T>(operation: () => Promise<T>): Promise<T> {
    const result = sdkTail.then(async () => {
      if (!(await sdk.isConfigured()).isConfigured) {
        await sdk.configure({ apiKey: config.apiKey, appUserID: config.appUserId });
      } else if ((await sdk.getAppUserID()).appUserID !== config.appUserId) {
        await sdk.logIn({ appUserID: config.appUserId });
      }
      return operation();
    });
    sdkTail = result.catch(() => undefined);
    return result;
  }

  async function supportPackage() {
    const offerings = await sdk.getOfferings();
    const item = offerings.current?.availablePackages.find((candidate) =>
      candidate.product.identifier === config.productId && candidate.packageType === "LIFETIME"
      && candidate.product.subscriptionPeriod === null);
    if (!item) throw new Error("The one-time Test Store support product is unavailable.");
    return item;
  }

  return {
    load: () => run(async (): Promise<SupportStatus> => {
      const item = await supportPackage();
      const { customerInfo } = await sdk.getCustomerInfo();
      return { active: hasTestSupport(customerInfo, config), price: item.product.priceString };
    }),
    purchase: () => run(async (): Promise<SupportStatus> => {
      const item = await supportPackage();
      const { customerInfo } = await sdk.purchasePackage({ aPackage: item });
      return { active: hasTestSupport(customerInfo, config), price: item.product.priceString };
    }),
    restore: () => run(async (): Promise<SupportStatus> => {
      const { customerInfo } = await sdk.restorePurchases();
      return { active: hasTestSupport(customerInfo, config), price: "" };
    }),
  };
}
