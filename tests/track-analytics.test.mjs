import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarToday, resolveRange, datesBetween, changeFor, csvCell, analyticsCsv } from '../shared/track-analytics.mjs';
import { createGa4Reader, normalizeGa4, readGa4Config, safeAnalyticsError, reportRows } from '../api/lib/track-analytics.js';
import { createAnalyticsHandler } from '../api/track/analytics.js';
import { NOW, GA_ENV, fakeGa4Report } from './fixtures/track-analytics.mjs';
const response = () => ({ headers: {}, statusCode: 0, payload: null, setHeader(k, v) { this.headers[k] = v; }, status(v) { this.statusCode = v; return this; }, json(v) { this.payload = v; return this; } });
const request = query => ({ method: 'GET', headers: {}, query });

test('presets use complete calendar days and an equal-length previous period', () => {
  const range = resolveRange({ range: '7d' }, NOW);
  assert.equal(range.start, '2026-10-05'); assert.equal(range.end, '2026-10-11'); assert.equal(range.days, 7);
  assert.deepEqual(range.previous, { start: '2026-09-28', end: '2026-10-04' });
  assert.equal(range.partial, false);
});
test('today follows the reporting timezone, not the browser or UTC date', () => {
  const midnight = new Date('2026-10-11T19:00:00Z');
  assert.equal(calendarToday(midnight, 'Asia/Kolkata'), '2026-10-12');
  assert.equal(calendarToday(midnight, 'America/Los_Angeles'), '2026-10-11');
  assert.equal(resolveRange({ range: 'today' }, midnight).partial, true);
});
test('month presets and leap-year comparisons use calendar boundaries', () => {
  assert.equal(resolveRange({ range: 'month' }, NOW).start, '2026-10-01');
  const previousMonth = resolveRange({ range: 'lastMonth' }, NOW);
  assert.equal(previousMonth.start, '2026-09-01'); assert.equal(previousMonth.end, '2026-09-30');
  const leap = resolveRange({ range: 'custom', start: '2024-02-29', end: '2024-03-01', compare: 'year' }, NOW);
  assert.deepEqual(leap.previous, { start: '2023-02-28', end: '2023-03-01' });
});
for (const [name, input] of [
  ['invalid date', { range: 'custom', start: '2026-02-30', end: '2026-03-02' }],
  ['inverted dates', { range: 'custom', start: '2026-10-10', end: '2026-10-01' }],
  ['future date', { range: 'custom', start: '2026-10-11', end: '2026-10-13' }],
  ['excessive range', { range: 'custom', start: '2024-01-01', end: '2026-10-01' }],
  ['missing date', { range: 'custom' }], ['unknown preset', { range: 'forever' }], ['unknown comparison', { compare: 'all' }],
]) test(`rejects ${name}`, () => assert.throws(() => resolveRange(input, NOW), error => error.code === 'INVALID_RANGE' && error.status === 400));
test('366-day ranges and no comparison are supported', () => {
  const range = resolveRange({ range: 'custom', start: '2024-01-01', end: '2024-12-31', compare: 'none' }, NOW);
  assert.equal(range.days, 366); assert.equal(range.previous, null); assert.equal(datesBetween(range.start, range.end).length, 366);
});
test('zero baselines never produce infinity and percentage changes use points', () => {
  assert.deepEqual(changeFor(5, 0), { value: null, unit: 'new' });
  assert.deepEqual(changeFor(0, 0), { value: 0, unit: '%' });
  assert.equal(changeFor(4, null), null);
  assert.ok(Math.abs(changeFor(.6, .4, 'percent').value - 20) < .00001);
});
test('CSV escapes quotes, newlines and formula injection', () => {
  assert.equal(csvCell('a,"b"'), '"a,""b"""');
  for (const value of ['=1+1', '+cmd', '@SUM(1)', '-2', ' \t=cmd', '\n=cmd']) assert.ok(csvCell(value).startsWith('"\''));
});
test('missing GA4 configuration is explicit and makes no provider request', async () => {
  const read = createGa4Reader({ makeClient: () => { throw new Error('Must not create a client'); } });
  const result = await read({}, {});
  assert.equal(result.status, 'not_configured'); assert.equal(result.metrics, undefined);
  assert.deepEqual(result.missing, ['GA4_PROPERTY_ID', 'GA4_SERVICE_ACCOUNT_JSON']);
});
test('numeric property IDs and service account configuration are validated without leaking secrets', () => {
  assert.throws(() => readGa4Config({ ...GA_ENV, GA4_PROPERTY_ID: 'G-ABC123' }), error => error.code === 'GA4_CONFIG_INVALID');
  assert.throws(() => readGa4Config({ ...GA_ENV, GA4_SERVICE_ACCOUNT_JSON: 'secret' }), error => !error.message.includes('secret'));
});
test('GA4 reports use the fixed property, named comparison ranges, summary totals and bounded dimensions', async () => {
  const calls = [];
  const read = createGa4Reader({ clock: () => NOW, makeClient: () => ({ request: async options => { calls.push(options); return { data: fakeGa4Report(options.data) }; } }) });
  const report = await read({ range: '7d' }, GA_ENV);
  assert.equal(report.status, 'ready'); assert.equal(report.range.timeZone, 'Asia/Kolkata');
  assert.equal(report.metrics.find(item => item.id === 'activeUsers').value, 10);
  assert.equal(report.metrics.find(item => item.id === 'activeUsers').previous, 5);
  assert.equal(report.trend.points.length, 7); assert.equal(report.trend.points[1].value, 0);
  assert.equal(report.breakdowns.length, 5);
  assert.equal(calls.length, 8);
  assert.ok(calls.every(call => call.url === 'https://analyticsdata.googleapis.com/v1beta/properties/123456:runReport' && call.timeout === 8000 && call.retry === false));
  const page = calls.find(call => call.data.dimensions?.[0]?.name === 'pagePath');
  assert.equal(page.data.limit, '10'); assert.ok(page.data.dimensionFilter.notExpression);
  assert.ok(!JSON.stringify(report).includes('NOT_A_REAL_KEY'));
  const csv = analyticsCsv(report); assert.ok(csv.includes('Google') === false); assert.ok(csv.includes('2026-10-05'));
  const cached = await read({ range: '7d' }, GA_ENV); assert.equal(cached.cached, true); assert.equal(calls.length, 8);
});
test('concurrent identical GA4 requests coalesce instead of consuming duplicate report quota', async () => {
  let calls = 0;
  const read = createGa4Reader({ clock: () => NOW, makeClient: () => ({ request: async ({ data }) => { calls++; await new Promise(resolve => setTimeout(resolve, 3)); return { data: fakeGa4Report(data) }; } }) });
  const result = await Promise.all([read({ range: '7d' }, GA_ENV), read({ range: '7d' }, GA_ENV)]);
  assert.equal(calls, 8); assert.deepEqual(result[0].metrics, result[1].metrics);
});
test('GA4 uses property timezone even when it differs from the reporting server', async () => {
  const read = createGa4Reader({ clock: () => new Date('2026-10-11T19:00:00Z'), makeClient: () => ({ request: async ({ data }) => {
    const report = fakeGa4Report(data); report.metadata.timeZone = 'America/Los_Angeles'; return { data: report };
  } }) });
  assert.equal((await read({ range: 'today' }, GA_ENV)).range.end, '2026-10-11');
});
test('provider failures remain failures, never successful zero reports', async () => {
  const read = createGa4Reader({ makeClient: () => ({ request: async () => { throw { response: { status: 403, data: { secret: 'DO_NOT_LOG' } } }; } }) });
  await assert.rejects(() => read({}, GA_ENV));
  assert.equal(safeAnalyticsError({ response: { status: 429 } }).status, 429);
  assert.equal(safeAnalyticsError({ response: { status: 403 } }).code, 'GA4_ACCESS_REQUIRED');
  assert.ok(!JSON.stringify(safeAnalyticsError(new Error('SECRET'))).includes('SECRET'));
});
test('incomplete or invalid metric payloads are rejected rather than displayed as zeros', () => {
  assert.throws(() => reportRows({ metricHeaders: [{ name: 'sessions' }], rows: [{ metricValues: [] }] }));
  assert.throws(() => reportRows({ metricHeaders: [{ name: 'sessions' }], rows: [{ metricValues: [{ value: 'NaN' }] }] }));
  assert.throws(() => normalizeGa4(resolveRange({}, NOW), [{}], NOW.toISOString()));
});
test('provider privacy and sampling caveats are visible in the report', async () => {
  const read = createGa4Reader({ clock: () => NOW, makeClient: () => ({ request: async ({ data }) => {
    const report = fakeGa4Report(data); Object.assign(report.metadata, { subjectToThresholding: true, samplingMetadatas: [{}], dataLossFromOtherRow: true }); return { data: report };
  } }) });
  const report = await read({}, GA_ENV); assert.equal(report.warnings.length, 4);
});
test('new analytics API denies access before touching any source and disables shared caching', async () => {
  let calls = 0; const res = response();
  const handler = createAnalyticsHandler({ authorize: async (_, out) => { out.status(401).json({ ok: false }); return null; }, ga4: async () => { calls++; } });
  await handler(request({ source: 'ga4' }), res);
  assert.equal(calls, 0); assert.equal(res.statusCode, 401); assert.equal(res.headers['Cache-Control'], 'private, no-store'); assert.equal(res.headers.Vary, 'Cookie');
});
test('analytics API rejects duplicate parameters, arbitrary property IDs and unknown sources', async () => {
  const handler = createAnalyticsHandler({ authorize: async () => ({}) });
  for (const query of [{ source: ['ga4', 'enquiries'] }, { source: 'ga4', propertyId: '999' }, { source: 'other' }]) {
    const res = response(); await handler(request(query), res); assert.equal(res.statusCode, 400);
  }
});
test('analytics API returns read-only reports and safe retry information', async () => {
  const handler = createAnalyticsHandler({ authorize: async () => ({}), enquiries: async () => ({ source: 'enquiries', status: 'ready' }), ga4: async () => { throw { response: { status: 429 } }; } });
  const success = response(); await handler(request({ source: 'enquiries' }), success); assert.equal(success.statusCode, 200);
  const quota = response(); await handler(request({ source: 'ga4' }), quota); assert.equal(quota.statusCode, 429); assert.equal(quota.headers['Retry-After'], '60');
});
