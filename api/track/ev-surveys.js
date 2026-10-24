import { assertSameOrigin, json, requireOwner, TrackError } from '../lib/track.js';
import { readSurveyDashboard, deleteSurveyRecord } from '../../server/ev-survey-store.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  if (!['GET', 'DELETE'].includes(req.method)) return json(res, 405, { ok: false, message: 'Method not allowed.' });
  const owner = await requireOwner(req, res);
  if (!owner) return;
  try {
    if (req.method === 'DELETE') {
      assertSameOrigin(req);
      if (req.body?.confirm !== 'DELETE') throw new TrackError(400, 'Type DELETE to confirm erasure.', 'SURVEY_CONFIRM');
      const referenceId = await deleteSurveyRecord(req.body?.referenceId);
      return json(res, 200, { ok: true, referenceId, message: 'Interview record erased.' });
    }
    const exportCsv = req.query?.format === 'csv';
    const result = await readSurveyDashboard({ q: req.query?.q, page: req.query?.page, download: exportCsv });
    if (exportCsv) {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="ev-owner-survey.csv"');
      return res.status(200).send('\uFEFF' + result.csv);
    }
    return json(res, 200, { ok: true, ...result });
  } catch (error) {
    if (error instanceof TrackError) return json(res, error.status, { ok: false, code: error.code, message: error.message });
    console.error('ev-survey.dashboard.failed', { message: error instanceof Error ? error.message : 'unknown' });
    return json(res, 503, { ok: false, message: 'Survey reports are temporarily unavailable.' });
  }
}
