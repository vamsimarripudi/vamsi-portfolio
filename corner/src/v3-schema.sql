-- Corner V3 Phase 1. Additive, idempotent; no destructive changes.
CREATE TABLE IF NOT EXISTS v3_guestbook (
  id TEXT PRIMARY KEY,
  author_name TEXT NOT NULL,
  message TEXT NOT NULL,
  member_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','approved','hidden','deleted')),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  moderated_at TEXT, moderated_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_v3_guestbook_public ON v3_guestbook(state,created_at DESC);
CREATE TABLE IF NOT EXISTS v3_follows (
  id TEXT PRIMARY KEY,
  email_hash TEXT NOT NULL UNIQUE,
  email_cipher TEXT NOT NULL,
  topics TEXT NOT NULL DEFAULT '["all"]',
  frequency TEXT NOT NULL DEFAULT 'weekly' CHECK(frequency IN ('weekly','instant')),
  state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','active','unsubscribed','bounced')),
  consent_version TEXT NOT NULL,
  consent_at TEXT NOT NULL, verified_at TEXT, revoked_at TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_v3_follow_status ON v3_follows(state,updated_at);
CREATE TABLE IF NOT EXISTS v3_follow_tokens (
  id TEXT PRIMARY KEY,
  follow_id TEXT NOT NULL REFERENCES v3_follows(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK(purpose IN ('verify','unsubscribe')),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL, consumed_at TEXT, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_v3_follow_tokens ON v3_follow_tokens(follow_id,purpose,expires_at);
CREATE TABLE IF NOT EXISTS v3_follow_consent (
  id TEXT PRIMARY KEY,
  follow_id TEXT NOT NULL REFERENCES v3_follows(id) ON DELETE CASCADE,
  event TEXT NOT NULL CHECK(event IN ('requested','verified','unsubscribed','bounced')),
  notice_version TEXT NOT NULL, recorded_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS v3_reading_positions (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  progress INTEGER NOT NULL DEFAULT 0 CHECK(progress BETWEEN 0 AND 100),
  updated_at TEXT NOT NULL,
  PRIMARY KEY(user_id,post_id)
);
CREATE INDEX IF NOT EXISTS idx_v3_positions_user ON v3_reading_positions(user_id,updated_at DESC);
