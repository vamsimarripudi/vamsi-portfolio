-- Phase 3 provider reconciliation. No subscriber PII, no webhook payloads.
ALTER TABLE v3_wish_outbox ADD COLUMN provider_message_id TEXT;
ALTER TABLE v3_wish_outbox ADD COLUMN provider_delivery_state TEXT NOT NULL DEFAULT 'unconfirmed'
 CHECK(provider_delivery_state IN ('unconfirmed','accepted','delayed','delivered','bounced','complained'));
CREATE INDEX IF NOT EXISTS idx_v3_outbox_provider_id ON v3_wish_outbox(provider_message_id);
CREATE TABLE IF NOT EXISTS v3_wish_provider_events (
 id TEXT PRIMARY KEY,
 provider_message_id TEXT NOT NULL,
 event TEXT NOT NULL CHECK(event IN ('email.sent','email.delivered','email.delivery_delayed','email.bounced','email.complained')),
 received_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_v3_provider_event_message ON v3_wish_provider_events(provider_message_id,received_at);
