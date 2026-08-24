import { TrackError, json, listEnquiries, requireOwner } from '../../../lib/track.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { ok: false, message: 'Method not allowed.' });
  const owner = await requireOwner(req, res);
  if (!owner) return;
  try {
    const data = await listEnquiries(req.query || {});
    return json(res, 200, { ok: true, ...data });
  } catch (error) {
    if (error instanceof TrackError) return json(res, error.status, { ok: false, code: error.code, message: error.message });
    console.error('track.enquiries.list.failed', { message: error instanceof Error ? error.message : 'unknown' });
    return json(res, 503, { ok: false, message: 'Tracker data is temporarily unavailable.' });
  }
}
