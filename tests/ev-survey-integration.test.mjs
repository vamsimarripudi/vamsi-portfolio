import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
});
test('survey owner API checks authentication before reading/exporting/deleting', () => {
  const route = read('api/track/ev-surveys.js');
  const publicRoute = read('api/ev-survey.js');
  assert.ok(route.indexOf('requireOwner(req, res)') < route.indexOf('readSurveyDashboard('));
  assert.ok(route.indexOf('requireOwner(req, res)') < route.indexOf('deleteSurveyRecord('));
  assert.match(route, /assertSameOrigin\(req\)/);
  assert.match(publicRoute, /assertSameOrigin\(req\)/);
  assert.match(publicRoute, /submitSurvey\(req, req\.body\)/);
});
test('survey uses separate tables, durable rate limiting and scheduled retention', () => {
  const db = read('server/ev-survey-store.js');
  const cron = read('api/track/cron/followups.js');
  assert.match(db, /ev_survey_responses/);
  assert.match(db, /ev_survey_throttle/);
  assert.match(db, /ON CONFLICT \(submission_id\) DO NOTHING/);
  assert.match(db, /INTERVAL '12 months'/);
  assert.match(cron, /cleanupSurveyData/);
  const privacy = read('src/privacy.js');
  assert.match(privacy, /Electric vehicle research interviews/);
});
