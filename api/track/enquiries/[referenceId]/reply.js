import { createHash } from 'node:crypto';
import { TrackError, assertSameOrigin, cleanText, createActivity, createEmailEvent, emailShell, escapeHtml, json, query, requireOwner, sendResend } from '../../../../lib/track.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, message: 'Method not allowed.' });
  const owner = await requireOwner(req, res);
  if (!owner) return;
  try {
    assertSameOrigin(req);
    const message = cleanText(req.body?.message, 6000);
    if (message.length < 2) throw new TrackError(400, 'Write a reply before sending.', 'REPLY_INVALID');
    const referenceId = String(req.query?.referenceId || '').trim();
    const sql = query();
    const enquiries = await sql`SELECT * FROM track_enquiries WHERE reference_id = ${referenceId} LIMIT 1`;
    const enquiry = enquiries[0];
    if (!enquiry || enquiry.status === 'ERASED') throw new TrackError(404, 'Enquiry not found.', 'ENQUIRY_NOT_FOUND');
    const subject = cleanText(req.body?.subject, 180) || `Re: ${enquiry.reference_id} — ${enquiry.intent}`;
    let providerMessageId;
    try {
      providerMessageId = await sendResend({
        to: enquiry.email,
        replyTo: 'enquiry.portfolio@vamsimarripudi.tech',
        subject,
        text: `${message}\n\nReference: ${enquiry.reference_id}\nVamsi Marripudi\nFounder Engineer\nhttps://vamsimarripudi.tech`,
        html: emailShell({ preheader: `Reply regarding ${enquiry.reference_id}.`, body: `<tr><td style="padding:30px"><p style="margin:0 0 18px;color:#64665f;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">${escapeHtml(enquiry.reference_id)}</p><div style="white-space:pre-wrap;color:#171816;font-size:15px;line-height:1.65">${escapeHtml(message)}</div></td></tr>` }),
        idempotencyKey: `track-reply-${enquiry.id}-${createHash('sha256').update(`${enquiry.id}:${subject}:${message}`).digest('hex')}`,
        tags: [{ name: 'type', value: 'track-reply' }, { name: 'reference', value: enquiry.reference_id }],
      });
    } catch (error) {
      await createEmailEvent({ enquiryId: enquiry.id, emailType: 'reply', recipient: enquiry.email, status: 'FAILED', failureCode: error.code || 'UNKNOWN' });
      await createActivity(enquiry.id, 'email.reply.failed', owner.owner_email, { code: error.code || 'UNKNOWN' });
      throw error;
    }
    await createEmailEvent({ enquiryId: enquiry.id, providerMessageId, emailType: 'reply', recipient: enquiry.email, status: 'SENT' });
    await sql`UPDATE track_enquiries SET status = 'WAITING_ON_CONTACT', replied_at = NOW(), follow_up_at = NULL, updated_at = NOW(), last_activity_at = NOW() WHERE id = ${enquiry.id}`;
    await createActivity(enquiry.id, 'email.reply.sent', owner.owner_email, { providerMessageId });
    return json(res, 200, { ok: true, providerMessageId });
  } catch (error) {
    if (error instanceof TrackError) return json(res, error.status, { ok: false, code: error.code, message: error.message });
    console.error('track.enquiry.reply.failed', { message: error instanceof Error ? error.message : 'unknown' });
    return json(res, 503, { ok: false, message: 'Reply delivery is temporarily unavailable. Your draft has not been marked as sent.' });
  }
}
