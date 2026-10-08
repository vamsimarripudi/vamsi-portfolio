-- Additive identity migration. All existing owner/content/session rows are retained.
CREATE TABLE IF NOT EXISTS identity_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  verified_at TEXT, bio TEXT NOT NULL DEFAULT '',
  locale TEXT NOT NULL DEFAULT 'en',
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility='private'),
  email_updates INTEGER NOT NULL DEFAULT 0 CHECK (email_updates IN (0,1)),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS identity_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('verify-email','reset-password','change-email')),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_identity_tokens_user ON identity_tokens(user_id,purpose,expires_at);
CREATE TABLE IF NOT EXISTS identity_invitations (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','editor','moderator')),
  token_hash TEXT NOT NULL UNIQUE,
  invited_by TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_identity_invitation_email ON identity_invitations(email,expires_at);
CREATE TABLE IF NOT EXISTS identity_mfa (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  secret_ciphertext TEXT NOT NULL,
  created_at TEXT NOT NULL,
  enabled_at TEXT,
  last_step INTEGER NOT NULL DEFAULT -1
);
CREATE TABLE IF NOT EXISTS identity_mfa_recovery (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id,code_hash)
);
CREATE TABLE IF NOT EXISTS identity_challenges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenge_hash TEXT NOT NULL UNIQUE,
  purpose TEXT NOT NULL CHECK (purpose IN ('mfa-enrol')),
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS identity_bookmarks (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id,post_id)
);
CREATE TABLE IF NOT EXISTS identity_privacy_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('export','deletion')),
  state TEXT NOT NULL DEFAULT 'requested' CHECK (state IN ('requested','reviewing','completed','declined')),
  requested_at TEXT NOT NULL,
  completed_at TEXT
);
CREATE TRIGGER IF NOT EXISTS identity_roles_insert_guard BEFORE INSERT ON users
  WHEN NEW.role NOT IN ('owner','admin','editor','moderator','member')
  BEGIN SELECT RAISE(ABORT,'Invalid identity role'); END;
CREATE TRIGGER IF NOT EXISTS identity_roles_update_guard BEFORE UPDATE OF role ON users
  WHEN NEW.role NOT IN ('owner','admin','editor','moderator','member')
  BEGIN SELECT RAISE(ABORT,'Invalid identity role'); END;
CREATE TRIGGER IF NOT EXISTS identity_unique_owner_guard BEFORE INSERT ON users
  WHEN NEW.role='owner' AND EXISTS (SELECT 1 FROM users WHERE role='owner')
  BEGIN SELECT RAISE(ABORT,'A single owner already exists'); END;
CREATE TRIGGER IF NOT EXISTS identity_unique_owner_update_guard BEFORE UPDATE OF role ON users
  WHEN NEW.role='owner' AND EXISTS (SELECT 1 FROM users WHERE role='owner' AND id<>NEW.id)
  BEGIN SELECT RAISE(ABORT,'A single owner already exists'); END;
