import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

const { generateKeyPair, exportJWK, SignJWT, jwtVerify } = await import("jose");
const googleSigningKeys = await generateKeyPair("RS256");
const googleJwk = { ...await exportJWK(googleSigningKeys.publicKey), kid: "test-google-key", alg: "RS256", use: "sig" };
const testSessionSecret = "test-session-secret-with-at-least-32-characters";
let mockedGoogleToken = "";
let workerHarness;
let schemaReady = false;
async function initializeDatabase() {
  const mf = await harness();
  const db = await mf.getD1Database("DB");
  if (!schemaReady) {
    for (const filename of ["0000_funny_imperial_guard.sql", "0001_complete_jubilee.sql"]) {
      const sql = await readFile(new URL(`../drizzle/${filename}`, import.meta.url), "utf8");
      for (const statement of sql.replaceAll("--> statement-breakpoint", "").split(";").filter((s) => s.trim())) await db.prepare(statement).run();
    }
    schemaReady = true;
  }
  return db;
}

async function loadMiniflare() {
  try {
    return await import("miniflare");
  } catch {
    const pnpmRoot = new URL("../node_modules/.pnpm/", import.meta.url);
    const entries = await readdir(pnpmRoot);
    const packageDirectory = entries.find((entry) => entry.startsWith("miniflare@"));
    if (!packageDirectory) throw new Error("Miniflare is unavailable for server-render tests.");
    return import(new URL(`${packageDirectory}/node_modules/miniflare/dist/src/index.js`, pnpmRoot).href);
  }
}

async function harness() {
  if (!workerHarness) {
    const { Miniflare } = await loadMiniflare();
    workerHarness = new Miniflare({
      modules: true,
      modulesRules: [{ type: "ESModule", include: ["**/*.js"], fallthrough: true }],
      scriptPath: "dist/server/index.js",
      compatibilityDate: "2026-05-15",
      compatibilityFlags: ["nodejs_compat"],
      bindings: { APP_ENV: "test", PRIVATE_MODE: "false", SESSION_SECRET: testSessionSecret, GOOGLE_CLIENT_ID: "test-client", GOOGLE_CLIENT_SECRET: "test-client-secret", PUBLIC_ORIGIN: "https://corkwill.com" },
      outboundService: async (request) => {
        const url = new URL(request.url);
        if (url.href === "https://www.googleapis.com/oauth2/v3/certs") return Response.json({ keys: [googleJwk] });
        if (url.href === "https://oauth2.googleapis.com/token") return Response.json({ id_token: mockedGoogleToken });
        throw new Error(`Unexpected outbound request: ${url.origin}${url.pathname}`);
      },
      d1Databases: { DB: "corkwill-log-test" },
      assets: {
        directory: "dist/client",
        binding: "ASSETS",
        routerConfig: { has_user_worker: true, invoke_user_worker_ahead_of_assets: true },
      },
    });
  }
  return workerHarness;
}

test.after(async () => {
  if (workerHarness) await workerHarness.dispose();
});

async function render(pathname = "/") {
  return (await harness()).dispatchFetch(`http://localhost${pathname}`, { headers: { accept: "text/html" } });
}

test("the CorkWill fallback links to the public app", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  assert.match(html, /<title>CorkWill Log/i);
  assert.match(html, /href="\/log"/i);
  assert.match(html, /href="\/log"/i);
  assert.match(html, /Open CorkWill Log/i);
  assert.match(html, /See how it works/i);
});

test("server-renders the bilingual introduction and sign-in route", async () => {
  const landingResponse = await render("/");
  assert.equal(landingResponse.status, 200);
  const landing = await landingResponse.text();
  assert.match(landing, /A clearer way to close the day/i);
  assert.match(landing, /Open CorkWill Log/i);
  assert.match(landing, /See how it works/i);
  assert.match(landing, /日本語/);

  const signInResponse = await render("/log/signin");
  assert.equal(signInResponse.status, 200);
  const signIn = await signInResponse.text();
  assert.match(signIn, /Sign in · CorkWill Log/i);
  assert.match(signIn, /Keep a clear record/i);
  assert.match(signIn, /Loading sign-in options/i);
});

test("server-renders CorkWill Log at /log without legacy visible branding", async () => {
  const response = await render("/log");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>CorkWill Log<\/title>/i);
  assert.match(html, /CorkWill/);
  assert.match(html, /Loading your records/);
  assert.doesNotMatch(html, /record-1|Demo workspace/);
  assert.doesNotMatch(html, /ZenLenz/i);
});

test("the validated build includes Log, onboarding, and storage compatibility", async () => {
  await access(new URL("../dist/server/index.js", import.meta.url));
  const assetNames = await readdir(new URL("../dist/client/assets/", import.meta.url));
  const javascript = (await Promise.all(assetNames.filter((name) => name.endsWith(".js")).map((name) => readFile(new URL(`../dist/client/assets/${name}`, import.meta.url), "utf8")))).join("\n");
  const [source, guideSource, signInSource, localeHookSource, localeSource, scoringSource, offlineSource, serverSource, requestCodeSource, exportSource] = await Promise.all([
    readFile(new URL("../app/log/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/log/BeginnerGuide.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/log/signin/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/use-persisted-locale.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/locales.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/scoring.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/offline.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/server.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/request-code/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/export/route.ts", import.meta.url), "utf8"),
  ]);

  assert.ok(javascript.length > 0);
  assert.match(localeSource, /CorkWill Log/);
  assert.match(localeSource, /Finish today/);
  assert.match(localeSource, /A clearer way to close the day/);
  assert.match(localeSource, /一日の終わりを、もっと明確に/);
  assert.match(scoringSource, /Sleep enough to feel steady/);
  assert.match(source, /History/);
  assert.match(source, /Settings/);
  assert.match(offlineSource, /corkwill-log-local/);
  assert.match(localeHookSource, /zenlenz-log-locale/);
  assert.match(guideSource, /corkwill-log-tutorial-v1/);
  assert.match(source, /tutorialOpen/);
  assert.match(signInSource, /locale/);
  assert.match(requestCodeSource, /body\.locale/);
  assert.match(serverSource, /CorkWill Log サインインコード/);
  assert.match(serverSource, /zl_session/);
  assert.match(serverSource, /CorkWill Log sign-in code/);
  assert.match(serverSource, /x-corkwill-user-id/);
  assert.match(source, /effectiveDate/);
  assert.match(source, /syncPendingMutations/);
  assert.doesNotMatch(source, /const TODAY = "2026-08-02"/);
  assert.match(exportSource, /corkwill-log-export\.csv/);
  assert.match(exportSource, /corkwill-log-export\.json/);
  assert.doesNotMatch(`${source}\n${localeSource}\n${serverSource}\n${exportSource}`, /ZenLenz/);
  assert.doesNotMatch(source, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("email sign-in rejects invalid input and fails closed without production secrets", async () => {
  const invalid = await (await harness()).dispatchFetch("http://localhost/api/auth/request-code", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "not-an-email", locale: "ja" }),
  });
  assert.equal(invalid.status, 400);

  const unconfigured = await (await harness()).dispatchFetch("http://localhost/api/auth/request-code", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "person@example.com", locale: "ja" }),
  });
  assert.equal(unconfigured.status, 503);
});

async function googleLogin(subject, email, overrides = {}) {
  const mf = await harness();
  const start = await mf.dispatchFetch("https://corkwill.com/api/auth/google?locale=ja&timezone=Asia%2FTokyo", { redirect: "manual" });
  assert.equal(start.status, 303);
  const location = new URL(start.headers.get("location"));
  assert.equal(location.origin, "https://accounts.google.com");
  assert.equal(location.searchParams.get("code_challenge_method"), "S256");
  assert.equal(location.searchParams.get("redirect_uri"), "https://corkwill.com/api/auth/google/callback");
  const cookie = start.headers.get("set-cookie").split(";")[0];
  const flowToken = cookie.slice(cookie.indexOf("=") + 1);
  const { payload: flow } = await jwtVerify(flowToken, new TextEncoder().encode(testSessionSecret));
  mockedGoogleToken = await new SignJWT({ email, email_verified: true, nonce: flow.nonce, ...overrides })
    .setProtectedHeader({ alg: "RS256", kid: "test-google-key" }).setSubject(subject).setIssuer("https://accounts.google.com").setAudience("test-client").setIssuedAt().setExpirationTime("5m").sign(googleSigningKeys.privateKey);
  return mf.dispatchFetch(`https://corkwill.com/api/auth/google/callback?code=mock-code&state=${flow.state}`, { headers: { Cookie: cookie }, redirect: "manual" });
}

function sessionFrom(response) {
  const cookies = response.headers.getSetCookie();
  const cookie = cookies.find((value) => value.startsWith("zl_session="));
  assert.ok(cookie);
  assert.match(cookie, /HttpOnly; Secure; SameSite=Lax/);
  return cookie.split(";")[0];
}

test("Google callback rejects missing state, tampered cookies, and unverified email", async () => {
  await initializeDatabase();
  const mf = await harness();
  for (const cookie of ["", "cw_google_flow=tampered", "cw_google_flow=%XX"]) {
    const response = await mf.dispatchFetch("https://corkwill.com/api/auth/google/callback?code=bad&state=bad", { redirect: "manual", headers: { Cookie: cookie } });
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("location"), "/log/signin?error=google");
    assert.ok(!response.headers.getSetCookie().some((value) => value.startsWith("zl_session=")));
  }
  const unverified = await googleLogin("unverified-user", "unverified@gmail.com", { email_verified: false });
  assert.equal(unverified.headers.get("location"), "/log/signin?error=google");
});

test("Google accounts persist in D1 and records remain isolated between accounts", async () => {
  const db = await initializeDatabase();
  const mf = await harness();
  const alice = sessionFrom(await googleLogin("alice-google", "alice@gmail.com"));
  const bob = sessionFrom(await googleLogin("bob-google", "bob@gmail.com"));
  const request = (path, cookie, init = {}) => mf.dispatchFetch(`https://corkwill.com${path}`, { ...init, headers: { Cookie: cookie, "Content-Type": "application/json", ...(init.headers ?? {}) } });
  const aliceUser = await (await request("/api/me", alice)).json();
  assert.equal(aliceUser.user.locale, "ja");
  assert.equal(aliceUser.user.timezone, "Asia/Tokyo");
  const saved = await request("/api/today", alice, { method: "PATCH", body: JSON.stringify({ date: "2026-09-13", answers: { sleep: "sleep-mid" }, status: "draft" }) });
  assert.equal(saved.status, 200);
  const aliceRecords = await (await request("/api/history", alice)).json();
  const bobRecords = await (await request("/api/history", bob)).json();
  assert.equal(aliceRecords.records.length, 1);
  assert.equal(bobRecords.records.length, 0);
  const secondAlice = sessionFrom(await googleLogin("alice-google", "alice@gmail.com"));
  assert.equal((await (await request("/api/me", secondAlice)).json()).user.id, aliceUser.user.id);
  assert.equal((await (await request("/api/history", secondAlice)).json()).records.length, 1);
  const exported = await request("/api/export?format=json", alice);
  assert.equal(exported.status, 200);
  assert.match(await exported.text(), /sleep-mid/);
  const spoofed = await mf.dispatchFetch("https://corkwill.com/api/me", { headers: { "x-corkwill-user-id": aliceUser.user.id, "x-corkwill-user-email": "alice@gmail.com" } });
  assert.equal(spoofed.status, 401);
  const csrf = await request("/api/account", alice, { method: "DELETE", headers: { Origin: "https://attacker.example" } });
  assert.equal(csrf.status, 403);
  assert.equal((await request("/api/account", bob, { method: "DELETE" })).status, 200);
  assert.equal((await request("/api/me", bob)).status, 401);
  assert.equal((await db.prepare("SELECT count(*) AS count FROM auth_identities WHERE subject = 'bob-google'").first()).count, 0);
  assert.equal((await request("/api/auth/logout", alice, { method: "POST" })).status, 200);
  assert.equal((await request("/api/me", alice)).status, 401);
  assert.equal((await request("/api/me", secondAlice)).status, 200);
});
