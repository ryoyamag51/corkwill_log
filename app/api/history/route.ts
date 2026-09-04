import { authenticatedUser, database, json, parseJson } from "../../lib/server";
import type { DailyRecord } from "../../lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const user = await authenticatedUser(request);
  if (!user) return json({ error: "Authentication required." }, { status: 401 });
  const days = Math.min(365, Math.max(7, Number(new URL(request.url).searchParams.get("days") ?? 90)));
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const rows = await database().prepare("SELECT id, record_date, status, score, answers_json, rubric_version_id, evaluation_snapshot_json, note, updated_at FROM daily_records WHERE user_id = ? AND record_date >= ? ORDER BY record_date DESC")
    .bind(user.id, since).all<{
      id: string;
      record_date: string;
      status: "draft" | "completed" | "missed";
      score: number;
      answers_json: string;
      rubric_version_id: string;
      evaluation_snapshot_json: string;
      note: string | null;
      updated_at: number;
    }>();
  const records: DailyRecord[] = rows.results.map((row) => {
    const snapshot = parseJson<{ label?: string }>(row.evaluation_snapshot_json, {});
    return {
      id: row.id,
      date: row.record_date,
      status: row.status,
      score: row.score,
      answers: parseJson(row.answers_json, {}),
      rubricVersion: Number(row.rubric_version_id.split("-").at(-1)) || 1,
      evaluationLabel: snapshot.label ?? "",
      note: row.note ?? undefined,
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  });
  return json({ records });
}
