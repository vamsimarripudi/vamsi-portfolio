import { createHash, randomBytes } from 'node:crypto';
import { createEmailEvent, createEnquiry } from './lib/track.js';

const DEFAULT_RECIPIENT = 'enquiry.portfolio@vamsimarripudi.tech';
const SITE_URL = 'https://vamsimarripudi.tech';
const MAX_REQUESTS = 3;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;
const attempts = new Map();
const submissions = new Map();

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const clean = (value) => typeof value === 'string' ? value.trim() : '';
const cleanHeader = (value) => clean(value).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ');
const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && !/[\r\n]/.test(value);

const takeRateLimitSlot = (key) => {
  const now = Date.now();
  const recent = (attempts.get(key) || []).filter((time) => now - time < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= MAX_REQUESTS) return false;
  recent.push(now);
  attempts.set(key, recent);
  return true;
};

const getClientKey = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return (raw || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
};

const referenceId = () => `VM-ENQ-${new Date().getFullYear()}-${randomBytes(4).toString('hex').toUpperCase().slice(0, 6)}`;
const fingerprint = ({ name, email, reason, message }) => createHash('sha256')
  .update(`${name}\u0000${email}\u0000${reason}\u0000${message}`)
  .digest('hex');

const formatSubmittedAt = (date = new Date()) => new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: 'Asia/Kolkata',
  timeZoneName: 'short',
}).format(date);

const preheader = (text) => `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;opacity:0;color:transparent;">${escapeHtml(text)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>`;

const emailShell = ({ preheaderText, body }) => `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
  <body style="margin:0;padding:0;background:#f5f5f3;color:#171816;font-family:Arial,Helvetica,sans-serif;">
    ${preheader(preheaderText)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#f5f5f3;">
      <tr><td align="center" style="padding:24px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:620px;background:#ffffff;border:1px solid #deded8;border-radius:14px;overflow:hidden;">
          <tr><td style="padding:26px 32px 20px;border-bottom:1px solid #deded8;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
              <td style="padding-right:12px;font-size:20px;line-height:20px;font-weight:800;letter-spacing:-2px;color:#171816;">VM<span style="color:#db4c2f;">.</span></td>
              <td><div style="font-size:14px;line-height:19px;font-weight:700;color:#171816;">Vamsi Marripudi</div><div style="font-size:12px;line-height:17px;color:#64665f;">Founder Engineer</div></td>
            </tr></table>
          </td></tr>
          ${body}
          <tr><td style="padding:20px 32px 26px;border-top:1px solid #deded8;color:#64665f;font-size:12px;line-height:18px;">
            <strong style="color:#171816;">Vamsi Marripudi</strong> · Founder Engineer<br>
            <a href="${SITE_URL}" style="color:#171816;text-decoration:underline;">vamsimarripudi.tech</a> · <a href="${SITE_URL}/privacy" style="color:#171816;text-decoration:underline;">Privacy Notice</a> · <a href="mailto:${DEFAULT_RECIPIENT}" style="color:#171816;text-decoration:underline;overflow-wrap:anywhere;">${DEFAULT_RECIPIENT}</a>
            <div style="margin-top:10px;">${escapeHtml('You received this message because you contacted Vamsi through vamsimarripudi.tech.')}</div>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

const detailRow = (label, value, href) => `<tr>
  <td style="padding:10px 0;border-bottom:1px solid #ecece7;color:#64665f;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;vertical-align:top;width:34%;">${escapeHtml(label)}</td>
  <td style="padding:10px 0;border-bottom:1px solid #ecece7;color:#171816;font-size:14px;line-height:20px;overflow-wrap:anywhere;">${href ? `<a href="${escapeHtml(href)}" style="color:#171816;text-decoration:underline;">${escapeHtml(value)}</a>` : escapeHtml(value)}</td>
</tr>`;

const card = (label, value) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#f5f5f3;border:1px solid #deded8;border-radius:10px;"><tr><td style="padding:16px 18px;"><div style="color:#64665f;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;">${escapeHtml(label)}</div><div style="margin-top:6px;color:#171816;font-size:16px;font-weight:700;line-height:22px;overflow-wrap:anywhere;">${escapeHtml(value)}</div></td></tr></table>`;

const button = (href, label) => `<a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 17px;background:#171816;border-radius:7px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">${escapeHtml(label)}&nbsp;&nbsp;→</a>`;

const ownerEmail = (entry) => {
  const replyUrl = `mailto:${encodeURIComponent(entry.email)}?subject=${encodeURIComponent(`Re: ${entry.referenceId}`)}`;
  const trackerUrl = `${SITE_URL}/track/enquiries/${encodeURIComponent(entry.referenceId)}`;
  return {
    subject: `New ${entry.reason} enquiry · ${entry.referenceId} · ${entry.name}`,
    text: `NEW ENQUIRY\n\nReference: ${entry.referenceId}\nStatus: NEW\nSubmitted: ${entry.submittedAt}\n\nName: ${entry.name}\nEmail: ${entry.email}\nIntent: ${entry.reason}\n\nMESSAGE\n${entry.message}\n\nReply directly to this email to respond to ${entry.name}.\n\nOpen the private Enquiry Tracker: ${trackerUrl}\n\n${SITE_URL}`,
    html: emailShell({
      preheaderText: `New ${entry.reason} enquiry from ${entry.name}.`,
      body: `<tr><td style="padding:32px;"><div style="color:#db4c2f;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;">New enquiry · <span style="display:inline-block;padding:3px 7px;border:1px solid #db4c2f;border-radius:999px;">NEW</span></div><h1 style="margin:12px 0 7px;color:#171816;font-size:28px;line-height:34px;letter-spacing:-.5px;">${escapeHtml(entry.reason)}</h1><p style="margin:0 0 24px;color:#64665f;font-size:14px;line-height:21px;">Reference ${escapeHtml(entry.referenceId)} · ${escapeHtml(entry.submittedAt)}</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 25px;">${detailRow('Name', entry.name)}${detailRow('Email', entry.email, `mailto:${entry.email}`)}${detailRow('Intent', entry.reason)}${detailRow('Reference', entry.referenceId)}${detailRow('Submitted', entry.submittedAt)}</table><div style="margin:0 0 8px;color:#64665f;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;">Message</div><div style="padding:17px 18px;margin-bottom:25px;background:#f5f5f3;border:1px solid #deded8;border-radius:10px;color:#171816;font-size:14px;line-height:21px;white-space:pre-wrap;overflow-wrap:anywhere;">${escapeHtml(entry.message)}</div>${button(replyUrl, `Reply to ${entry.name}`)}&nbsp;&nbsp;${button(trackerUrl, `Open Enquiry Tracker`)}</td></tr>`,
    }),
  };
};

const confirmationEmail = (entry) => ({
  subject: `Enquiry received · ${entry.referenceId}`,
  text: `Hi ${entry.name},\n\nThank you for reaching out. Your enquiry has been received successfully and is now in my review queue.\n\nReference: ${entry.referenceId}\nEnquiry type: ${entry.reason}\n\nI’ll review the details you shared and reply directly to this email thread as soon as practical. You do not need to submit the form again.\n\nRegards,\nVamsi Marripudi\nFounder Engineer\n${SITE_URL}\n${DEFAULT_RECIPIENT}`,
  html: emailShell({
    preheaderText: 'Your enquiry has been received successfully.',
    body: `<tr><td style="padding:32px;"><h1 style="margin:0 0 16px;color:#171816;font-size:28px;line-height:34px;letter-spacing:-.5px;">Enquiry received</h1><p style="margin:0 0 20px;color:#171816;font-size:15px;line-height:23px;">Hi ${escapeHtml(entry.name)},</p><p style="margin:0 0 24px;color:#4f514b;font-size:15px;line-height:23px;">Thank you for reaching out. Your enquiry has been received successfully and is now in my review queue.</p>${card('Reference', entry.referenceId)}<div style="height:12px;line-height:12px;">&nbsp;</div>${card('Enquiry type', entry.reason)}<p style="margin:24px 0;color:#4f514b;font-size:15px;line-height:23px;">I’ll review the details you shared and reply directly to this email thread as soon as practical. You do not need to submit the form again.</p>${button(SITE_URL, 'Visit vamsimarripudi.tech')}</td></tr>`,
  }),
});

const sendEmail = async ({ apiKey, from, to, replyTo, email, tags }) => {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], reply_to: replyTo, subject: email.subject, text: email.text, html: email.html, tags }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`resend_${response.status}`);
  return data.id;
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, message: 'Method not allowed.' });
  }

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); } catch { return res.status(400).json({ ok: false, message: 'Please check the form and try again.' }); }
  const rawName = clean(body.name);
  const rawEmail = clean(body.email);
  const rawReason = clean(body.reason);
  const rawMessage = clean(body.message);
  const company = clean(body.company);

  if (company) return res.status(200).json({ ok: true });
  if (!rawName || rawName.length > 100 || !isEmail(rawEmail) || !rawReason || rawReason.length > 100 || rawMessage.length < 12 || rawMessage.length > 2000) {
    return res.status(400).json({ ok: false, message: 'Please check the highlighted fields and try again.' });
  }

  const entry = { name: cleanHeader(rawName), email: rawEmail.toLowerCase(), reason: cleanHeader(rawReason), message: rawMessage, submittedAt: formatSubmittedAt() };
  const clientKey = getClientKey(req);
  if (!takeRateLimitSlot(clientKey)) return res.status(429).json({ ok: false, message: 'Please wait a few minutes before sending another message.' });

  const key = fingerprint(entry);
  const earlier = submissions.get(key);
  if (earlier && Date.now() - earlier.createdAt < DUPLICATE_WINDOW_MS) {
    return res.status(200).json({ ok: true, duplicate: true, referenceId: earlier.referenceId, confirmationSent: earlier.confirmationSent, message: 'This enquiry was already received. You do not need to submit it again.' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_FROM_EMAIL;
  const recipient = DEFAULT_RECIPIENT;
  if (!apiKey || !from || !isEmail(recipient)) {
    console.error('contact.configuration_missing');
    return res.status(503).json({ ok: false, message: `Message delivery is temporarily unavailable. Please email ${DEFAULT_RECIPIENT} directly.` });
  }

  entry.referenceId = referenceId();
  let trackerEnquiry = null;
  try {
    trackerEnquiry = await createEnquiry({ referenceId: entry.referenceId, name: entry.name, email: entry.email, intent: entry.reason, subject: '', message: entry.message });
  } catch (error) {
    console.error('contact.tracker_record.failed', { referenceId: entry.referenceId, code: error?.code || 'UNKNOWN' });
  }
  try {
    const ownerEmailId = await sendEmail({ apiKey, from, to: recipient, replyTo: entry.email, email: ownerEmail(entry), tags: [{ name: 'type', value: 'contact-owner' }, { name: 'intent', value: entry.reason.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50) }, { name: 'reference', value: entry.referenceId }] });
    console.info('contact.owner_email.sent', { referenceId: entry.referenceId, providerMessageId: ownerEmailId });
    if (trackerEnquiry) await createEmailEvent({ enquiryId: trackerEnquiry.id, providerMessageId: ownerEmailId, emailType: 'owner_notification', recipient, status: 'SENT' });
  } catch (error) {
    console.error('contact.owner_email.failed', { referenceId: entry.referenceId, error: error instanceof Error ? error.message : 'unknown' });
    return res.status(502).json({ ok: false, message: `Message delivery is temporarily unavailable. Please email ${DEFAULT_RECIPIENT} directly.` });
  }

  let confirmationSent = false;
  try {
    const confirmationEmailId = await sendEmail({ apiKey, from, to: entry.email, replyTo: recipient, email: confirmationEmail(entry), tags: [{ name: 'type', value: 'contact-confirmation' }, { name: 'intent', value: entry.reason.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50) }, { name: 'reference', value: entry.referenceId }] });
    confirmationSent = true;
    console.info('contact.confirmation.sent', { referenceId: entry.referenceId, providerMessageId: confirmationEmailId });
    if (trackerEnquiry) await createEmailEvent({ enquiryId: trackerEnquiry.id, providerMessageId: confirmationEmailId, emailType: 'confirmation', recipient: entry.email, status: 'SENT' });
  } catch (error) {
    console.error('contact.confirmation.failed', { referenceId: entry.referenceId, error: error instanceof Error ? error.message : 'unknown' });
    if (trackerEnquiry) { try { await createEmailEvent({ enquiryId: trackerEnquiry.id, emailType: 'confirmation', recipient: entry.email, status: 'FAILED', failureCode: error?.message || 'UNKNOWN' }); } catch { /* Tracker logging is non-critical to public email delivery. */ } }
  }

  submissions.set(key, { createdAt: Date.now(), referenceId: entry.referenceId, confirmationSent });
  return res.status(200).json({ ok: true, referenceId: entry.referenceId, confirmationSent, message: confirmationSent ? 'Your enquiry has been received. A confirmation is on its way.' : 'Your enquiry has been received. Vamsi will reply directly to the email address you provided.' });
}
