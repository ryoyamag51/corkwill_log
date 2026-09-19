import { authenticatedUser, hashValue, json, runtimeEnv } from "../../../lib/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const runtime = runtimeEnv();
  const apiKey = runtime.REVENUECAT_TEST_API_KEY ?? "";
  // This sandbox feature stays disabled on the public production service.
  if (runtime.APP_ENV !== "review" || !/^test_[A-Za-z0-9]+$/.test(apiKey)) {
    return json({ enabled: false });
  }
  const user = await authenticatedUser(request);
  if (!user) return json({ error: "Sign in required." }, { status: 401 });
  return json({
    enabled: true,
    apiKey, // RevenueCat's public, client-side Test Store key; never a secret API key.
    appUserId: `corkwill-test:${await hashValue(user.id, "corkwill-support-v1")}`,
    entitlementId: "supporter",
    productId: "corkwill_support_test",
  });
}
