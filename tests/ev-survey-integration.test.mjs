import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('public interview and owner-only research routes are wired without exposing Track', () => {
  const app = read('src/App.jsx');
  const track = read('src/Track.jsx');
  const config = JSON.parse(read('vercel.json'));
  assert.match(app, /path="\/ev-survey" element=\{<EVSurvey\/>\}/);
  assert.match(track, /path="ev-surveys" element=\{<Suspense/);
  assert.match(track, /to="\/track\/ev-surveys"/);
  assert.ok(config.rewrites.some(x => x.source === '/track/ev-surveys' && x.destination === '/track/index.html'));
  assert.ok(config.headers.some(x => x.source === '/ev-survey' && x.headers.some(y => y.key === 'X-Robots-Tag')));
  assert.ok(config.rewrites.some(x => x.source === '/api/:path*' && x.destination.endsWith('/api/:path*')));
  assert.match(read('server/railway/dispatch.mjs'), /'\/api\/track\/ev-surveys'/);
});
test('survey owner API checks authentication before reading/exporting/deleting', () => {
  const route = read('server/ev-survey-private-handler.js');
  const publicRoute = read('server/ev-survey-public-handler.js');
  assert.ok(route.indexOf('requireOwner(req, res)') < route.indexOf('readSurveyDashboard('));
  assert.ok(route.indexOf('requireOwner(req, res)') < route.indexOf('deleteSurveyRecord('));
  assert.match(route, /assertSameOrigin\(req\)/);
  assert.match(publicRoute, /assertSameOrigin\(req\)/);
  assert.match(publicRoute, /submitSurvey\(req, req\.body\)/);
  const router = read('railway-api/track/metrics.js');
  assert.match(router, /view === 'ev-public'/);
  assert.match(router, /view === 'ev-surveys'/);
});
test('survey uses separate tables, durable rate limiting and scheduled retention', () => {
  const db = read('server/ev-survey-store.js');
  const cron = read('railway-api/track/cron/followups.js');
  assert.match(db, /ev_survey_responses/);
  assert.match(db, /ev_survey_throttle/);
  assert.match(db, /ON CONFLICT \(submission_id\) DO NOTHING/);
  assert.match(db, /INTERVAL '12 months'/);
  assert.match(cron, /cleanupSurveyData/);
  const privacy = read('src/privacy.js');
  assert.match(privacy, /Electric vehicle research interviews/);
});

test('source handlers are retained for Railway but Vercel has no filesystem API functions',()=>{
  assert.equal(existsSync(new URL('../api/', import.meta.url)),false,'No root /api serverless source');
  assert.equal(existsSync(new URL('../railway-api/track/metrics.js', import.meta.url)),true);
  assert.equal(existsSync(new URL('../railway-api/track/cron/followups.js', import.meta.url)),true);
});
