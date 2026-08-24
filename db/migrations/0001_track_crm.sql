CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS track_enquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id text NOT NULL UNIQUE,
  name text NOT NULL,
  email text NOT NULL,
  intent text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW','ACKNOWLEDGED','REVIEWING','REPLIED','FOLLOW_UP_DUE','WAITING_ON_CONTACT','COMPLETED','CLOSED','SPAM','ERASURE_PENDING','ERASED')),
  priority text NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('NORMAL','HIGH','URGENT')),
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  reviewed_at timestamptz,
  replied_at timestamptz,
  follow_up_at timestamptz,
  completed_at timestamptz,
  closed_at timestamptz,
  last_activity_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS track_email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_id uuid NOT NULL REFERENCES track_enquiries(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_message_id text,
  email_type text NOT NULL,
  recipient text NOT NULL,
  status text NOT NULL,
  sent_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  failure_code text,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS track_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_id uuid NOT NULL REFERENCES track_enquiries(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS track_activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_id uuid NOT NULL REFERENCES track_enquiries(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_id text NOT NULL,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS track_privacy_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_reference text NOT NULL UNIQUE,
  enquiry_id uuid REFERENCES track_enquiries(id) ON DELETE SET NULL,
  email text NOT NULL,
  request_type text NOT NULL CHECK (request_type IN ('ACCESS','CORRECTION','ERASURE','GRIEVANCE','WITHDRAWAL')),
  status text NOT NULL DEFAULT 'RECEIVED' CHECK (status IN ('RECEIVED','VERIFYING','IN_PROGRESS','COMPLETED','DECLINED')),
  received_at timestamptz NOT NULL DEFAULT NOW(),
  verified_at timestamptz,
  completed_at timestamptz,
  notes text
);

CREATE TABLE IF NOT EXISTS track_auth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  owner_email text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS track_sessions (
  id text PRIMARY KEY,
  owner_email text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS track_enquiries_email_idx ON track_enquiries(email);
CREATE INDEX IF NOT EXISTS track_enquiries_status_idx ON track_enquiries(status);
CREATE INDEX IF NOT EXISTS track_enquiries_intent_idx ON track_enquiries(intent);
CREATE INDEX IF NOT EXISTS track_enquiries_created_at_idx ON track_enquiries(created_at DESC);
CREATE INDEX IF NOT EXISTS track_enquiries_follow_up_at_idx ON track_enquiries(follow_up_at);
CREATE INDEX IF NOT EXISTS track_enquiries_last_activity_at_idx ON track_enquiries(last_activity_at DESC);
CREATE INDEX IF NOT EXISTS track_email_events_enquiry_idx ON track_email_events(enquiry_id, created_at DESC);
CREATE INDEX IF NOT EXISTS track_activity_events_enquiry_idx ON track_activity_events(enquiry_id, created_at DESC);
CREATE INDEX IF NOT EXISTS track_notes_enquiry_idx ON track_notes(enquiry_id, created_at DESC);
