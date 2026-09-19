import assert from "node:assert/strict";
import test from "node:test";
import { createSupportClient, cancelledPurchase, hasTestSupport } from "../app/lib/support.ts";

const config = { enabled: true, apiKey: "test_example", appUserId: "corkwill-test:alice", entitlementId: "supporter", productId: "corkwill_support_test" };
const empty = () => ({ entitlements: { active: {} } });
const active = (changes = {}) => ({ entitlements: { active: { supporter: { isActive: true, isSandbox: true, store: "TEST_STORE", productIdentifier: config.productId, ...changes } } } });
const item = { packageType: "LIFETIME", product: { identifier: config.productId, subscriptionPeriod: null, priceString: "$4.99" } };
function mockSDK() {
  let identity = "";
  const purchases = new Set();
  const calls = [];
  return {
    calls, purchases,
    isConfigured: async () => ({ isConfigured: Boolean(identity) }),
    configure: async (options) => { identity = options.appUserID; calls.push(["configure", identity]); },
    getAppUserID: async () => ({ appUserID: identity }),
    logIn: async (options) => { identity = options.appUserID; calls.push(["login", identity]); },
    getOfferings: async () => ({ current: { availablePackages: [item] } }),
    getCustomerInfo: async () => ({ customerInfo: purchases.has(identity) ? active() : empty() }),
    purchasePackage: async () => { purchases.add(identity); calls.push(["purchase", identity]); return { customerInfo: active() }; },
    restorePurchases: async () => ({ customerInfo: purchases.has(identity) ? active() : empty() }),
  };
}

test("real-store keys and unscoped identities are rejected before calling the SDK", () => {
  for (const apiKey of ["appl_real", "goog_real", "", "test_"]) assert.throws(() => createSupportClient(mockSDK(), { ...config, apiKey }), /Only RevenueCat/);
  assert.throws(() => createSupportClient(mockSDK(), { ...config, appUserId: "email@example.com" }), /Only RevenueCat/);
});

test("purchase, remount, and restore derive the badge from RevenueCat CustomerInfo", async () => {
  const sdk = mockSDK();
  const client = createSupportClient(sdk, config);
  assert.equal((await client.load()).active, false);
  assert.equal((await client.purchase()).active, true);
  assert.equal((await createSupportClient(sdk, config).load()).active, true);
  assert.equal((await client.restore()).active, true);
  assert.equal(sdk.calls.filter(([call]) => call === "configure").length, 1);
});

test("cancellation and failure do not create a supporter entitlement", async () => {
  const sdk = mockSDK();
  sdk.purchasePackage = async () => { throw { code: "1", userCancelled: true }; };
  const client = createSupportClient(sdk, config);
  await assert.rejects(client.purchase(), (error) => cancelledPurchase(error));
  assert.equal((await client.load()).active, false);
  sdk.purchasePackage = async () => { throw new Error("offline"); };
  await assert.rejects(client.purchase(), /offline/);
  assert.equal((await client.restore()).active, false);
});

test("account switching cannot reuse another account's badge, even with concurrent calls", async () => {
  const sdk = mockSDK();
  const alice = createSupportClient(sdk, config);
  const bob = createSupportClient(sdk, { ...config, appUserId: "corkwill-test:bob" });
  const [purchase, other] = await Promise.all([alice.purchase(), bob.load()]);
  assert.equal(purchase.active, true);
  assert.equal(other.active, false);
  assert.equal((await bob.restore()).active, false);
  assert.equal((await alice.load()).active, true);
  assert.deepEqual(sdk.calls.find(([call]) => call === "purchase"), ["purchase", "corkwill-test:alice"]);
});

test("unexpected subscriptions or products cannot be purchased", async () => {
  for (const unexpected of [
    { ...item, packageType: "MONTHLY" },
    { ...item, product: { ...item.product, identifier: "other" } },
    { ...item, product: { ...item.product, subscriptionPeriod: "P1M" } },
  ]) {
    const sdk = mockSDK();
    sdk.getOfferings = async () => ({ current: { availablePackages: [unexpected] } });
    await assert.rejects(createSupportClient(sdk, config).purchase(), /unavailable/);
    assert.equal(sdk.purchases.size, 0);
  }
});

test("inactive, unrelated, or real-store entitlements do not grant the test badge", () => {
  assert.equal(hasTestSupport(active(), config), true);
  for (const changes of [{ isActive: false }, { isSandbox: false }, { store: "APP_STORE" }, { productIdentifier: "other" }]) assert.equal(hasTestSupport(active(changes), config), false);
  assert.equal(cancelledPurchase(new Error("network")), false);
});
