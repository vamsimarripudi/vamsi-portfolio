import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { query, TrackError } from '../api/lib/track.js';
import { SURVEY_VERSION, validateSurveyAnswers, responseRowsToCsv } from '../shared/ev-survey.mjs';

// Lazy, idempotent schema bootstrap removes a separate database-provider setup
// for this small owner-operated study. The identical SQL is recorded as a migration.
let schemaReady;
export function ensureSurveySchema() {
  if (!schemaReady) schemaReady = (async () => {
    const sql = query();
    await sql`CREATE TABLE IF NOT EXISTS ev_survey_responses (
      id uuid PRIMARY KEY,
      submission_id uuid NOT NULL UNIQUE,
      reference_id text NOT NULL UNIQUE,
      survey_version text NOT NULL,
      answers jsonb NOT NULL,
      consented_at timestamptz NOT NULL DEFAULT NOW(),
      created_at timestamptz NOT NULL DEFAULT NOW()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS ev_survey_responses_created_idx ON ev_survey_responses (created_at DESC)`;
    await sql`CREATE TABLE IF NOT EXISTS ev_survey_throttle (
      key_hash text PRIMARY KEY,
      bucket_started_at timestamptz NOT NULL,
      attempts integer NOT NULL
    )`;
  })().catch((error) => { schemaReady = undefined; throw error; });
  return schemaReady;
}

function clientKey(req) {
  const secret = process.env.TRACK_SESSION_SECRET;
  if (!secret) throw new TrackError(503, 'Survey service is not configured.', 'SURVEY_NOT_CONFIGURED');
  const forwarded = req.headers['x-forwarded-for'];
  const ip = (Array.isArray(forwarded) ? forwarded[0] : (forwarded || req.socket?.remoteAddress || 'unknown')).split(',')[0].trim().slice(0, 64);
  return createHmac('sha256', secret).update('ev-survey-v1:' + ip).digest('hex');
}

async function enforceLimit(req) {
  const sql = query();
  const key = clientKey(req);
  const rows = await sql`
    INSERT INTO ev_survey_throttle (key_hash, bucket_started_at, attempts)
    VALUES (${key}, NOW(), 1)
    ON CONFLICT (key_hash) DO UPDATE SET
      attempts = CASE WHEN ev_survey_throttle.bucket_started_at < NOW() - INTERVAL '1 hour' THEN 1 ELSE ev_survey_throttle.attempts + 1 END,
      bucket_started_at = CASE WHEN ev_survey_throttle.bucket_started_at < NOW() - INTERVAL '1 hour' THEN NOW() ELSE ev_survey_throttle.bucket_started_at END
    RETURNING attempts`;
  if (rows[0]?.attempts > 8) throw new TrackError(429, 'Too many submissions from this connection. Please try again later.', 'SURVEY_RATE_LIMITED');
  // Keep abuse-control records short-lived and pseudonymous.
  await sql`DELETE FROM ev_survey_throttle WHERE bucket_started_at < NOW() - INTERVAL '48 hours'`;
}

export async function submitSurvey(req, payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || JSON.stringify(payload).length > 40000) throw new TrackError(400, 'Invalid survey request.', 'SURVEY_INVALID');
  if (payload.website || payload.company) throw new TrackError(400, 'Survey could not be submitted.', 'SURVEY_INVALID');
  if (payload.consent !== true) throw new TrackError(400, 'The participant must agree before submission.', 'SURVEY_CONSENT_REQUIRED');
  if (payload.surveyVersion !== SURVEY_VERSION) throw new TrackError(409, 'The questionnaire changed. Please refresh to continue.', 'SURVEY_VERSION_MISMATCH');
  if (!/^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(payload.submissionId || '')) throw new TrackError(400, 'Invalid submission identifier.', 'SURVEY_INVALID');
  const validated = validateSurveyAnswers(payload.answers);
  if (!validated.ok) throw new TrackError(422, 'Please complete the required survey questions.', 'SURVEY_INCOMPLETE');
  await ensureSurveySchema();
  const previous = await query()`SELECT reference_id FROM ev_survey_responses WHERE submission_id = ${payload.submissionId} LIMIT 1`;
  if (previous[0]) return previous[0].reference_id;
  await enforceLimit(req);
  const sql = query();
  const referenceId = 'EV-' + new Date().getUTCFullYear() + '-' + randomBytes(5).toString('hex').toUpperCase();
  const rows = await sql`
    INSERT INTO ev_survey_responses (id, submission_id, reference_id, survey_version, answers)
    VALUES (${randomUUID()}, ${payload.submissionId}, ${referenceId}, ${SURVEY_VERSION}, ${JSON.stringify(validated.answers)}::jsonb)
    ON CONFLICT (submission_id) DO NOTHING RETURNING reference_id`;
  if (rows[0]) return rows[0].reference_id;
  const existing = await sql`SELECT reference_id FROM ev_survey_responses WHERE submission_id = ${payload.submissionId} LIMIT 1`;
  if (!existing[0]) throw new TrackError(503, 'Survey could not be saved. Please retry.', 'SURVEY_RETRY');
  return existing[0].reference_id;
}

const groupField = async (key) => {
  const sql = query();
  // Literal column selection: never interpolate untrusted SQL identifiers.
  if (key === 'primary_issue') return sql`SELECT COALESCE(answers->>'primary_issue', 'Unspecified') AS label, COUNT(*)::int AS count FROM ev_survey_responses GROUP BY 1 ORDER BY count DESC, label`;
  if (key === 'max_price') return sql`SELECT COALESCE(answers->>'max_price', 'Unspecified') AS label, COUNT(*)::int AS count FROM ev_survey_responses GROUP BY 1 ORDER BY count DESC, label`;
  if (key === 'pay_for_review') return sql`SELECT COALESCE(answers->>'pay_for_review', 'Unspecified') AS label, COUNT(*)::int AS count FROM ev_survey_responses GROUP BY 1 ORDER BY count DESC, label`;
  throw new TrackError(400, 'Unsupported metric.', 'SURVEY_METRIC');
};

export async function readSurveyDashboard({ q = '', page = 1, download = false } = {}) {
  await ensureSurveySchema();
  const sql = query();
  const search = String(q).trim().slice(0, 100);
  const match = '%' + search.replace(/[\\%_]/g, '') + '%';
  const offset = (Math.max(1, Math.min(1000, Number(page) || 1)) - 1) * 25;
  if (download) {
    const csvRows = await sql`SELECT reference_id, created_at, answers FROM ev_survey_responses ORDER BY created_at DESC LIMIT 5000`;
    return { csv: responseRowsToCsv(csvRows), exported: csvRows.length };
  }
  const [overview, issues, prices, interest, chronology, recent, searchCount] = await Promise.all([
    sql`SELECT COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE answers->>'quote_confusion' = 'Yes')::int AS unclear_estimates,
      COUNT(*) FILTER (WHERE answers->>'warranty_experience' IN ('Claim rejected', 'Claim delayed or disputed', 'Coverage unclear, no claim made'))::int AS warranty_concerns,
      COUNT(*) FILTER (WHERE answers->>'charging_failure' IN ('Yes, more than once', 'Yes, once'))::int AS charging_failures,
      COUNT(*) FILTER (WHERE answers->>'paid_help' = 'Yes')::int AS previously_paid,
      COUNT(*) FILTER (WHERE answers->>'pay_for_review' = 'Yes')::int AS willing_to_consider
      FROM ev_survey_responses`,
    groupField('primary_issue'), groupField('max_price'), groupField('pay_for_review'),
    sql`SELECT to_char(date_trunc('week', created_at), 'YYYY-MM-DD') AS week, COUNT(*)::int AS count
      FROM ev_survey_responses GROUP BY 1 ORDER BY week DESC LIMIT 12`,
    sql`SELECT reference_id, survey_version, answers, created_at FROM ev_survey_responses
      WHERE (${search} = '' OR reference_id ILIKE ${match} OR answers->>'ev_model' ILIKE ${match} OR answers->>'city' ILIKE ${match})
      ORDER BY created_at DESC LIMIT 25 OFFSET ${offset}`,
    sql`SELECT COUNT(*)::int AS count FROM ev_survey_responses
      WHERE (${search} = '' OR reference_id ILIKE ${match} OR answers->>'ev_model' ILIKE ${match} OR answers->>'city' ILIKE ${match})`,
  ]);
  return { overview: overview[0] || { total: 0 }, distributions: { issues, prices, interest }, weeks: chronology.reverse(), items: recent, matchCount: searchCount[0]?.count ?? 0, page: Math.max(1, Math.min(1000, Number(page) || 1)) };
}

export async function deleteSurveyRecord(referenceId) {
  await ensureSurveySchema();
  const ref = String(referenceId || '').trim();
  if (!/^EV-\d{4}-[A-F0-9]{10}$/.test(ref)) throw new TrackError(400, 'Invalid interview reference.', 'SURVEY_INVALID');
  const rows = await query()`DELETE FROM ev_survey_responses WHERE reference_id = ${ref} RETURNING reference_id`;
  if (!rows[0]) throw new TrackError(404, 'Survey record not found.', 'SURVEY_NOT_FOUND');
  return rows[0].reference_id;
}

// Run by the already configured authenticated daily tracker cron.
export async function cleanupSurveyData() {
  await ensureSurveySchema();
  const sql = query();
  const deleted = await sql`DELETE FROM ev_survey_responses WHERE created_at < NOW() - INTERVAL '12 months' RETURNING id`;
  await sql`DELETE FROM ev_survey_throttle WHERE bucket_started_at < NOW() - INTERVAL '48 hours'`;
  return deleted.length;
}
