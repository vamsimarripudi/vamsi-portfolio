import { TrackError, consumeMagicLink, setSession } from '../../lib/track.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') return res.status(405).send('Method not allowed.');
    const token = typeof req.query?.token === 'string' ? req.query.token : '';
    if (!token || token.length > 200) throw new TrackError(401, 'This sign-in link is invalid or has expired.', 'AUTH_LINK_INVALID');
    const sessionId = await consumeMagicLink(token);
    setSession(res, sessionId);
    res.writeHead(302, { Location: '/track' });
    return res.end();
  } catch (error) {
    const code = error instanceof TrackError ? error.code : 'TRACK_AUTH_UNAVAILABLE';
    return res.writeHead(302, { Location: `/track?auth=${encodeURIComponent(code)}` }).end();
  }
}
