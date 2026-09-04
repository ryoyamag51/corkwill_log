import { env } from "cloudflare:workers";

import { evaluationForScore, isComplete, scoreAnswers } from "./scoring";
import type { Answers, DailyRecord, Rubric, UserProfile } from "./types";

export type RuntimeEnv = {
  DB?: D1Database;
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
  SESSION_SECRET?: string;
  VERIFICATION_SECRET?: string;
  APP_ENV?: string;
};

export type AuthenticatedUser = UserProfile & { id: string };

export function runtimeEnv(): RuntimeEnv {
  return env as unknown as RuntimeEnv;
}

export function database(): D1Database {
  const db = runtimeEnv().DB;
  if (!db) throw new Error("D1 binding DB is not configured.");
  return db;
}

export function json(data: unknown, init: ResponseInit = {}): Response {
  return Response.json(data, {
    ...init,
    headers: { "Cache-Control": "no-store", ...(init.headers ?? {}) },
  });
}

export function normalizedEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function sessionSecret(): string {
  const value = runtimeEnv().SESSION_SECRET;
  if (!value) throw new Error("SESSION_SECRET is not configured.");
  return value;
}

export function verificationSecret(): string {
  const value = runtimeEnv().VERIFICATION_SECRET;
  if (!value) throw new Error("VERIFICATION_SECRET is not configured.");
  return value;
}

export async function hashValue(value: string, secret = ""): Promise<string> {
  const input = new TextEncoder().encode(`${secret}:${value}`);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function randomCode(): string {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return String(100000 + (values[0] % 900000));
}

export function randomToken(): string {
  const values = new Uint8Array(32);
  crypto.getRandomValues(values);
  return [...values].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function readCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

export function sessionCookie(token: string, maxAge = 60 * 60 * 24 * 30): string {
  return `zl_session=${encodeURIComponent(token)}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

export function expiredSessionCookie(): string {
  return "zl_session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax";
}

export async function authenticatedUser(request: Request): Promise<AuthenticatedUser | null> {
  const token = readCookie(request, "zl_session");
  if (!token) return null;
  let tokenHash: string;
  try {
    tokenHash = await hashValue(token, sessionSecret());
  } catch {
    return null;
  }
  let row: {
    id: string;
    email: string;
    locale: "en" | "ja";
    timezone: string;
    cutoff_hour: number;
  } | null;
  try {
    row = await database().prepare(
      "SELECT users.id, users.email, users.locale, users.timezone, users.cutoff_hour FROM sessions INNER JOIN users ON users.id = sessions.user_id WHERE sessions.id = ? AND sessions.expires_at > ?",
    ).bind(tokenHash, Date.now()).first<{
      id: string;
      email: string;
      locale: "en" | "ja";
      timezone: string;
      cutoff_hour: number;
    }>();
  } catch {
    return null;
  }
  if (!row) return null;
  return { id: row.id, email: row.email, locale: row.locale, timezone: row.timezone, cutoffHour: row.cutoff_hour };
}

export async function sendVerificationEmail(email: string, code: string, locale: "en" | "ja" = "en"): Promise<void> {
  const runtime = runtimeEnv();
  if (!runtime.RESEND_API_KEY || !runtime.RESEND_FROM) {
    throw new Error("RESEND_API_KEY and RESEND_FROM are required to send verification email.");
  }
  const japanese = locale === "ja";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${runtime.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: runtime.RESEND_FROM,
      to: [email],
      subject: japanese ? "CorkWill Log サインインコード" : "Your CorkWill Log sign-in code",
      text: japanese
        ? `CorkWill Logのサインインコードは ${code} です。有効期限は10分です。\n\nこのコードをリクエストしていない場合は、このメールを無視してください。`
        : `Your CorkWill Log sign-in code is ${code}. It expires in 10 minutes.\n\nIf you did not request this code, you can ignore this email.`,
    }),
  });
  if (!response.ok) throw new Error(`Resend returned ${response.status}.`);
}

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export async function latestRubric(userId: string, date = new Date().toISOString().slice(0, 10)): Promise<{ id: string; rubric: Rubric } | null> {
  const row = await database().prepare(
    "SELECT id, config_json FROM rubric_versions WHERE user_id = ? AND effective_from <= ? ORDER BY version_number DESC LIMIT 1",
  ).bind(userId, date).first<{ id: string; config_json: string }>();
  if (!row) return null;
  return { id: row.id, rubric: JSON.parse(row.config_json) as Rubric };
}

export async function recordForDate(userId: string, date: string): Promise<DailyRecord | null> {
  const row = await database().prepare(
    "SELECT id, record_date, status, score, answers_json, rubric_version_id, evaluation_snapshot_json, note, updated_at FROM daily_records WHERE user_id = ? AND record_date = ? LIMIT 1",
  ).bind(userId, date).first<{
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
  if (!row) return null;
  const snapshot = parseJson<{ label?: string }>(row.evaluation_snapshot_json, {});
  const rubricVersion = Number(row.rubric_version_id.split("-").at(-1)) || 1;
  return {
    id: row.id,
    date: row.record_date,
    status: row.status,
    score: row.score,
    answers: parseJson<Answers>(row.answers_json, {}),
    rubricVersion,
    evaluationLabel: snapshot.label ?? "",
    note: row.note ?? undefined,
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function saveRecord(input: {
  userId: string;
  date: string;
  answers: Answers;
  note?: string;
  status: "draft" | "completed";
  rubricVersionId: string;
  rubric: Rubric;
  mutationId?: string;
}): Promise<{ record: DailyRecord; duplicate: boolean }> {
  const db = database();
  if (input.mutationId) {
    const prior = await db.prepare("SELECT id FROM sync_mutations WHERE user_id = ? AND id = ? LIMIT 1")
      .bind(input.userId, input.mutationId).first<{ id: string }>();
    if (prior) {
      const existing = await recordForDate(input.userId, input.date);
      if (existing) return { record: existing, duplicate: true };
    }
  }
  if (input.status === "completed" && !isComplete(input.rubric, input.answers)) {
    throw new Error("All required criteria must be answered before finishing the day.");
  }
  const score = Math.max(input.rubric.minimumScore, Math.min(100, scoreAnswers(input.rubric, input.answers)));
  const evaluation = evaluationForScore(input.rubric, score);
  const now = Date.now();
  const recordId = `${input.userId}-${input.date}`;
  await db.batch([
    ...(input.mutationId ? [db.prepare("INSERT OR IGNORE INTO sync_mutations (id, user_id, record_id, payload_json, applied_at) VALUES (?, ?, ?, ?, ?)").bind(input.mutationId, input.userId, recordId, JSON.stringify(input.answers), now)] : []),
    db.prepare(
      "INSERT INTO daily_records (id, user_id, record_date, status, score, answers_json, rubric_version_id, evaluation_snapshot_json, note, completed_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, record_date) DO UPDATE SET status = excluded.status, score = excluded.score, answers_json = excluded.answers_json, rubric_version_id = excluded.rubric_version_id, evaluation_snapshot_json = excluded.evaluation_snapshot_json, note = excluded.note, completed_at = excluded.completed_at, updated_at = excluded.updated_at",
    ).bind(recordId, input.userId, input.date, input.status, score, JSON.stringify(input.answers), input.rubricVersionId, JSON.stringify({ label: evaluation.label, min: evaluation.min }), input.note ?? null, input.status === "completed" ? now : null, now, now),
  ]);
  return {
    duplicate: false,
    record: {
      id: recordId,
      date: input.date,
      status: input.status,
      score,
      answers: input.answers,
      rubricVersion: input.rubric.version,
      evaluationLabel: evaluation.label,
      note: input.note,
      updatedAt: new Date(now).toISOString(),
    },
  };
}
