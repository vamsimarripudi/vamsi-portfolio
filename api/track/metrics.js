import { json, query, requireOwner } from '../../lib/track.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { ok: false, message: 'Method not allowed.' });
  const owner = await requireOwner(req, res);
  if (!owner) return;

  try {
    const rows = await query()`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'NEW')::int AS new_count,
        COUNT(*) FILTER (WHERE status IN ('ACKNOWLEDGED', 'REVIEWING'))::int AS in_progress_count,
        COUNT(*) FILTER (WHERE follow_up_at IS NOT NULL AND follow_up_at <= NOW() AND status NOT IN ('COMPLETED', 'CLOSED', 'SPAM', 'ERASED'))::int AS follow_up_due_count,
        COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS completed_count
      FROM track_enquiries`;
    return json(res, 200, { ok: true, metrics: rows[0] });
  } catch (error) {
    console.error('track.metrics.failed', { message: error instanceof Error ? error.message : 'unknown' });
    return json(res, 503, { ok: false, message: 'Tracker metrics are temporarily unavailable.' });
  }
}
