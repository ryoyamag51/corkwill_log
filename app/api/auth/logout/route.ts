import { database, expiredSessionCookie, hashValue, readCookie, sessionSecret } from "../../../lib/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const token = readCookie(request, "zl_session");
  if (token) {
    try {
      await database().prepare("DELETE FROM sessions WHERE id = ?").bind(await hashValue(token, sessionSecret())).run();
    } catch {
      // The cookie is still cleared when the database is unavailable.
    }
  }
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json", "Set-Cookie": expiredSessionCookie(), "Cache-Control": "no-store" },
  });
}
