import { database, hashValue, json, normalizedEmail, randomCode, runtimeEnv, sendVerificationEmail, validEmail, verificationSecret } from "../../../lib/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  let body: { email?: unknown; locale?: unknown };
  try {
    body = await request.json() as { email?: unknown; locale?: unknown };
  } catch {
    return json({ error: "Invalid request." }, { status: 400 });
  }
  const email = normalizedEmail(body.email);
  if (!validEmail(email)) return json({ error: "Enter a valid email address." }, { status: 400 });
  const locale = body.locale === "ja" ? "ja" : "en";
  const runtime = runtimeEnv();
  if (!runtime.RESEND_API_KEY || !runtime.RESEND_FROM || !runtime.SESSION_SECRET || !runtime.VERIFICATION_SECRET) {
    return json({ error: "Email sign-in is temporarily unavailable." }, { status: 503 });
  }
  const db = database();
  const now = Date.now();
  const recent = await db.prepare("SELECT COUNT(*) AS count FROM verification_codes WHERE email = ? AND created_at > ?")
    .bind(email, now - 60_000).first<{ count: number }>();
  if ((recent?.count ?? 0) >= 3) return json({ error: "Too many requests. Try again in a minute." }, { status: 429 });

  const code = randomCode();
  const codeHash = await hashValue(code, verificationSecret());
  await db.prepare("UPDATE verification_codes SET consumed_at = ? WHERE email = ? AND consumed_at IS NULL").bind(now, email).run();
  await db.prepare("INSERT INTO verification_codes (id, email, code_hash, expires_at, attempts, created_at) VALUES (?, ?, ?, ?, 0, ?)")
    .bind(crypto.randomUUID(), email, codeHash, now + 10 * 60_000, now).run();
  try {
    await sendVerificationEmail(email, code, locale);
  } catch {
    await db.prepare("UPDATE verification_codes SET consumed_at = ? WHERE email = ? AND consumed_at IS NULL").bind(Date.now(), email).run();
    return json({ error: "Email sign-in is temporarily unavailable." }, { status: 503 });
  }
  return json({ ok: true, expiresInSeconds: 600 });
}
