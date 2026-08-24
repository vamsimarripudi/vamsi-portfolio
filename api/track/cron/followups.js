import { createActivity, createEmailEvent, emailShell, json, query, sendResend, TRACK_OWNER_EMAIL } from '../../../lib/track.js';

const authorized = (req) => {
  const secret = process.env.CRON_SECRET?.trim();
  return Boolean(secret && req.headers.authorization === `Bearer ${secret}`);
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return json(res, 405, { ok: false, message: 'Method not allowed.' });
  if (!authorized(req)) return json(res, 401, { ok: false, message: 'Unauthorized.' });

  try {
    const sql = query();
    const due = await sql`
      UPDATE track_enquiries
      SET status = 'FOLLOW_UP_DUE', updated_at = NOW(), last_activity_at = NOW()
      WHERE follow_up_at <= NOW()
        AND status NOT IN ('COMPLETED', 'CLOSED', 'SPAM', 'ERASED', 'ERASURE_PENDING', 'FOLLOW_UP_DUE')
      RETURNING id, reference_id, name, email, intent, subject, follow_up_at`;

    for (const enquiry of due) {
      await createActivity(enquiry.id, 'enquiry.followup_due', 'system', { followUpAt: enquiry.follow_up_at });
      try {
        const subject = `Follow-up due · ${enquiry.reference_id} · ${enquiry.name}`;
        const messageId = await sendResend({
          to: TRACK_OWNER_EMAIL,
          replyTo: TRACK_OWNER_EMAIL,
          subject,
          text: `A follow-up is due for ${enquiry.reference_id}.\n\n${enquiry.name} · ${enquiry.email}\n${enquiry.intent}\n${enquiry.subject || 'No subject'}\n\nOpen the private tracker: https://vamsimarripudi.tech/track/enquiries/${enquiry.reference_id}`,
          html: emailShell({ preheader: `Follow-up due for ${enquiry.reference_id}.`, body: `<tr><td style="padding:30px"><p style="margin:0 0 10px;color:#64665f;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">Follow-up due</p><h1 style="margin:0 0 12px;font-size:25px">${enquiry.reference_id}</h1><p style="line-height:1.6;color:#4f514b">${enquiry.name} · ${enquiry.intent}</p><p><a href="https://vamsimarripudi.tech/track/enquiries/${enquiry.reference_id}" style="display:inline-block;padding:12px 16px;background:#171816;color:#fff;text-decoration:none">Open Enquiry Tracker</a></p></td></tr>` }),
          idempotencyKey: `track-follow-up-${enquiry.id}-${new Date(enquiry.follow_up_at).toISOString()}`,
          tags: [{ name: 'type', value: 'track-follow-up' }, { name: 'reference', value: enquiry.reference_id }],
        });
        await createEmailEvent({ enquiryId: enquiry.id, providerMessageId: messageId, emailType: 'follow_up_reminder', recipient: TRACK_OWNER_EMAIL, status: 'SENT' });
      } catch (error) {
        await createEmailEvent({ enquiryId: enquiry.id, emailType: 'follow_up_reminder', recipient: TRACK_OWNER_EMAIL, status: 'FAILED', failureCode: error.code || 'UNKNOWN' });
      }
    }
    return json(res, 200, { ok: true, processed: due.length });
  } catch (error) {
    console.error('track.cron.followups.failed', { message: error instanceof Error ? error.message : 'unknown' });
    return json(res, 503, { ok: false, message: 'Follow-up processing is temporarily unavailable.' });
  }
}
