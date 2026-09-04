import { authenticatedUser, json, latestRubric, recordForDate, saveRecord } from "../../lib/server";
import type { Answers } from "../../lib/types";

export const dynamic = "force-dynamic";

type Mutation = {
  id: string;
  type: "save-draft" | "complete-record";
  payload: { date?: unknown; answers?: unknown; note?: unknown; baseUpdatedAt?: unknown };
};

export async function POST(request: Request): Promise<Response> {
  const user = await authenticatedUser(request);
  if (!user) return json({ error: "Authentication required." }, { status: 401 });
  let body: { mutations?: unknown };
  try {
    body = await request.json() as { mutations?: unknown };
  } catch {
    return json({ error: "Invalid request." }, { status: 400 });
  }
  const mutations = Array.isArray(body.mutations) ? body.mutations as Mutation[] : [];
  const applied = [];
  const conflicts = [];
  for (const mutation of mutations.slice(0, 50)) {
    if (!mutation?.id || !mutation.payload) continue;
    const date = typeof mutation.payload.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(mutation.payload.date) ? mutation.payload.date : "";
    if (!date) continue;
    const current = await recordForDate(user.id, date);
    const baseUpdatedAt = typeof mutation.payload.baseUpdatedAt === "string" ? Date.parse(mutation.payload.baseUpdatedAt) : 0;
    if (current && baseUpdatedAt && Date.parse(current.updatedAt) > baseUpdatedAt) {
      conflicts.push({ mutationId: mutation.id, date, server: current, reason: "same-field-update" });
      continue;
    }
    const currentRubric = await latestRubric(user.id, date);
    if (!currentRubric) continue;
    try {
      const result = await saveRecord({
        userId: user.id,
        date,
        answers: mutation.payload.answers && typeof mutation.payload.answers === "object" ? mutation.payload.answers as Answers : {},
        note: typeof mutation.payload.note === "string" ? mutation.payload.note : undefined,
        status: mutation.type === "complete-record" ? "completed" : "draft",
        rubricVersionId: currentRubric.id,
        rubric: currentRubric.rubric,
        mutationId: mutation.id,
      });
      applied.push({ mutationId: mutation.id, record: result.record });
    } catch (error) {
      conflicts.push({ mutationId: mutation.id, date, reason: error instanceof Error ? error.message : "Unable to apply mutation." });
    }
  }
  return json({ applied, conflicts });
}
