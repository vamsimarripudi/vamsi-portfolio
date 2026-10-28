-- Optional Corner communications V1. Apply only with CORNER_COMMUNICATIONS_ENABLED=1
-- and after a verified real offsite restore rehearsal. Additive, non-destructive.
-- Never store plaintext addresses, tokens, visitor identifiers or full provider payloads.
CREATE TABLE IF NOT EXISTS corner_comm_campaigns (
 id TEXT PRIMARY KEY,
 campaign_key TEXT NOT NULL UNIQUE,
 kind TEXT NOT NULL CHECK (kind IN ('story','update','digest')),
 category TEXT NOT NULL,
 post_ids TEXT NOT NULL,
 post_versions TEXT NOT NULL,
 created_by TEXT NOT NULL,
 created_at TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'queued' CHECK (state IN ('queued','complete')),
 template_version TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS corner_comm_outbox (
 id TEXT PRIMARY KEY,
 campaign_id TEXT NOT NULL REFERENCES corner_comm_campaigns(id) ON DELETE CASCADE,
 follow_id TEXT NOT NULL REFERENCES v3_follows(id) ON DELETE CASCADE,
 state TEXT NOT NULL DEFAULT 'queued' CHECK (state IN ('queued','sending','retry','sent','failed','cancelled')),
 attempts INTEGER NOT NULL DEFAULT 0,
 next_attempt_at TEXT NOT NULL,
 lease_until TEXT,
 provider_reference TEXT NOT NULL UNIQUE,
 provider_message_id TEXT,
 provider_state TEXT NOT NULL DEFAULT 'not_sent',
 sent_at TEXT,
 last_error TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 UNIQUE(campaign_id,follow_id)
);
CREATE INDEX IF NOT EXISTS idx_corner_comm_due ON corner_comm_outbox(state,next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_corner_comm_provider ON corner_comm_outbox(provider_message_id);
CREATE TABLE IF NOT EXISTS corner_comm_events (
 id TEXT PRIMARY KEY,
 outbox_id TEXT NOT NULL REFERENCES corner_comm_outbox(id) ON DELETE CASCADE,
 event TEXT NOT NULL CHECK (event IN ('queued','attempt','sent','retry','failed','cancelled','delivered','bounced','complained','delayed')),
 recorded_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_corner_comm_events ON corner_comm_events(recorded_at DESC);
