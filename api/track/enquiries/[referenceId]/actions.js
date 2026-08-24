import { TRACK_PRIORITIES, TRACK_STATUSES, TrackError, assertSameOrigin, canTransition, cleanHeader, cleanText, createActivity, json, query, requireOwner } from '../../../../lib/track.js';

const privacyTypes = ['ACCESS', 'CORRECTION', 'ERASURE', 'GRIEVANCE', 'WITHDRAWAL'];

const privacyReference = () => `VM-PRV-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, message: 'Method not allowed.' });
  const owner = await requireOwner(req, res);
  if (!owner) return;
  try {
    assertSameOrigin(req);
    const referenceId = String(req.query?.referenceId || '').trim();
    const sql = query();
    const rows = await sql`SELECT * FROM track_enquiries WHERE reference_id = ${referenceId} LIMIT 1`;
    const enquiry = rows[0];
    if (!enquiry) throw new TrackError(404, 'Enquiry not found.', 'ENQUIRY_NOT_FOUND');
    const action = cleanHeader(req.body?.action, 40);

    if (action === 'add_note') {
      const body = cleanText(req.body?.body, 4000);
      if (body.length < 2) throw new TrackError(400, 'Write a short note before saving.', 'NOTE_INVALID');
      await sql`INSERT INTO track_notes (enquiry_id, body, created_by) VALUES (${enquiry.id}, ${body}, ${owner.owner_email})`;
      await createActivity(enquiry.id, 'enquiry.note_added', owner.owner_email);
    } else if (action === 'set_status') {
      const next = cleanHeader(req.body?.status, 32);
      if (!TRACK_STATUSES.includes(next) || !canTransition(enquiry.status, next)) throw new TrackError(400, 'That status change is not available for this enquiry.', 'STATUS_TRANSITION_INVALID');
      await sql`UPDATE track_enquiries SET status = ${next}, updated_at = NOW(), last_activity_at = NOW(), completed_at = CASE WHEN ${next} = 'COMPLETED' THEN NOW() ELSE completed_at END, closed_at = CASE WHEN ${next} = 'CLOSED' THEN NOW() ELSE closed_at END WHERE id = ${enquiry.id}`;
      await createActivity(enquiry.id, 'enquiry.status_changed', owner.owner_email, { from: enquiry.status, to: next });
    } else if (action === 'set_priority') {
      const priority = cleanHeader(req.body?.priority, 16);
      if (!TRACK_PRIORITIES.includes(priority)) throw new TrackError(400, 'That priority is not available.', 'PRIORITY_INVALID');
      await sql`UPDATE track_enquiries SET priority = ${priority}, updated_at = NOW(), last_activity_at = NOW() WHERE id = ${enquiry.id}`;
      await createActivity(enquiry.id, 'enquiry.priority_changed', owner.owner_email, { priority });
    } else if (action === 'set_follow_up') {
      const followUpAt = new Date(req.body?.followUpAt);
      if (Number.isNaN(followUpAt.getTime()) || followUpAt <= new Date()) throw new TrackError(400, 'Choose a future follow-up time.', 'FOLLOW_UP_INVALID');
      await sql`UPDATE track_enquiries SET follow_up_at = ${followUpAt}, updated_at = NOW(), last_activity_at = NOW(), status = status WHERE id = ${enquiry.id}`;
      await createActivity(enquiry.id, 'enquiry.followup_set', owner.owner_email, { followUpAt: followUpAt.toISOString() });
    } else if (action === 'privacy_request') {
      const type = cleanHeader(req.body?.requestType, 24);
      if (!privacyTypes.includes(type)) throw new TrackError(400, 'Choose a valid privacy request type.', 'PRIVACY_REQUEST_INVALID');
      const requestReference = privacyReference();
      await sql`INSERT INTO track_privacy_requests (request_reference, enquiry_id, email, request_type, notes) VALUES (${requestReference}, ${enquiry.id}, ${enquiry.email}, ${type}, ${cleanText(req.body?.notes, 1000) || null})`;
      if (type === 'ERASURE') await sql`UPDATE track_enquiries SET status = 'ERASURE_PENDING', updated_at = NOW(), last_activity_at = NOW() WHERE id = ${enquiry.id}`;
      await createActivity(enquiry.id, 'privacy.request_received', owner.owner_email, { requestReference, type });
    } else if (action === 'erase') {
      if (req.body?.confirm !== 'ERASE') throw new TrackError(400, 'Type ERASE to confirm this irreversible action.', 'ERASURE_CONFIRMATION_REQUIRED');
      if (enquiry.status !== 'ERASURE_PENDING') throw new TrackError(400, 'Start and review a privacy workflow before erasing data.', 'ERASURE_WORKFLOW_REQUIRED');
      const redactedEmail = `erased-${enquiry.id}@redacted.invalid`;
      await sql`UPDATE track_enquiries SET name = 'Erased contact', email = ${redactedEmail}, subject = '[Erased]', message = '[Personal content erased]', status = 'ERASED', priority = 'NORMAL', follow_up_at = NULL, updated_at = NOW(), last_activity_at = NOW() WHERE id = ${enquiry.id}`;
      await sql`UPDATE track_email_events SET recipient = '[Erased]' WHERE enquiry_id = ${enquiry.id}`;
      await sql`UPDATE track_privacy_requests SET email = '[Erased]', status = 'COMPLETED', completed_at = NOW() WHERE enquiry_id = ${enquiry.id} AND status <> 'COMPLETED'`;
      await createActivity(enquiry.id, 'privacy.erasure_completed', owner.owner_email, { completed: true });
    } else {
      throw new TrackError(400, 'That tracker action is not available.', 'ACTION_INVALID');
    }
    return json(res, 200, { ok: true });
  } catch (error) {
    if (error instanceof TrackError) return json(res, error.status, { ok: false, code: error.code, message: error.message });
    console.error('track.enquiry.action.failed', { message: error instanceof Error ? error.message : 'unknown' });
    return json(res, 503, { ok: false, message: 'The tracker could not save that change.' });
  }
}
