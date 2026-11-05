import { TrackError, assertSameOrigin, consumeOtp, json, requireMethod, setSession } from '../../lib/track.js';

const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const canVerify = (key) => {
  const now = Date.now();
  const values = (attempts.get(key) || []).filter((time) => now - time < WINDOW_MS);
  if (values.length >= MAX_ATTEMPTS) return false;
  values.push(now);
  attempts.set(key, values);
  return true;
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    requireMethod(req, 'POST');
    assertSameOrigin(req);
    const challengeId = String(req.body?.challengeId || '').trim();
    const code = String(req.body?.code || '').trim();
    const forwarded = req.headers['x-forwarded-for'];
    const client = (Array.isArray(forwarded) ? forwarded[0] : forwarded || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
    if (!canVerify(`${client}:${challengeId}`)) return json(res, 429, { ok: false, message: 'Too many code attempts. Request a new code and try again.' });
    const sessionId = await consumeOtp({ challengeId, code });
    setSession(res, sessionId);
    return json(res, 200, { ok: true });
  } catch (error) {
    if (error instanceof TrackError) return json(res, error.status, { ok: false, code: error.code, message: error.message });
    console.error('track.auth.verify.failed', { message: error instanceof Error ? error.message : 'unknown' });
    return json(res, 503, { ok: false, code: 'TRACK_AUTH_UNAVAILABLE', message: 'Secure code verification is temporarily unavailable.' });
  }
}