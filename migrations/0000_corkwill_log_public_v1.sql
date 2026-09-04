CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'ja')),
  timezone TEXT NOT NULL DEFAULT 'UTC',
  cutoff_hour INTEGER NOT NULL DEFAULT 5 CHECK (cutoff_hour BETWEEN 0 AND 23),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS verification_codes (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  consumed_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_verification_codes_email_created
  ON verification_codes(email, created_at);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

CREATE TABLE IF NOT EXISTS rubric_versions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  minimum_score INTEGER NOT NULL,
  config_json TEXT NOT NULL,
  effective_from TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rubric_versions_user_version
  ON rubric_versions(user_id, version_number);
CREATE INDEX IF NOT EXISTS idx_rubric_versions_user_effective
  ON rubric_versions(user_id, effective_from);

CREATE TABLE IF NOT EXISTS daily_records (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  record_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'completed', 'missed')),
  score INTEGER NOT NULL,
  answers_json TEXT NOT NULL,
  rubric_version_id TEXT NOT NULL,
  evaluation_snapshot_json TEXT NOT NULL,
  note TEXT,
  completed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_records_user_date
  ON daily_records(user_id, record_date);
CREATE INDEX IF NOT EXISTS idx_daily_records_user_date_desc
  ON daily_records(user_id, record_date);

CREATE TABLE IF NOT EXISTS sync_mutations (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  record_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  applied_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_mutations_user_id ON sync_mutations(user_id, id);
CREATE INDEX IF NOT EXISTS idx_sync_mutations_record ON sync_mutations(user_id, record_id);
