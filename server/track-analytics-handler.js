import { json, requireOwner } from '../api/lib/track.js';
import { loadEnquiryAnalytics, loadGa4, safeAnalyticsError } from './track-analytics.js';

// Dependency injection allows testing authorization and upstream failures without production credentials.
export function createAnalyticsHandler({ authorize = requireOwner, enquiries = loadEnquiryAnalytics, ga4 = loadGa4 } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Vary', 'Cookie');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return json(res, 405, { ok: false, message: 'Method not allowed.' }); }
    const owner = await authorize(req, res);
    if (!owner) return;
    const input = req.query || {};
    if (Object.keys(input).some(key => !['source', 'range', 'start', 'end', 'compare'].includes(key)) ||
      Object.values(input).some(value => typeof value !== 'string' || value.length > 32) ||
      !['enquiries', 'ga4'].includes(input.source || 'enquiries')) {
      return json(res, 400, { ok: false, code: 'INVALID_QUERY', message: 'Use a supported analytics source and date range.' });
    }
    try {
      const report = await (input.source === 'ga4' ? ga4(input) : enquiries(input));
      return json(res, 200, { ok: true, report });
    } catch (error) {
      const safe = safeAnalyticsError(error);
      if (safe.status === 429) res.setHeader('Retry-After', '60');
      // Never log provider bodies, JWTs, credentials, SQL, or personal data.
      if (safe.status >= 500) console.error('track.analytics.failed', { code: safe.code });
      return json(res, safe.status, { ok: false, code: safe.code, message: safe.message });
    }
  };
}
export default createAnalyticsHandler();
