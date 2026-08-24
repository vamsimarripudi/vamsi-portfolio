import { json, requireOwner } from '../../lib/track.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { ok: false, message: 'Method not allowed.' });
  const owner = await requireOwner(req, res);
  if (!owner) return;
  return json(res, 200, { ok: true, owner: owner.owner_email, expiresAt: owner.expires_at });
}
