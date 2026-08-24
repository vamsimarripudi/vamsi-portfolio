import { neon } from '@neondatabase/serverless';
import { createHash, createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';

export const TRACK_OWNER_EMAIL = 'enquiry.portfolio@vamsimarripudi.tech';
export const TRACK_STATUSES = ['NEW', 'ACKNOWLEDGED', 'REVIEWING', 'REPLIED', 'FOLLOW_UP_DUE', 'WAITING_ON_CONTACT', 'COMPLETED', 'CLOSED', 'SPAM', 'ERASURE_PENDING', 'ERASED'];
export const TRACK_PRIORITIES = ['NORMAL', 'HIGH', 'URGENT'];

const SITE_URL = 'https://vamsimarripudi.tech';
const SESSION_COOKIE = 'vm_track_session';

export class TrackError extends Error {
  constructor(status, message, code = 'TRACK_ERROR') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const environment = (name) => process.env[name]?.trim();
const databaseUrl = () => {
  const value = environment('DATABASE_URL');
  if (!value) throw new TrackError(503, 'Tracker storage is not configured.', 'TRACK_STORAGE_UNAVAILABLE');
  return value;
};

export const query = () => neon(databaseUrl());
const valueHash = (value) => createHash('sha256').update(String(value)).digest('hex');
const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');
const ownerEmail = () => {
  const configured = environment('TRACK_OWNER_EMAIL');
  if (configured && configured !== TRACK_OWNER_EMAIL) throw new TrackError(503, 'Tracker owner configuration is invalid.', 'TRACK_OWNER_INVALID');
  return TRACK_OWNER_EMAIL;
};

export const json = (res, status, payload) => res.status(status).json(payload);

export const cleanText = (value, max = 2000) => typeof value === 'string' ? value.trim().slice(0, max) : '';
export const cleanHeader = (value, max = 140) => cleanText(value, max).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ');
export const emailIsValid = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && !/[\r\n]/.test(value);

export const requireMethod = (req, method) => {
  if (req.method !== method) throw new TrackError(405, 'Method not allowed.', 'METHOD_NOT_ALLOWED');
};

export const assertSameOrigin = (req) => {
  const origin = req.headers.origin;
  if (!origin) return;
  const previewOrigin = environment('VERCEL_URL') ? ('https://' + environment('VERCEL_URL')) : '';
  const allowed = new Set([SITE_URL, previewOrigin, 'http://localhost:5173']);
  if (!allowed.has(origin)) throw new TrackError(403, 'Request origin was not accepted.', 'ORIGIN_REJECTED');
};

const sign = (value) => {
  const secret = environment('TRACK_SESSION_SECRET');
  if (!secret) throw new TrackError(503, 'Tracker authentication is not configured.', 'TRACK_AUTH_UNAVAILABLE');
  return createHmac('sha256', secret).update(value).digest('base64url');
};

const safeEqual = (left, right) => {
  const a = Buffer.from(left || '');
  const b = Buffer.from(right || '');
  return a.length === b.length && timingSafeEqual(a, b);
};

const parseCookies = (header = '') => Object.fromEntries(header.split(';').map((part) => {
  const index = part.indexOf('=');
  return index < 0 ? [] : [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
}).filter((entry) => entry.length));

const sessionCookie = (id, maxAge = 60 * 60 * 8) => `${SESSION_COOKIE}=${encodeURIComponent(`${id}.${sign(id)}`)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
export const clearSessionCookie = () => `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

export const getAuthenticatedOwner = async (req) => {
  const cookie = parseCookies(req.headers.cookie || '')[SESSION_COOKIE];
  const [sessionId, signature] = (cookie || '').split('.');
  if (!sessionId || !signature || !safeEqual(signature, sign(sessionId))) throw new TrackError(401, 'Your tracker session has expired. Sign in again.', 'SESSION_EXPIRED');
  const rows = await query()`SELECT id, owner_email, expires_at FROM track_sessions WHERE id = ${sessionId} AND revoked_at IS NULL AND expires_at > NOW() LIMIT 1`;
  const session = rows[0];
  if (!session || session.owner_email !== ownerEmail()) throw new TrackError(401, 'Your tracker session has expired. Sign in again.', 'SESSION_EXPIRED');
  return session;
};

export const requireOwner = async (req, res) => {
  try {
    return await getAuthenticatedOwner(req);
  } catch (error) {
    if (error instanceof TrackError) json(res, error.status, { ok: false, code: error.code, message: error.message });
    else json(res, 503, { ok: false, code: 'TRACK_STORAGE_UNAVAILABLE', message: 'Tracker storage is temporarily unavailable.' });
    return null;
  }
};

export const createActivity = async (enquiryId, eventType, actorId = 'system', metadata = {}) => query()`
  INSERT INTO track_activity_events (enquiry_id, event_type, actor_id, metadata_json)
  VALUES (${enquiryId}, ${eventType}, ${actorId}, ${JSON.stringify(metadata)})`;

export const createEmailEvent = async ({ enquiryId, providerMessageId, emailType, recipient, status, failureCode = null }) => {
  const rows = await query()`
    INSERT INTO track_email_events (enquiry_id, provider, provider_message_id, email_type, recipient, status, sent_at, failed_at, failure_code)
    VALUES (${enquiryId}, 'resend', ${providerMessageId || null}, ${emailType}, ${recipient}, ${status}, ${status === 'SENT' ? new Date() : null}, ${status === 'FAILED' ? new Date() : null}, ${failureCode})
    RETURNING id`;
  return rows[0];
};

export const createEnquiry = async ({ referenceId, name, email, intent, subject, message }) => {
  const rows = await query()`
    INSERT INTO track_enquiries (reference_id, name, email, intent, subject, message, status, priority, last_activity_at)
    VALUES (${referenceId}, ${name}, ${email}, ${intent}, ${subject}, ${message}, 'NEW', 'NORMAL', NOW())
    RETURNING *`;
  const enquiry = rows[0];
  await createActivity(enquiry.id, 'enquiry.created', 'visitor', { intent });
  return enquiry;
};

export const findEnquiry = async (referenceId) => {
  const rows = await query()`SELECT * FROM track_enquiries WHERE reference_id = ${referenceId} LIMIT 1`;
  return rows[0] || null;
};

export const newReferenceId = () => `VM-ENQ-${new Date().getFullYear()}-${randomBytes(4).toString('hex').toUpperCase().slice(0, 6)}`;

const statusTransitions = {
  NEW: ['ACKNOWLEDGED', 'REVIEWING', 'SPAM', 'ERASURE_PENDING', 'CLOSED'],
  ACKNOWLEDGED: ['REVIEWING', 'REPLIED', 'FOLLOW_UP_DUE', 'SPAM', 'ERASURE_PENDING', 'CLOSED'],
  REVIEWING: ['REPLIED', 'FOLLOW_UP_DUE', 'WAITING_ON_CONTACT', 'COMPLETED', 'SPAM', 'ERASURE_PENDING', 'CLOSED'],
  REPLIED: ['WAITING_ON_CONTACT', 'FOLLOW_UP_DUE', 'COMPLETED', 'ERASURE_PENDING', 'CLOSED'],
  FOLLOW_UP_DUE: ['REVIEWING', 'REPLIED', 'WAITING_ON_CONTACT', 'COMPLETED', 'ERASURE_PENDING', 'CLOSED'],
  WAITING_ON_CONTACT: ['REVIEWING', 'FOLLOW_UP_DUE', 'COMPLETED', 'ERASURE_PENDING', 'CLOSED'],
  COMPLETED: ['CLOSED', 'ERASURE_PENDING'],
  CLOSED: ['REVIEWING', 'ERASURE_PENDING'],
  SPAM: ['CLOSED', 'ERASURE_PENDING'],
  ERASURE_PENDING: ['ERASED', 'REVIEWING'],
  ERASED: [],
};

export const canTransition = (from, to) => statusTransitions[from]?.includes(to) || false;
export const availableTransitions = (from) => statusTransitions[from] || [];

export const sendResend = async ({ to, subject, text, html, replyTo, idempotencyKey, tags = [] }) => {
  const apiKey = environment('RESEND_API_KEY');
  const from = environment('CONTACT_FROM_EMAIL');
  if (!apiKey || !from) throw new TrackError(503, 'Email delivery is not configured.', 'EMAIL_UNAVAILABLE');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({ from, to: [to], reply_to: replyTo, subject, text, html, tags }),
  });
  if (!response.ok) throw new TrackError(502, 'Email delivery is temporarily unavailable.', `RESEND_${response.status}`);
  const payload = await response.json();
  return payload.id || payload.data?.id || null;
};

export const emailShell = ({ preheader, body }) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f5f5f3;color:#171816;font-family:Arial,Helvetica,sans-serif"><div style="display:none;max-height:0;overflow:hidden;opacity:0">${preheader}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fff;border:1px solid #deded8;border-radius:14px"><tr><td style="padding:24px 30px;border-bottom:1px solid #deded8"><strong style="font-size:20px;letter-spacing:-1px">VM<span style="color:#db4c2f">.</span></strong><span style="margin-left:12px;font-size:13px"><strong>Vamsi Marripudi</strong><br>Founder Engineer</span></td></tr>${body}<tr><td style="padding:18px 30px;border-top:1px solid #deded8;color:#64665f;font-size:12px;line-height:18px"><a href="${SITE_URL}" style="color:#171816">vamsimarripudi.tech</a> · <a href="${SITE_URL}/privacy" style="color:#171816">Privacy Notice</a> · <a href="mailto:${TRACK_OWNER_EMAIL}" style="color:#171816">${TRACK_OWNER_EMAIL}</a></td></tr></table></td></tr></table></body></html>`;

export const escapeHtml = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');

const otpHash = (challengeId, code) => valueHash(`${challengeId}:${code}:${sign(challengeId)}`);
const newOtp = () => randomInt(100000, 1000000).toString();

export const requestOtp = async () => {
  const challengeId = randomUUID();
  const code = newOtp();
  const tokenHash = otpHash(challengeId, code);
  await query()`UPDATE track_auth_tokens SET consumed_at = NOW() WHERE owner_email = ${ownerEmail()} AND consumed_at IS NULL`;
  await query()`INSERT INTO track_auth_tokens (id, token_hash, owner_email, expires_at) VALUES (${challengeId}, ${tokenHash}, ${ownerEmail()}, NOW() + INTERVAL '10 minutes')`;
  const messageId = await sendResend({
    to: ownerEmail(),
    replyTo: TRACK_OWNER_EMAIL,
    subject: 'Your Enquiry Tracker verification code',
    text: `Your Enquiry Tracker verification code is ${code}.\n\nIt expires in 10 minutes and can be used once. If you did not request it, ignore this email.`,
    html: emailShell({ preheader: 'Your Enquiry Tracker verification code.', body: `<tr><td style="padding:30px"><h1 style="margin:0 0 14px;font-size:25px">Verify your sign-in</h1><p style="color:#4f514b;line-height:1.6">Enter this one-time code in Enquiry Tracker. It expires in 10 minutes.</p><p style="margin:24px 0;padding:16px 18px;border:1px solid #deded8;background:#f5f5f3;font-size:30px;font-weight:800;letter-spacing:.24em;text-align:center">${code}</p><p style="color:#64665f;font-size:13px;line-height:1.5">If you did not request this code, you can ignore this email.</p></td></tr>` }),
    idempotencyKey: `track-otp-${challengeId}`,
    tags: [{ name: 'type', value: 'track-otp' }],
  });
  return { challengeId, messageId };
};

export const consumeOtp = async ({ challengeId, code }) => {
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(challengeId) || !/^\d{6}$/.test(code)) throw new TrackError(401, 'This verification code is invalid or has expired.', 'OTP_INVALID');
  const tokenHash = otpHash(challengeId, code);
  const rows = await query()`UPDATE track_auth_tokens SET consumed_at = NOW() WHERE id = ${challengeId} AND token_hash = ${tokenHash} AND owner_email = ${ownerEmail()} AND consumed_at IS NULL AND expires_at > NOW() RETURNING id, owner_email`;
  const tokenRecord = rows[0];
  if (!tokenRecord) throw new TrackError(401, 'This verification code is invalid or has expired.', 'OTP_INVALID');
  const id = randomToken(24);
  await query()`INSERT INTO track_sessions (id, owner_email, expires_at) VALUES (${id}, ${ownerEmail()}, NOW() + INTERVAL '8 hours')`;
  return id;
};
export const setSession = (res, id) => res.setHeader('Set-Cookie', sessionCookie(id));

export const closeSession = async (req, res) => {
  const cookie = parseCookies(req.headers.cookie || '')[SESSION_COOKIE];
  const [sessionId, signature] = (cookie || '').split('.');
  if (sessionId && signature && safeEqual(signature, sign(sessionId))) await query()`UPDATE track_sessions SET revoked_at = NOW() WHERE id = ${sessionId}`;
  res.setHeader('Set-Cookie', clearSessionCookie());
};

export const listEnquiries = async ({ query: searchText = '', status = '', intent = '', page = 1, limit = 25 }) => {
  const currentPage = Math.max(1, Math.min(Number(page) || 1, 10000));
  const pageSize = Math.max(1, Math.min(Number(limit) || 25, 50));
  const search = `%${cleanText(searchText, 160).toLowerCase()}%`;
  const checkedStatus = TRACK_STATUSES.includes(status) ? status : '';
  const checkedIntent = cleanHeader(intent, 100);
  const rows = await query()`
    SELECT e.reference_id, e.name, e.email, e.intent, e.subject, e.status, e.priority, e.created_at, e.updated_at, e.last_activity_at, e.follow_up_at,
      (SELECT status FROM track_email_events m WHERE m.enquiry_id = e.id ORDER BY m.created_at DESC LIMIT 1) AS email_status,
      COUNT(*) OVER()::int AS total
    FROM track_enquiries e
    WHERE (${checkedStatus} = '' OR e.status = ${checkedStatus})
      AND (${checkedIntent} = '' OR e.intent = ${checkedIntent})
      AND (${search} = '%%' OR LOWER(e.reference_id) LIKE ${search} OR LOWER(e.name) LIKE ${search} OR LOWER(e.email) LIKE ${search} OR LOWER(e.subject) LIKE ${search} OR LOWER(e.message) LIKE ${search})
    ORDER BY CASE WHEN e.follow_up_at IS NOT NULL AND e.follow_up_at <= NOW() THEN 0 ELSE 1 END, e.last_activity_at DESC
    LIMIT ${pageSize} OFFSET ${(currentPage - 1) * pageSize}`;
  return { items: rows, total: rows[0]?.total || 0, page: currentPage, limit: pageSize };
};
