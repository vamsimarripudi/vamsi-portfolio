import { TRACK_OWNER_EMAIL, TrackError, assertSameOrigin, json, requireMethod, requestMagicLink } from '../../lib/track.js';

const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 3;

const canRequest = (key) => {
  const now = Date.now();
  const values = (attempts.get(key) || []).filter((time) => now - time < WINDOW_MS);
  if (values.length >= MAX_ATTEMPTS) return false;
  values.push(now);
  attempts.set(key, values);
  return true;
};

export default async function handler(req, res) {
  try {
    requireMethod(req, 'POST');
    assertSameOrigin(req);
    const forwarded = req.headers['x-forwarded-for'];
    const client = (Array.isArray(forwarded) ? forwarded[0] : forwarded || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
    if (!canRequest(client)) return json(res, 429, { ok: false, message: 'Please wait before requesting another sign-in link.' });
    const submitted = String(req.body?.email || '').trim().toLowerCase();
    if (submitted && submitted !== TRACK_OWNER_EMAIL) return json(res, 403, { ok: false, message: 'This tracker is limited to its approved owner.' });
    await requestMagicLink();
    return json(res, 200, { ok: true, message: `A one-time sign-in link was sent to ${TRACK_OWNER_EMAIL}.` });
  } catch (error) {
    if (error instanceof TrackError) return json(res, error.status, { ok: false, code: error.code, message: error.message });
    console.error('track.auth.request.failed', { message: error instanceof Error ? error.message : 'unknown' });
    return json(res, 503, { ok: false, code: 'TRACK_AUTH_UNAVAILABLE', message: 'Secure sign-in is temporarily unavailable.' });
  }
}
