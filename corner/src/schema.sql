PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'owner', password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, last_login_at TEXT, disabled_at TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, expires_at TEXT NOT NULL,
  last_seen_at TEXT, ip_hash TEXT, user_agent_hash TEXT, revoked_at TEXT
);
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY, parent_post_id TEXT REFERENCES posts(id) ON DELETE SET NULL,
  slug TEXT NOT NULL UNIQUE, type TEXT NOT NULL,
  title TEXT NOT NULL, excerpt TEXT NOT NULL DEFAULT '', body TEXT NOT NULL DEFAULT '',
  emoji TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT '', tags TEXT NOT NULL DEFAULT '[]',
  state TEXT NOT NULL DEFAULT 'draft', published_at TEXT, scheduled_at TEXT,
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata', recurrence TEXT NOT NULL DEFAULT 'none',
  recurrence_month INTEGER, recurrence_day INTEGER, recurrence_time TEXT,
  featured INTEGER NOT NULL DEFAULT 0, feature_start_at TEXT, feature_end_at TEXT,
  pinned INTEGER NOT NULL DEFAULT 0, pin_start_at TEXT, pin_end_at TEXT,
  upcoming_public INTEGER NOT NULL DEFAULT 0,
  recurrence_end_year INTEGER,
  allow_comments INTEGER NOT NULL DEFAULT 0, allow_reactions INTEGER NOT NULL DEFAULT 1,
  milestone INTEGER NOT NULL DEFAULT 0, version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, archived_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_posts_feed ON posts(state, published_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category, state, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_schedule ON posts(state, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_posts_parent ON posts(parent_post_id);
CREATE TABLE IF NOT EXISTS post_occurrences (
  id TEXT PRIMARY KEY, post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  occurrence_at TEXT NOT NULL, execution_key TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL, published_post_id TEXT, published_post_version INTEGER,
  processed_at TEXT, error TEXT, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_occurrences_schedule ON post_occurrences(state, occurrence_at);
CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY, owner_type TEXT NOT NULL, owner_id TEXT,
  storage_key TEXT NOT NULL UNIQUE, mime_type TEXT NOT NULL,
  width INTEGER, height INTEGER, duration REAL, size_bytes INTEGER NOT NULL,
  alt_text TEXT NOT NULL DEFAULT '', caption TEXT NOT NULL DEFAULT '',
  focal_x REAL NOT NULL DEFAULT 0.5, focal_y REAL NOT NULL DEFAULT 0.5,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_media_owner ON media(owner_type, owner_id);
CREATE TABLE IF NOT EXISTS reactions (
  id TEXT PRIMARY KEY, post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL, actor_key TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  UNIQUE(post_id, actor_key)
);
CREATE INDEX IF NOT EXISTS idx_reactions_post ON reactions(post_id,reaction_type);
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY, post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL, body TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, moderation_reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id,state,created_at);
CREATE TABLE IF NOT EXISTS site_status (
  id INTEGER PRIMARY KEY CHECK(id=1), label TEXT NOT NULL DEFAULT '', detail TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '✳', active_from TEXT, active_until TEXT,
  is_active INTEGER NOT NULL DEFAULT 0, version INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS analytics_events (
  id TEXT PRIMARY KEY, type TEXT NOT NULL, post_id TEXT, session_key TEXT,
  path TEXT NOT NULL, referrer_class TEXT, device_class TEXT, occurred_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_analytics_time ON analytics_events(occurred_at);
CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY, actor_user_id TEXT, action TEXT NOT NULL,
  entity_type TEXT, entity_id TEXT, metadata TEXT NOT NULL DEFAULT '{}', occurred_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_events(occurred_at);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS realtime_events (
  seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, type TEXT NOT NULL,
  occurred_at TEXT NOT NULL, entity_id TEXT, version INTEGER NOT NULL DEFAULT 1,
  payload TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_realtime_created ON realtime_events(occurred_at);
CREATE TABLE IF NOT EXISTS rate_buckets (
  key TEXT PRIMARY KEY, count INTEGER NOT NULL, reset_at TEXT NOT NULL
);
INSERT OR IGNORE INTO site_status (id,updated_at) VALUES (1,datetime('now'));
