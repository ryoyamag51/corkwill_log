import { validTimezone } from "../../lib/timezone";
import { authenticatedUser, database, json } from "../../lib/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const user = await authenticatedUser(request);
  if (!user) return json({ user: null }, { status: 401 });
  return json({ user });
}

export async function PATCH(request: Request): Promise<Response> {
  const user = await authenticatedUser(request);
  if (!user) return json({ error: "Authentication required." }, { status: 401 });
  let body: { locale?: unknown; timezone?: unknown; cutoffHour?: unknown };
  try {
    body = await request.json() as { locale?: unknown; timezone?: unknown; cutoffHour?: unknown };
  } catch {
    return json({ error: "Invalid request." }, { status: 400 });
  }
  if (body.timezone !== undefined && (typeof body.timezone !== "string" || !validTimezone(body.timezone))) return json({ error: "Invalid timezone." }, { status: 400 });
  const locale = body.locale === "ja" ? "ja" : body.locale === "en" ? "en" : user.locale;
  const timezone = typeof body.timezone === "string" && body.timezone.length <= 64 ? body.timezone : user.timezone;
  const cutoffHour = Number.isInteger(body.cutoffHour) && Number(body.cutoffHour) >= 0 && Number(body.cutoffHour) <= 23 ? Number(body.cutoffHour) : user.cutoffHour;
  await database().prepare("UPDATE users SET locale = ?, timezone = ?, cutoff_hour = ?, updated_at = ? WHERE id = ?")
    .bind(locale, timezone, cutoffHour, Date.now(), user.id).run();
  return json({ user: { ...user, locale, timezone, cutoffHour } });
}
