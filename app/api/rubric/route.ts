import { cloneRubric, validateRubric } from "../../lib/scoring";
import { authenticatedUser, database, json, latestRubric } from "../../lib/server";
import type { Rubric } from "../../lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const user = await authenticatedUser(request);
  if (!user) return json({ error: "Authentication required." }, { status: 401 });
  const result = await latestRubric(user.id);
  if (!result) return json({ error: "No rubric found." }, { status: 404 });
  return json({ rubric: result.rubric, rubricVersionId: result.id });
}

export async function PUT(request: Request): Promise<Response> {
  const user = await authenticatedUser(request);
  if (!user) return json({ error: "Authentication required." }, { status: 401 });
  let body: { rubric?: unknown };
  try {
    body = await request.json() as { rubric?: unknown };
  } catch {
    return json({ error: "Invalid request." }, { status: 400 });
  }
  const incoming = body.rubric as Rubric;
  if (!incoming || typeof incoming !== "object") return json({ error: "Rubric is required." }, { status: 400 });
  const validation = validateRubric(incoming);
  if (!validation.valid) return json({ error: "Rubric validation failed.", issues: validation.issues }, { status: 422 });
  const current = await latestRubric(user.id);
  const version = (current?.rubric.version ?? 0) + 1;
  const next = { ...cloneRubric(incoming), id: `${user.id}-rubric-${version}`, version };
  const now = Date.now();
  const id = `${user.id}-rubric-${version}`;
  const appliesFrom = new Date(now).toISOString().slice(0, 10);
  await database().prepare("INSERT INTO rubric_versions (id, user_id, version_number, minimum_score, config_json, effective_from, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(id, user.id, version, next.minimumScore, JSON.stringify(next), appliesFrom, now).run();
  return json({ rubric: next, rubricVersionId: id, appliesFrom });
}
