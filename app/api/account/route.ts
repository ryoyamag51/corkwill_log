import { authenticatedUser, database, expiredSessionCookie, json } from "../../lib/server";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request): Promise<Response> {
  const user = await authenticatedUser(request);
  if (!user) return json({ error: "Authentication required." }, { status: 401 });
  const db = database();
  await db.batch([
    db.prepare("DELETE FROM auth_identities WHERE user_id = ?").bind(user.id),
    db.prepare("DELETE FROM daily_records WHERE user_id = ?").bind(user.id),
    db.prepare("DELETE FROM rubric_versions WHERE user_id = ?").bind(user.id),
    db.prepare("DELETE FROM sync_mutations WHERE user_id = ?").bind(user.id),
    db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(user.id),
    db.prepare("DELETE FROM users WHERE id = ?").bind(user.id),
  ]);
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json", "Set-Cookie": expiredSessionCookie(), "Cache-Control": "no-store" },
  });
}
