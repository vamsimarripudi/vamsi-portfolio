-- Additive website analytics only; preserves all enquiry and Corner data.
BEGIN;
CREATE TABLE IF NOT EXISTS site_analytics_views (
 view_key text PRIMARY KEY CHECK(length(view_key)=64),journey_key text NOT NULL CHECK(length(journey_key)=64),path text NOT NULL,device text NOT NULL,source text NOT NULL,
 started_at timestamptz NOT NULL,updated_at timestamptz NOT NULL,depth integer NOT NULL DEFAULT 0 CHECK(depth IN (0,25,50,75,90)),active_ms integer NOT NULL DEFAULT 0 CHECK(active_ms BETWEEN 0 AND 1800000),section text NOT NULL DEFAULT 'main',
 engaged_at timestamptz,contact_start_at timestamptz,contact_success_at timestamptz,contact_failed boolean NOT NULL DEFAULT false,resume_click boolean NOT NULL DEFAULT false,profile_click boolean NOT NULL DEFAULT false,request_failed boolean NOT NULL DEFAULT false,media_failed boolean NOT NULL DEFAULT false);
CREATE INDEX IF NOT EXISTS site_analytics_started ON site_analytics_views(started_at);
CREATE INDEX IF NOT EXISTS site_analytics_journey ON site_analytics_views(journey_key,started_at);
CREATE TABLE IF NOT EXISTS site_analytics_revocations (journey_key text PRIMARY KEY,expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS site_analytics_limits (key text PRIMARY KEY,n integer NOT NULL,expires_at timestamptz NOT NULL);
COMMIT;
