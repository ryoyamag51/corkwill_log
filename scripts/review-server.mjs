import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createStarterRubric, evaluationForScore, scoreAnswers } from "../app/lib/scoring.ts";
import { effectiveDate } from "../app/lib/timezone.ts";

// Uses the same pinned local Worker runtime as Wrangler. No Cloudflare login,
// remote database, email service, paid developer account, or deployment is used.
const require = createRequire(import.meta.url);
const { Miniflare } = createRequire(require.resolve("wrangler/package.json"))("miniflare");
const origin = "http://localhost:4173";
const apiKey = process.env.REVENUECAT_TEST_API_KEY ?? "";
if (apiKey && !/^test_[A-Za-z0-9]+$/.test(apiKey)) throw new Error("Review builds only accept a Test Store key beginning with test_.");
const secret = randomBytes(32).toString("hex");
const token = randomBytes(32).toString("hex");
const userId = `shipaton-local-${randomBytes(16).toString("hex")}`;
const mf = new Miniflare({
  host: "127.0.0.1",
  modules: true,
  modulesRules: [{ type: "ESModule", include: ["**/*.js"], fallthrough: true }],
  scriptPath: "dist/server/index.js",
  compatibilityDate: "2026-05-15",
  compatibilityFlags: ["nodejs_compat"],
  bindings: {
    APP_ENV: "review", PRIVATE_MODE: "false", PUBLIC_ORIGIN: origin,
    SESSION_SECRET: secret, REVENUECAT_TEST_API_KEY: apiKey,
  },
  d1Databases: { DB: "corkwill-shipaton-local-only" },
  assets: {
    directory: "dist/client", binding: "ASSETS",
    routerConfig: { has_user_worker: true, invoke_user_worker_ahead_of_assets: false },
  },
});
const db = await mf.getD1Database("DB");
for (const filename of ["0000_funny_imperial_guard.sql", "0001_complete_jubilee.sql"]) {
  const sql = await readFile(new URL(`../drizzle/${filename}`, import.meta.url), "utf8");
  for (const statement of sql.replaceAll("--> statement-breakpoint", "").split(";").filter((s) => s.trim())) await db.prepare(statement).run();
}
const now = Date.now();
const rubric = createStarterRubric();
const rubricId = `${userId}-rubric-1`;
const today = effectiveDate("America/Los_Angeles", 5, new Date(now));
await db.batch([
  db.prepare("INSERT INTO users (id,email,locale,timezone,cutoff_hour,created_at,updated_at) VALUES (?,?,'en','America/Los_Angeles',5,?,?)").bind(userId, "reviewer@example.test", now, now),
  db.prepare("INSERT INTO rubric_versions (id,user_id,version_number,minimum_score,config_json,effective_from,created_at) VALUES (?,?,1,?,?,?,?)").bind(rubricId, userId, rubric.minimumScore, JSON.stringify(rubric), "2026-01-01", now),
  db.prepare("INSERT INTO sessions (id,user_id,expires_at,created_at,updated_at) VALUES (?,?,?,?,?)").bind(createHash("sha256").update(`${secret}:${token}`).digest("hex"), userId, now + 86400000, now, now),
]);
// Fictional answers, created only in this disposable local database.
const patterns = [[2,1,2,1,2], [1,1,2,0,1], [2,2,1,2,1], [1,2,1,1,2], [2,2,2,1,2], [1,1,1,2,1], [2,2,2,2,2]];
const criteria = rubric.sections.flatMap((section) => section.criteria);
for (let index = 0; index < patterns.length; index++) {
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - patterns.length + index);
  const day = date.toISOString().slice(0, 10);
  const answers = Object.fromEntries(criteria.map((criterion, i) => [criterion.id, criterion.outcomes[patterns[index][i]].id]));
  const score = scoreAnswers(rubric, answers);
  const evaluation = evaluationForScore(rubric, score);
  await db.prepare("INSERT INTO daily_records (id,user_id,record_date,status,score,answers_json,rubric_version_id,evaluation_snapshot_json,completed_at,created_at,updated_at) VALUES (?,?,?,'completed',?,?,?,?,?,?,?)")
    .bind(`${userId}-${day}`, userId, day, score, JSON.stringify(answers), rubricId, JSON.stringify(evaluation), date.getTime(), date.getTime(), date.getTime()).run();
}

const server = createServer(async (request, response) => {
  try {
    if (!["localhost:4173", "127.0.0.1:4173"].includes(request.headers.host ?? "")) {
      response.writeHead(403); response.end("Local review only."); return;
    }
    const requestOrigin = `http://${request.headers.host}`;
    const url = new URL(request.url ?? "/", requestOrigin);
    if (url.origin !== requestOrigin || request.headers["sec-fetch-site"] === "cross-site") {
      response.writeHead(403); response.end("Cross-origin request rejected."); return;
    }
    if (["/", "/__review/start"].includes(url.pathname) && request.method === "GET") {
      // Only this loopback harness issues a local session. There is no review
      // login route or authentication bypass in the deployable Worker.
      response.writeHead(302, { Location: "/log", "Cache-Control": "no-store", "Set-Cookie": `zl_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400` });
      response.end(); return;
    }
    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
      size += chunk.length;
      if (size > 262144) { response.writeHead(413); response.end("Request too large."); return; }
      chunks.push(chunk);
    }
    const result = await mf.dispatchFetch(url.href, {
      method: request.method, headers: request.headers,
      ...(chunks.length ? { body: Buffer.concat(chunks) } : {}),
    });
    response.writeHead(result.status, Object.fromEntries(result.headers));
    if (result.body) await pipeline(Readable.fromWeb(result.body), response);
    else response.end();
  } catch (error) {
    console.error("Local review request failed:", error instanceof Error ? error.message : "unknown error");
    if (!response.headersSent) response.writeHead(500);
    response.end("Local review request failed.");
  }
});
server.listen(4173, "127.0.0.1", () => {
  console.log(`CorkWill Log review: ${origin}/__review/start`);
  console.log("Fictional data in local memory. No production data or paid services are used.");
  console.log(apiKey ? "RevenueCat Test Store enabled for the native iOS build." : "Set REVENUECAT_TEST_API_KEY in .env.review to enable test purchases.");
});
async function stop() { server.close(); await mf.dispose(); process.exit(0); }
process.once("SIGINT", () => void stop());
process.once("SIGTERM", () => void stop());
