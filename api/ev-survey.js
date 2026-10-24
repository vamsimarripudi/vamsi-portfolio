import { assertSameOrigin, json, TrackError } from './lib/track.js';
import { submitSurvey } from '../server/ev-survey-store.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') return json(res, 405, { ok: false, message: 'Method not allowed.' });
  try {
    assertSameOrigin(req);
    if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) {
      return json(res, 415, { ok: false, message: 'JSON requests only.' });
    }
    const referenceId = await submitSurvey(req, req.body);
    return json(res, 201, { ok: true, referenceId, message: 'Interview recorded securely.' });
  } catch (error) {
    if (error instanceof TrackError) return json(res, error.status, { ok: false, code: error.code, message: error.message });
    console.error('ev-survey.submit.failed', { message: error instanceof Error ? error.message : 'unknown' });
    return json(res, 503, { ok: false, message: 'Survey storage is temporarily unavailable. Please keep your draft and retry.' });
  }
}
