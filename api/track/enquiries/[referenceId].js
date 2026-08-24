import { TrackError, availableTransitions, createActivity, json, query, requireOwner } from '../../../lib/track.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { ok: false, message: 'Method not allowed.' });
  const owner = await requireOwner(req, res);
  if (!owner) return;
  try {
    const referenceId = String(req.query?.referenceId || '').trim();
    if (!/^VM-ENQ-\d{4}-[A-Z0-9]{6}$/.test(referenceId)) throw new TrackError(404, 'Enquiry not found.', 'ENQUIRY_NOT_FOUND');
    const sql = query();
    const rows = await sql`SELECT * FROM track_enquiries WHERE reference_id = ${referenceId} LIMIT 1`;
    let enquiry = rows[0];
    if (!enquiry) throw new TrackError(404, 'Enquiry not found.', 'ENQUIRY_NOT_FOUND');
    if (!enquiry.reviewed_at) {
      const updated = await sql`UPDATE track_enquiries SET reviewed_at = NOW(), updated_at = NOW(), last_activity_at = NOW(), status = CASE WHEN status = 'NEW' THEN 'ACKNOWLEDGED' ELSE status END WHERE id = ${enquiry.id} RETURNING *`;
      enquiry = updated[0];
      await createActivity(enquiry.id, 'enquiry.opened', owner.owner_email);
    }
    const [events, notes, emails, privacyRequests] = await Promise.all([
      sql`SELECT id, event_type, actor_id, metadata_json, created_at FROM track_activity_events WHERE enquiry_id = ${enquiry.id} ORDER BY created_at DESC LIMIT 120`,
      sql`SELECT id, body, created_by, created_at, updated_at FROM track_notes WHERE enquiry_id = ${enquiry.id} ORDER BY created_at DESC`,
      sql`SELECT id, provider_message_id, email_type, recipient, status, sent_at, delivered_at, failed_at, failure_code, created_at FROM track_email_events WHERE enquiry_id = ${enquiry.id} ORDER BY created_at DESC`,
      sql`SELECT request_reference, request_type, status, received_at, verified_at, completed_at FROM track_privacy_requests WHERE enquiry_id = ${enquiry.id} ORDER BY received_at DESC`,
    ]);
    return json(res, 200, { ok: true, enquiry, allowedStatuses: availableTransitions(enquiry.status), activity: events, notes, emails, privacyRequests });
  } catch (error) {
    if (error instanceof TrackError) return json(res, error.status, { ok: false, code: error.code, message: error.message });
    console.error('track.enquiry.detail.failed', { message: error instanceof Error ? error.message : 'unknown' });
    return json(res, 503, { ok: false, message: 'Tracker data is temporarily unavailable.' });
  }
}