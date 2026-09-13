import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
};

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    locale: text("locale", { enum: ["en", "ja"] }).notNull().default("en"),
    timezone: text("timezone").notNull().default("UTC"),
    cutoffHour: integer("cutoff_hour").notNull().default(5),
    ...timestamps,
  },
  (table) => [uniqueIndex("idx_users_email").on(table.email)],
);

export const verificationCodes = sqliteTable(
  "verification_codes",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    codeHash: text("code_hash").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    consumedAt: integer("consumed_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("idx_verification_codes_email_created").on(table.email, table.createdAt)],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    ...timestamps,
  },
  (table) => [index("idx_sessions_user_id").on(table.userId)],
);

export const rubricVersions = sqliteTable(
  "rubric_versions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    minimumScore: integer("minimum_score").notNull(),
    configJson: text("config_json").notNull(),
    effectiveFrom: text("effective_from").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("idx_rubric_versions_user_version").on(table.userId, table.versionNumber),
    index("idx_rubric_versions_user_effective").on(table.userId, table.effectiveFrom),
  ],
);

export const dailyRecords = sqliteTable(
  "daily_records",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    recordDate: text("record_date").notNull(),
    status: text("status", { enum: ["draft", "completed", "missed"] }).notNull(),
    score: integer("score").notNull(),
    answersJson: text("answers_json").notNull(),
    rubricVersionId: text("rubric_version_id").notNull(),
    evaluationSnapshotJson: text("evaluation_snapshot_json").notNull(),
    note: text("note"),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("idx_daily_records_user_date").on(table.userId, table.recordDate),
    index("idx_daily_records_user_date_desc").on(table.userId, table.recordDate),
  ],
);

export const syncMutations = sqliteTable(
  "sync_mutations",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    recordId: text("record_id").notNull(),
    payloadJson: text("payload_json").notNull(),
    appliedAt: integer("applied_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("idx_sync_mutations_user_id").on(table.userId, table.id),
    index("idx_sync_mutations_record").on(table.userId, table.recordId),
  ],
);

export const authIdentities = sqliteTable("auth_identities", {
  provider: text("provider").notNull(),
  subject: text("subject").notNull(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
}, (table) => [uniqueIndex("idx_auth_identity_subject").on(table.provider, table.subject), index("idx_auth_identities_user").on(table.userId)]);

export const schema = {
  authIdentities,
  users,
  verificationCodes,
  sessions,
  rubricVersions,
  dailyRecords,
  syncMutations,
};
