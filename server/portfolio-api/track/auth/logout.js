import { assertSameOrigin, closeSession, json, requireOwner } from '../../lib/track.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, message: 'Method not allowed.' });
  const owner = await requireOwner(req, res);
  if (!owner) return;
  try {
    assertSameOrigin(req);
    await closeSession(req, res);
    return json(res, 200, { ok: true });
  } catch {
    return json(res, 503, { ok: false, message: 'Could not end the tracker session.' });
  }
}
