import { authenticatedUser, database, json, parseJson } from "../../lib/server";

export const dynamic = "force-dynamic";

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export async function GET(request: Request): Promise<Response> {
  const user = await authenticatedUser(request);
  if (!user) return json({ error: "Authentication required." }, { status: 401 });
  const format = new URL(request.url).searchParams.get("format") === "csv" ? "csv" : "json";
  const db = database();
  const rubrics = await db.prepare("SELECT id, version_number, minimum_score, config_json, effective_from, created_at FROM rubric_versions WHERE user_id = ? ORDER BY version_number")
    .bind(user.id).all();
  const records = await db.prepare("SELECT id, record_date, status, score, answers_json, rubric_version_id, evaluation_snapshot_json, note, created_at, updated_at FROM daily_records WHERE user_id = ? ORDER BY record_date DESC")
    .bind(user.id).all();
  if (format === "csv") {
    const lines = ["date,status,score,rubric_version,evaluation,note,answers"];
    for (const row of records.results as Array<Record<string, unknown>>) {
      const snapshot = parseJson<{ label?: string }>(String(row.evaluation_snapshot_json ?? ""), {});
      lines.push([
        row.record_date,
        row.status,
        row.score,
        row.rubric_version_id,
        snapshot.label ?? "",
        row.note ?? "",
        row.answers_json ?? "{}",
      ].map(csvCell).join(","));
    }
    return new Response(`\uFEFF${lines.join("\n")}\n`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=corkwill-log-export.csv",
        "Cache-Control": "no-store",
      },
    });
  }
  return new Response(JSON.stringify({ exportedAt: new Date().toISOString(), user: { email: user.email, locale: user.locale, timezone: user.timezone, cutoffHour: user.cutoffHour }, rubricVersions: rubrics.results, dailyRecords: records.results }, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": "attachment; filename=corkwill-log-export.json",
      "Cache-Control": "no-store",
    },
  });
}
