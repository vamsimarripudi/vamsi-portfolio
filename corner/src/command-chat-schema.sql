-- Additive Command Chat tables. Legacy queue and publishing data are not replaced.
CREATE TABLE IF NOT EXISTS command_conversations (
 id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 workspace TEXT NOT NULL CHECK(workspace IN ('personal','kravia')),
 title TEXT NOT NULL DEFAULT 'New conversation', status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, last_message_at TEXT,
 version INTEGER NOT NULL DEFAULT 1, create_key TEXT
);
CREATE TABLE IF NOT EXISTS command_messages (
 id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES command_conversations(id) ON DELETE CASCADE,
 sequence INTEGER NOT NULL CHECK(sequence>0), role TEXT NOT NULL CHECK(role IN ('user','assistant','tool')),
 content TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','complete','failed','cancelled')),
 idempotency_key TEXT, created_at TEXT NOT NULL, completed_at TEXT,
 turn_id TEXT, parts_json TEXT NOT NULL DEFAULT '{}', request_hash TEXT, error_code TEXT,
 attempt INTEGER NOT NULL DEFAULT 1, updated_at TEXT,
 UNIQUE(conversation_id,sequence), UNIQUE(conversation_id,idempotency_key)
);
CREATE TABLE IF NOT EXISTS command_action_proposals (
 id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES command_conversations(id) ON DELETE CASCADE,
 message_id TEXT REFERENCES command_messages(id) ON DELETE SET NULL,
 action_type TEXT NOT NULL, target_id TEXT, target_version INTEGER, payload_json TEXT NOT NULL DEFAULT '{}',
 status TEXT NOT NULL DEFAULT 'proposed' CHECK(status IN ('proposed','approved','rejected','expired','executed','failed')),
 idempotency_key TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, approved_at TEXT, executed_at TEXT, created_at TEXT NOT NULL,
 version INTEGER NOT NULL DEFAULT 1, result_json TEXT, error_code TEXT
);
CREATE TABLE IF NOT EXISTS command_tool_events (
 id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES command_conversations(id) ON DELETE CASCADE,
 message_id TEXT REFERENCES command_messages(id) ON DELETE SET NULL,
 tool_name TEXT NOT NULL, status TEXT NOT NULL, safe_metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL
);
-- Chat files are deliberately not generic post media: editor-role media access
-- and public post URL handlers cannot expose a private owner conversation.
CREATE TABLE IF NOT EXISTS command_chat_files (
 id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES command_conversations(id) ON DELETE CASCADE,
 message_id TEXT REFERENCES command_messages(id) ON DELETE CASCADE,
 storage_key TEXT NOT NULL UNIQUE, filename TEXT NOT NULL, mime_type TEXT NOT NULL,
 size_bytes INTEGER NOT NULL CHECK(size_bytes>0), generated INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS command_chat_usage (
 owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, day TEXT NOT NULL,
 requests INTEGER NOT NULL DEFAULT 0, tokens INTEGER NOT NULL DEFAULT 0,
 image_count INTEGER NOT NULL DEFAULT 0, image_reserved_usd REAL NOT NULL DEFAULT 0,
 PRIMARY KEY(owner_user_id,day)
);
CREATE TABLE IF NOT EXISTS command_chat_migrations (version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL);
