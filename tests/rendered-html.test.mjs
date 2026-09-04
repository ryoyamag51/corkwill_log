import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

let workerHarness;

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

test("the CorkWill fallback introduces email sign-in and the demo", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  assert.match(html, /<title>CorkWill Log/i);
  assert.match(html, /href="\/log\/signin"/i);
  assert.match(html, /href="\/log"/i);
  assert.match(html, /Start with email/i);
  assert.match(html, /Try the demo/i);
});

test("server-renders the bilingual introduction and sign-in route", async () => {
  const landingResponse = await render("/");
  assert.equal(landingResponse.status, 200);
  const landing = await landingResponse.text();
  assert.match(landing, /A clearer way to close the day/i);
  assert.match(landing, /Start with email/i);
  assert.match(landing, /Try the demo/i);
  assert.match(landing, /日本語/);

  const signInResponse = await render("/log/signin");
  assert.equal(signInResponse.status, 200);
  const signIn = await signInResponse.text();
  assert.match(signIn, /Sign in · CorkWill Log/i);
  assert.match(signIn, /Keep a clear record/i);
  assert.match(signIn, /Send code/i);
});

test("server-renders CorkWill Log at /log without legacy visible branding", async () => {
  const response = await render("/log");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>CorkWill Log<\/title>/i);
  assert.match(html, /CorkWill/);
  assert.match(html, /Today/);
  assert.match(html, /History/);
  assert.match(html, /Settings/);
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
  assert.match(offlineSource, /zenlenz-log-local/);
  assert.match(localeHookSource, /zenlenz-log-locale/);
  assert.match(guideSource, /corkwill-log-tutorial-v1/);
  assert.match(source, /tutorialOpen/);
  assert.match(signInSource, /locale/);
  assert.match(requestCodeSource, /body\.locale/);
  assert.match(serverSource, /CorkWill Log サインインコード/);
  assert.match(serverSource, /zl_session/);
  assert.match(serverSource, /CorkWill Log sign-in code/);
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
