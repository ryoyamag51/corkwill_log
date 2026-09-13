import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";
import { createStarterRubric } from "./scoring";
import { database, hashValue, randomToken, readCookie, runtimeEnv, sessionCookie, sessionSecret } from "./server";

const googleKeys = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const flowCookieName = "cw_google_flow";
const flowCookie = (value: string, age = 600) => `${flowCookieName}=${value}; Max-Age=${age}; Path=/api/auth/google; HttpOnly; Secure; SameSite=Lax`;
const key = () => new TextEncoder().encode(sessionSecret());
const origin = () => runtimeEnv().PUBLIC_ORIGIN ?? "https://corkwill.com";
const callbackUrl = () => `${origin()}/api/auth/google/callback`;

export function googleConfigured(): boolean {
  const env = runtimeEnv();
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.SESSION_SECRET);
}

export async function startGoogle(request: Request): Promise<Response> {
  if (!googleConfigured()) return Response.redirect(`${origin()}/log/signin?error=unavailable`, 303);
  const state = randomToken();
  const nonce = randomToken();
  const verifier = randomToken();
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = btoa(String.fromCharCode(...new Uint8Array(digest))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  const input = new URL(request.url).searchParams;
  const locale = input.get("locale") === "ja" ? "ja" : "en";
  let timezone = input.get("timezone") ?? "UTC";
  try { new Intl.DateTimeFormat("en", { timeZone: timezone }).format(); } catch { timezone = "UTC"; }
  const flow = await new SignJWT({ state, nonce, verifier, locale, timezone }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("10m").setAudience("corkwill-google-login").sign(key());
  const authorization = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorization.search = new URLSearchParams({
    client_id: runtimeEnv().GOOGLE_CLIENT_ID!, redirect_uri: callbackUrl(), response_type: "code",
    scope: "openid email profile", state, nonce, code_challenge: challenge, code_challenge_method: "S256", prompt: "select_account",
  }).toString();
  return new Response(null, { status: 303, headers: { Location: authorization.href, "Set-Cookie": flowCookie(flow), "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}

export async function finishGoogle(request: Request): Promise<Response> {
  const headers = new Headers({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
  headers.append("Set-Cookie", flowCookie("", 0));
  try {
    if (!googleConfigured()) throw new Error("unavailable");
    const query = new URL(request.url).searchParams;
    const cookie = readCookie(request, flowCookieName);
    if (!cookie || !query.get("code") || query.has("error")) throw new Error("cancelled");
    const { payload: flow } = await jwtVerify(cookie, key(), { algorithms: ["HS256"], audience: "corkwill-google-login" });
    if (!query.get("state") || query.get("state") !== flow.state || typeof flow.verifier !== "string") throw new Error("invalid-state");
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code: query.get("code")!, client_id: runtimeEnv().GOOGLE_CLIENT_ID!, client_secret: runtimeEnv().GOOGLE_CLIENT_SECRET!, redirect_uri: callbackUrl(), grant_type: "authorization_code", code_verifier: flow.verifier }),
    });
    if (!response.ok) throw new Error("token-exchange");
    const token = await response.json() as { id_token?: string };
    if (!token.id_token) throw new Error("missing-identity");
    const { payload } = await jwtVerify(token.id_token, googleKeys, { issuer: ["https://accounts.google.com", "accounts.google.com"], audience: runtimeEnv().GOOGLE_CLIENT_ID, algorithms: ["RS256"] });
    if (payload.nonce !== flow.nonce || !payload.sub || payload.email_verified !== true || typeof payload.email !== "string") throw new Error("invalid-identity");
    const email = payload.email.toLowerCase();
    // Only auto-link existing accounts when Google is authoritative for this email address.
    const authoritative = /@(gmail|googlemail)\.com$/.test(email) || typeof payload.hd === "string";
    const db = database();
    const identity = await db.prepare("SELECT user_id FROM auth_identities WHERE provider = 'google' AND subject = ?").bind(payload.sub).first<{ user_id: string }>();
    const existing = await db.prepare("SELECT id FROM users WHERE email = ?").bind(email).first<{ id: string }>();
    if (!identity && existing && !authoritative) throw new Error("email-link-requires-verification");
    const userId = identity?.user_id ?? existing?.id ?? crypto.randomUUID();
    const now = Date.now();
    const starter = createStarterRubric();
    const statements = [];
    if (!identity) {
      statements.push(db.prepare("INSERT OR IGNORE INTO users (id, email, locale, timezone, cutoff_hour, created_at, updated_at) VALUES (?, ?, ?, ?, 5, ?, ?)").bind(userId, email, flow.locale === "ja" ? "ja" : "en", typeof flow.timezone === "string" ? flow.timezone : "UTC", now, now));
      statements.push(db.prepare("INSERT OR IGNORE INTO auth_identities (provider, subject, user_id) VALUES ('google', ?, ?)").bind(payload.sub, userId));
    }
    statements.push(db.prepare("INSERT OR IGNORE INTO rubric_versions (id, user_id, version_number, minimum_score, config_json, effective_from, created_at) VALUES (?, ?, 1, ?, ?, '1970-01-01', ?)").bind(`${userId}-rubric-1`, userId, starter.minimumScore, JSON.stringify(starter), now));
    const session = randomToken();
    statements.push(db.prepare("INSERT INTO sessions (id, user_id, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").bind(await hashValue(session, sessionSecret()), userId, now + 30 * 86400_000, now, now));
    await db.batch(statements);
    headers.append("Set-Cookie", sessionCookie(session));
    headers.set("Location", "/log");
  } catch {
    headers.set("Location", "/log/signin?error=google");
  }
  return new Response(null, { status: 303, headers });
}
