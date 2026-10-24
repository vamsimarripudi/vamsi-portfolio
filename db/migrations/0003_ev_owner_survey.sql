-- Safe to apply more than once. Runtime ensures these tables exist for first use.
CREATE TABLE IF NOT EXISTS ev_survey_responses (
  id uuid PRIMARY KEY,
  submission_id uuid NOT NULL UNIQUE,
  reference_id text NOT NULL UNIQUE,
  survey_version text NOT NULL,
  answers jsonb NOT NULL,
  consented_at timestamptz NOT NULL DEFAULT NOW(),
  created_at timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ev_survey_responses_created_idx ON ev_survey_responses (created_at DESC);
CREATE TABLE IF NOT EXISTS ev_survey_throttle (
  key_hash text PRIMARY KEY,
  bucket_started_at timestamptz NOT NULL,
  attempts integer NOT NULL
);
