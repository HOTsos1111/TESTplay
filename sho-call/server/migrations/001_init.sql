-- Sho Call initial schema. Timestamps are ISO-8601 UTC strings.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE auth_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE shows (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  event_date TEXT NOT NULL,
  timezone TEXT NOT NULL,
  planned_start TEXT NOT NULL,
  venue TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  is_template INTEGER NOT NULL DEFAULT 0,
  revision INTEGER NOT NULL DEFAULT 0,
  -- event sequence for real-time ordering/recovery (every mutation bumps it)
  seq INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE show_members (
  show_id TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner','director','operator','viewer')),
  operate_departments TEXT NOT NULL DEFAULT '[]',
  visible_departments TEXT, -- JSON array, NULL = all
  PRIMARY KEY (show_id, user_id)
);

CREATE TABLE departments (
  id TEXT PRIMARY KEY,
  show_id TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  sort INTEGER NOT NULL,
  UNIQUE (show_id, key)
);

CREATE TABLE segments (
  id TEXT PRIMARY KEY,
  show_id TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  performer TEXT NOT NULL DEFAULT '',
  duration_sec INTEGER NOT NULL,
  fixed_time TEXT,
  notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE cue_groups (
  id TEXT PRIMARY KEY,
  show_id TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  segment_id TEXT
);

CREATE TABLE cues (
  id TEXT PRIMARY KEY,
  show_id TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  segment_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  number TEXT NOT NULL,
  department_id TEXT NOT NULL,
  instruction TEXT NOT NULL,
  owner TEXT NOT NULL DEFAULT '',
  offset_sec INTEGER NOT NULL DEFAULT 0,
  duration_sec INTEGER NOT NULL DEFAULT 0,
  group_id TEXT,
  -- reserved for future playback/hardware adapters; never acted on in v1
  target TEXT
);
CREATE INDEX cues_show ON cues(show_id);

CREATE TABLE show_drafts (
  show_id TEXT PRIMARY KEY REFERENCES shows(id) ON DELETE CASCADE,
  base_revision INTEGER NOT NULL,
  content TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE show_revisions (
  id TEXT PRIMARY KEY,
  show_id TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL,
  session_id TEXT,
  kind TEXT NOT NULL, -- publish | live_edit | undo | import
  actor_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  changes TEXT NOT NULL, -- JSON EntityChange[] with before/after values
  undo_of TEXT,
  undone_by TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (show_id, revision)
);

CREATE TABLE live_sessions (
  id TEXT PRIMARY KEY,
  show_id TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('rehearsal','live')),
  timing_policy TEXT NOT NULL CHECK (timing_policy IN ('manual','projected')),
  status TEXT NOT NULL CHECK (status IN ('active','ended')),
  director_user_id TEXT NOT NULL,
  control_client_id TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  started_by TEXT NOT NULL
);
CREATE UNIQUE INDEX one_active_session ON live_sessions(show_id) WHERE status = 'active';

CREATE TABLE cue_states (
  session_id TEXT NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  cue_id TEXT NOT NULL,
  state TEXT NOT NULL,
  prev_state TEXT,
  reason TEXT NOT NULL DEFAULT '',
  called_at TEXT,
  completed_at TEXT,
  last_action_id TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (session_id, cue_id)
);

CREATE TABLE segment_live (
  session_id TEXT NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  segment_id TEXT NOT NULL,
  delay_sec INTEGER NOT NULL DEFAULT 0,
  actual_start TEXT,
  actual_end TEXT,
  PRIMARY KEY (session_id, segment_id)
);

-- One row per accepted Director command. The idempotency key makes retries of
-- the same request return the original result instead of issuing again.
CREATE TABLE cue_actions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_kind TEXT NOT NULL,
  target_id TEXT NOT NULL,
  cue_ids TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  result TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (session_id, idempotency_key)
);

CREATE TABLE operator_readiness (
  session_id TEXT NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  cue_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ready','not_ready','issue')),
  note TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (session_id, cue_id, user_id)
);

CREATE TABLE activity_events (
  show_id TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  session_id TEXT,
  type TEXT NOT NULL,
  actor_id TEXT,
  actor_name TEXT NOT NULL,
  summary TEXT NOT NULL,
  revision INTEGER NOT NULL,
  revision_id TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (show_id, seq)
);

CREATE TABLE import_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  source_kind TEXT NOT NULL,
  -- original upload preserved separately from the normalized show
  source BLOB,
  status TEXT NOT NULL, -- parsed | unsupported | committed
  message TEXT NOT NULL DEFAULT '',
  table_json TEXT NOT NULL DEFAULT '[]',
  committed_show_id TEXT,
  created_at TEXT NOT NULL
);
