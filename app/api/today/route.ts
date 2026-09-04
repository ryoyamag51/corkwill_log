import { authenticatedUser, json, latestRubric, recordForDate, saveRecord } from "../../lib/server";
import type { Answers } from "../../lib/types";

export const dynamic = "force-dynamic";

function todayValue(request: Request): string {
  const value = new URL(request.url).searchParams.get("date");
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : new Date().toISOString().slice(0, 10);
}

export async function GET(request: Request): Promise<Response> {
  const user = await authenticatedUser(request);
  if (!user) return json({ error: "Authentication required." }, { status: 401 });
  const date = todayValue(request);
  const current = await latestRubric(user.id, date);
  if (!current) return json({ error: "No rubric found." }, { status: 404 });
  const record = await recordForDate(user.id, date);
  return json({ date, rubric: current.rubric, rubricVersionId: current.id, record });
}

export async function PATCH(request: Request): Promise<Response> {
  const user = await authenticatedUser(request);
  if (!user) return json({ error: "Authentication required." }, { status: 401 });
  let body: { date?: unknown; answers?: unknown; note?: unknown; status?: unknown };
  try {
    body = await request.json() as { date?: unknown; answers?: unknown; note?: unknown; status?: unknown };
  } catch {
    return json({ error: "Invalid request." }, { status: 400 });
  }
  const date = typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : new Date().toISOString().slice(0, 10);
  const answers = body.answers && typeof body.answers === "object" ? body.answers as Answers : {};
  const status = body.status === "completed" ? "completed" : "draft";
  const current = await latestRubric(user.id, date);
  if (!current) return json({ error: "No rubric found." }, { status: 404 });
  try {
    const result = await saveRecord({
      userId: user.id,
      date,
      answers,
      note: typeof body.note === "string" ? body.note : undefined,
      status,
      rubricVersionId: current.id,
      rubric: current.rubric,
      mutationId: request.headers.get("X-Mutation-Id") ?? undefined,
    });
    return json({ ...result });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unable to save record." }, { status: 422 });
  }
}
