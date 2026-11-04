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
 action_type TEXT NOT NULL, t¶»§q«^