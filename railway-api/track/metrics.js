import websiteCollector from '../../server/site-analytics-handler.js';
import analytics from '../../server/track-analytics-handler.js';
import { json, query, requireOwner } from '../lib/track.js';
import publicEVSurvey from '../../server/ev-survey-public-handler.js';
import privateEVSurvey from '../../server/ev-survey-private-handler.js';

export default async function handler(req, res) {
  if (req.query?.view === 'site-events') return websiteCollector(req, res);
  // Keep EV research within the current Vercel Hobby serverless-function budget.
  if (req.query?.view === 'ev-public') return publicEVSurvey(req, res);
  if (req.query?.view === 'ev-surveys') return privateEVSurvey(req, res);
  // Share the existing function slot; the analytics handler retains its own owner gate.
  if (req.query?.view === 'analytics') {
    const { view, ...query } = req.query;
    void view;
    const analyticsRequest = Object.create(req);
    Object.defineProperty(analyticsRequest, 'query', { value: query });
    return analytics(analyticsRequest, res);
  }
  if (req.method !== 'GET') return json(res, 405, { ok: false, message: 'Method not allowed.' });
  const owner = await requireOwner(req, res);
  if (!owner) return;

  try {
    const rows = await query()`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'NEW')::int AS new_count,
        COUNT(*) FILTER (WHERE status = 'REVIEWING')::int AS in_progress_count,
        COUNT(*) FILTER (WHERE follow_up_at IS NOT NULL AND follow_up_at <= NOW() AND status NOT IN ('COMPLETED', 'CLOSED', 'SPAM', 'ERASED', 'ERASURE_PENDING'))::int AS follow_up_due_count,
        COUNT(*) FILTER (WHERE status = 'WAITING_ON_CONTACT')::int AS waiting_on_contact_count,
        COUNT(*) FILTER (WHERE status = 'ERASURE_PENDING')::int AS erasure_pending_count,
        COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS completed_count,
        MAX(created_at) AS last_received_at
      FROM track_enquiries`;
    return json(res, 200, { ok: true, metrics: rows[0] });
  } catch (error) {
    console.error('track.metrics.failed', { message: error instanceof Error ? error.message : 'unknown' });
    return json(res, 503, { ok: false, message: 'Tracker metrics are temporarily unavailable.' });
  }
}
