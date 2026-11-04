-- Command Chat V2 additive SQLite schema. Apply only through reviewed store migration.
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS command_conversations (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace TEXT NOT NULL CHECK (workspace IN ('personal','kravia')),
  title TEXT NOT NULL DEFAULT 'New conversation',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_message_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_command_conversations_owner
  ON command_conversations(owner_user_id,workspace,status,updated_at DESC);

CREATE TABLE IF NOT EXISTS command_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES command_conversations(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL CHECK (sequence > 0),
  role TEXT NOT NULL CHECK (role IN ('user','assistant','tool')),
  content TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','complete','failed','cancelled')),
  idempotency_key TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  UNIQUE(conversation_id,sequence),
  UNIQUE(conversation_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_command_messages_conversation
  ON command_messages(conversation_id,sequence);

CREATE TABLE IF NOT EXISTS command_action_proposals (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES command_conversations(id) ON DELETE CASCADE,
  message_id TEXT REFERENCES command_messages(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  target_id TEXT,
  target_version INTEGER,
  payload_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','approved','rejected','expired','executed','failed')),
  idempotency_key TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  approved_at TEXT,
  executed_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_command_proposals_status
  ON command_action_proposals(status,expires_at);

CREATE TABLE IF NOT EXISTS command_tool_events (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES command_conversations(id) ON DELETE CASCADE,
  message_id TEXT REFERENCES command_messages(id) ON DELETE SET NULL,
  tool_name TEXT NOT NULL,
  status TEXT NOT NULL,
  safe_metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS command_attachments (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL REFERENCES command_messages(id) ON DELETE CASCADE,
  media_id TEXT NOT NULL REFERENCES media(id) ON DELETE RESTRICT,
  mime_type TEXT NOT NULL,
  processing_status TEXT NOT NULL DEFAULT 'pending'
);
CREATE INDEX IF NOT EXISTS idx_command_attachments_message
  ON command_attachments(message_id);
