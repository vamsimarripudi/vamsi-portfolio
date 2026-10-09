-- Phase 3 opt-in delivery: no plaintext subscriber addresses are stored.
CREATE TABLE IF NOT EXISTS v3_wish_outbox (
 id TEXT PRIMARY KEY,
 post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
 follow_id TEXT NOT NULL REFERENCES v3_follows(id) ON DELETE CASCADE,
 frequency TEXT NOT NULL CHECK(frequency IN ('instant','weekly')),
 state TEXT NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','sending','retry','sent','failed','cancelled')),
 attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 20),
 next_attempt_at TEXT NOT NULL, lease_until TEXT,
 provider_reference TEXT NOT NULL UNIQUE,
 last_error TEXT, created_at TEXT NOT NULL,updated_at TEXT NOT NULL,sent_at TEXT,
 UNIQUE(post_id,follow_id)
);
CREATE INDEX IF NOT EXISTS idx_v3_wish_outbox_due ON v3_wish_outbox(state,next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_v3_wish_outbox_follow ON v3_wish_outbox(follow_id,state);
CREATE TABLE IF NOT EXISTS v3_wish_delivery_events (
 id TEXT PRIMARY KEY,
 outbox_id TEXT NOT NULL REFERENCES v3_wish_outbox(id) ON DELETE CASCADE,
 event TEXT NOT NULL CHECK(event IN ('queued','attempted','sent','retry','failed','cancelled')),
 recorded_at TEXT NOT NULL,details TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_v3_wish_delivery_events ON v3_wish_delivery_events(outbox_id,recorded_at);
