import { createStarterRubric } from "../../../lib/scoring";
import { database, hashValue, json, normalizedEmail, randomToken, sessionCookie, sessionSecret, verificationSecret } from "../../../lib/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  let body: { email?: unknown; code?: unknown };
  try {
    body = await request.json() as { email?: unknown; code?: unknown };
  } catch {
    return json({ error: "Invalid request." }, { status: 400 });
  }
  const email = normalizedEmail(body.email);
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!/^\d{6}$/.test(code)) return json({ error: "Enter the six-digit code." }, { status: 400 });
  const db = database();
  const row = await db.prepare("SELECT id, code_hash, expires_at, attempts FROM verification_codes WHERE email = ? AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1")
    .bind(email).first<{ id: string; code_hash: string; expires_at: number; attempts: number }>();
  if (!row || row.expires_at <= Date.now() || row.attempts >= 5) return json({ error: "That code is invalid or expired." }, { status: 400 });
  await db.prepare("UPDATE verification_codes SET attempts = attempts + 1 WHERE id = ?").bind(row.id).run();
  let incomingHash: string;
  let cookieSecret: string;
  try {
    incomingHash = await hashValue(code, verificationSecret());
    cookieSecret = sessionSecret();
  } catch {
    return json({ error: "Email sign-in is temporarily unavailable." }, { status: 503 });
  }
  if (incomingHash !== row.code_hash) return json({ error: "That code is invalid or expired." }, { status: 400 });

  const now = Date.now();
  const userId = crypto.randomUUID();
  const starter = createStarterRubric();
  await db.batch([
    db.prepare("UPDATE verification_codes SET consumed_at = ? WHERE id = ?").bind(now, row.id),
    db.prepare("INSERT OR IGNORE INTO users (id, email, locale, timezone, cutoff_hour, created_at, updated_at) VALUES (?, ?, 'en', 'UTC', 5, ?, ?)").bind(userId, email, now, now),
  ]);
  const user = await db.prepare("SELECT id, locale, timezone, cutoff_hour FROM users WHERE email = ? LIMIT 1").bind(email)
    .first<{ id: string; locale: "en" | "ja"; timezone: string; cutoff_hour: number }>();
  if (!user) return json({ error: "Unable to create account." }, { status: 500 });
  const rubricId = `${user.id}-rubric-1`;
  await db.prepare("INSERT OR IGNORE INTO rubric_versions (id, user_id, version_number, minimum_score, config_json, effective_from, created_at) VALUES (?, ?, 1, ?, ?, ?, ?)")
    .bind(rubricId, user.id, starter.minimumScore, JSON.stringify(starter), new Date().toISOString().slice(0, 10), now).run();
  const token = randomToken();
  const tokenHash = await hashValue(token, cookieSecret);
  await db.prepare("INSERT INTO sessions (id, user_id, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
    .bind(tokenHash, user.id, now + 30 * 24 * 60 * 60_000, now, now).run();
  return new Response(JSON.stringify({ ok: true, user: { id: user.id, email, locale: user.locale, timezone: user.timezone, cutoffHour: user.cutoff_hour } }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "Set-Cookie": sessionCookie(token) },
  });
}
