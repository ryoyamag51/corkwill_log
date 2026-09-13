import { googleConfigured } from "../../../lib/google-auth";
import { json, runtimeEnv } from "../../../lib/server";
export const dynamic = "force-dynamic";
export function GET(): Response {
  const env = runtimeEnv();
  return json({ google: googleConfigured(), email: Boolean(env.RESEND_API_KEY && env.RESEND_FROM && env.SESSION_SECRET && env.VERIFICATION_SECRET) });
}
