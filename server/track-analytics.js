import { JWT } from 'google-auth-library';
import { createHash } from 'node:crypto';
import { TrackError, query } from '../api/lib/track.js';
import { datesBetween, resolveRange, REPORT_TIME_ZONE } from '../shared/track-analytics.mjs';

const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
const BASE = 'https://analyticsdata.googleapis.com/v1beta/properties/';
const GA_METRICS = [
  ['activeUsers', 'Active users', 'number', 'Distinct active users for the whole period, not a sum of daily users.'],
  ['newUsers', 'New users', 'number', 'Users who triggered first_visit or first_open.'],
  ['sessions', 'Sessions', 'number', 'Sessions reported by Google Analytics.'],
  ['screenPageViews', 'Views', 'number', 'Page and screen views, including repeated views.'],
  ['engagementRate', 'Engagement rate', 'percent', 'Engaged sessions divided by all sessions; change is percentage points.'],
  ['keyEvents', 'Key events', 'number', 'Events marked as key events in the GA4 property.'],
];
const BREAKDOWNS = [
  ['sessionDefaultChannelGroup', 'Acquisition channels', 'sessions', 'Sessions'],
  ['pagePath', 'Top pages', 'screenPageViews', 'Views'],
  ['deviceCategory', 'Devices', 'sessions', 'Sessions'],
  ['country', 'Countries', 'activeUsers', 'Active users'],
  ['eventName', 'Events', 'eventCount', 'Events'],
];
const number = value => {
  const result = Number(value ?? 0);
  if (!Number.isFinite(result) || result < 0) throw new TrackError(502, 'The analytics provider returned an invalid metric.', 'ANALYTICS_RESPONSE_INVALID');
  return result;
};
const label = value => String(value ?? '(not set)').slice(0, 250);
export function readGa4Config(env = process.env) {
  const missing = ['GA4_PROPERTY_ID', 'GA4_SERVICE_ACCOUNT_JSON'].filter(key => !env[key]?.trim());
  if (missing.length) return { missing };
  try {
    const propertyId = env.GA4_PROPERTY_ID.trim();
    const credentials = JSON.parse(env.GA4_SERVICE_ACCOUNT_JSON);
    if (!/^\d{1,20}$/.test(propertyId) || credentials.type !== 'service_account' ||
      !/^[^\s@]+@[^\s@]+\.gserviceaccount\.com$/.test(credentials.client_email) ||
      !credentials.private_key?.includes('-----BEGIN PRIVATE KEY-----')) throw new Error('Invalid configuration');
    return { propertyId, email: credentials.client_email, key: credentials.private_key };
  } catch {
    throw new TrackError(503, 'GA4 server configuration is invalid. Check the numeric property ID and service-account JSON.', 'GA4_CONFIG_INVALID');
  }
}
export function reportRows(report) {
  if (!report || !Array.isArray(report.metricHeaders)) throw new TrackError(502, 'The analytics provider returned an incomplete report.', 'ANALYTICS_RESPONSE_INVALID');
  if ((report.rows || []).some(row => row.metricValues?.length !== report.metricHeaders.length)) throw new TrackError(502, 'The analytics provider returned incomplete metric values.', 'ANALYTICS_RESPONSE_INVALID');
  return (report.rows || []).map(row => ({
    ...Object.fromEntries((report.dimensionHeaders || []).map((header, index) => [header.name, row.dimensionValues?.[index]?.value || ''])),
    ...Object.fromEntries(report.metricHeaders.map((header, index) => [header.name, number(row.metricValues?.[index]?.value)])),
  }));
}
function series(range, rows, valueKey) {
  const previousDates = range.previous ? datesBetween(range.previous.start, range.previous.end) : [];
  const lookup = new Map(rows.map(row => [`${row.dateRange || 'current'}:${row.date}`, number(row[valueKey])]));
  const key = date => date.replaceAll('-', '');
  return datesBetween(range.start, range.end).map((date, index) => ({
    date, value: lookup.get(`current:${key(date)}`) || 0,
    previousDate: previousDates[index] || null,
    previous: previousDates[index] ? lookup.get(`previous:${key(previousDates[index])}`) || 0 : null,
  }));
}
export function normalizeGa4(range, reports, generatedAt) {
  const expected = [GA_METRICS.map(([id]) => id), ['screenPageViews'], ...BREAKDOWNS.map(([, , metric]) => [metric])];
  if (reports.length !== expected.length || expected.some((names, index) => names.some(name => !reports[index]?.metricHeaders?.some(header => header.name === name)))) {
    throw new TrackError(502, 'The analytics provider returned incomplete report metrics.', 'ANALYTICS_RESPONSE_INVALID');
  }
  const summary = reportRows(reports[0]);
  const current = summary.find(row => !row.dateRange || row.dateRange === 'current') || {};
  const previous = summary.find(row => row.dateRange === 'previous') || {};
  const warnings = new Set(['GA4 is a reporting source, not a collection tag. Uncollected historical visits cannot be reconstructed.']);
  for (const report of reports) {
    if (report.metadata?.subjectToThresholding) warnings.add('Google applied privacy thresholds; some data may be withheld.');
    if (report.metadata?.samplingMetadatas?.length) warnings.add('Google sampled this report.');
    if (report.metadata?.dataLossFromOtherRow) warnings.add('Google grouped high-cardinality results into an “other” row.');
    if (report.metadata?.emptyReason) warnings.add('Google returned an empty report with a provider restriction.');
  }
  return {
    source: 'ga4', sourceLabel: 'Google Analytics 4', status: 'ready', generatedAt, range,
    metrics: GA_METRICS.map(([id, title, format, description]) => ({ id, label: title, format, description,
      value: number(current[id]), previous: range.previous ? number(previous[id]) : null })),
    trend: { label: 'Views', points: series(range, reportRows(reports[1]), 'screenPageViews') },
    breakdowns: BREAKDOWNS.map(([dimension, title, metric, metricLabel], index) => ({
      title, metric: metricLabel, totalRows: reports[index + 2].rowCount || 0,
      rows: reportRows(reports[index + 2]).map(row => ({ label: label(row[dimension]), value: number(row[metric]) })),
    })), warnings: [...warnings],
  };
}
export function createGa4Reader({ makeClient = config => new JWT({ email: config.email, key: config.key, scopes: [SCOPE] }), clock = () => new Date() } = {}) {
  let identity = '', client, zone, zoneExpires = 0;
  const cache = new Map(), pending = new Map();
  let reportStarts = [];
  async function run(propertyId, data) {
    const response = await client.request({ url: `${BASE}${propertyId}:runReport`, method: 'POST', data, timeout: 8000, retry: false });
    return response.data;
  }
  return async (input, env = process.env) => {
    const config = readGa4Config(env);
    if (config.missing) return { source: 'ga4', sourceLabel: 'Google Analytics 4', status: 'not_configured', missing: config.missing,
      message: 'Connect an existing GA4 property to view real traffic. No example numbers are shown.' };
    const nextIdentity = createHash('sha256').update(`${config.propertyId}:${config.email}:${config.key}`).digest('hex');
    if (identity !== nextIdentity) {
      identity = nextIdentity; client = makeClient(config); zone = null; zoneExpires = 0; cache.clear(); pending.clear(); reportStarts = [];
    }
    const now = clock(), time = now.getTime();
    // The property itself supplies its timezone: presets must not depend on browser or server locale.
    if (!zone || time >= zoneExpires) {
      const discoveryKey = 'timezone';
      if (!pending.has(discoveryKey)) pending.set(discoveryKey, run(config.propertyId, {
        dateRanges: [{ startDate: 'yesterday', endDate: 'yesterday' }], metrics: [{ name: 'activeUsers' }], limit: '1',
      }).then(report => {
        const candidate = report.metadata?.timeZone;
        if (!candidate) throw new TrackError(502, 'GA4 did not return its reporting timezone.', 'GA4_TIMEZONE_UNAVAILABLE');
        new Intl.DateTimeFormat('en', { timeZone: candidate }).format(now);
        zone = candidate; zoneExpires = time + 300000;
      }).finally(() => pending.delete(discoveryKey)));
      await pending.get(discoveryKey);
    }
    const range = resolveRange(input, now, zone), cacheKey = JSON.stringify(range);
    const cached = cache.get(cacheKey);
    if (cached && time - cached.time < 60000) return { ...cached.report, cached: true };
    if (pending.has(cacheKey)) return pending.get(cacheKey);
    reportStarts = reportStarts.filter(start => time - start < 60000);
    if (reportStarts.length >= 6) throw new TrackError(429, 'Too many analytics requests. Wait one minute before refreshing.', 'ANALYTICS_RATE_LIMITED');
    reportStarts.push(time);
    const dateRanges = [{ startDate: range.start, endDate: range.end, name: 'current' }];
    if (range.previous) dateRanges.push({ startDate: range.previous.start, endDate: range.previous.end, name: 'previous' });
    const requests = [
      { dateRanges, metrics: GA_METRICS.map(([name]) => ({ name })), limit: '2' },
      { dateRanges, dimensions: [{ name: 'date' }], metrics: [{ name: 'screenPageViews' }], limit: '732', orderBys: [{ dimension: { dimensionName: 'date' } }] },
      ...BREAKDOWNS.map(([dimension, , metric]) => ({ dateRanges: [dateRanges[0]], dimensions: [{ name: dimension }],
        metrics: [{ name: metric }], limit: '10', orderBys: [{ metric: { metricName: metric }, desc: true }],
        // Never display private record paths or query-string identifiers in the page table.
        ...(dimension === 'pagePath' ? { dimensionFilter: { notExpression: { filter: { fieldName: 'pagePath', stringFilter: {
          matchType: 'FULL_REGEXP', value: '/(track|api|corner/(admin|account|api))(/.*)?', caseSensitive: false,
        } } } } } : {}),
      })),
    ];
    const promise = Promise.all(requests.map(data => run(config.propertyId, data))).then(reports => {
      const report = normalizeGa4(range, reports, clock().toISOString());
      if (cache.size >= 24) cache.delete(cache.keys().next().value);
      cache.set(cacheKey, { time, report }); return { ...report, cached: false };
    }).finally(() => pending.delete(cacheKey));
    pending.set(cacheKey, promise);
    return promise;
  };
}
export const loadGa4 = createGa4Reader();

/** One read-only SQL snapshot, bounded by indexed timestamp ranges; no contact PII leaves the database. */
export async function loadEnquiryAnalytics(input, sql = query(), now = new Date()) {
  const range = resolveRange(input, now, REPORT_TIME_ZONE);
  const previous = range.previous || { start: range.start, end: range.end };
  const rows = await sql`
    WITH periods AS (
      SELECT 'current'::text AS period, ${range.start}::date AS first_day, ${range.end}::date AS last_day
      UNION ALL SELECT 'previous'::text, ${previous.start}::date, ${previous.end}::date
      WHERE ${Boolean(range.previous)}::boolean
    ), cohort AS (
      SELECT p.period, to_char(e.created_at AT TIME ZONE ${range.timeZone}, 'YYYY-MM-DD') AS day,
        e.status, e.intent, e.replied_at IS NOT NULL AS replied, e.completed_at IS NOT NULL AS completed
      FROM periods p JOIN track_enquiries e
        ON e.created_at >= (p.first_day::timestamp AT TIME ZONE ${range.timeZone})
       AND e.created_at < ((p.last_day + 1)::timestamp AT TIME ZONE ${range.timeZone})
      WHERE e.status NOT IN ('ERASED', 'ERASURE_PENDING')
    )
    SELECT 'summary' AS kind, period, ''::text AS label, count(*)::int AS value,
      count(*) FILTER (WHERE replied)::int AS replied, count(*) FILTER (WHERE completed)::int AS completed,
      count(*) FILTER (WHERE status = 'SPAM')::int AS spam FROM cohort GROUP BY period
    UNION ALL SELECT 'day', period, day, count(*)::int, 0, 0, 0 FROM cohort GROUP BY period, day
    UNION ALL SELECT 'status', period, status, count(*)::int, 0, 0, 0 FROM cohort WHERE period = 'current' GROUP BY period, status
    UNION ALL SELECT 'intent', period, intent, count(*)::int, 0, 0, 0 FROM cohort WHERE period = 'current' GROUP BY period, intent`;
  return normalizeEnquiries(range, rows, now.toISOString());
}
export function normalizeEnquiries(range, rows, generatedAt) {
  const current = rows.find(row => row.kind === 'summary' && row.period === 'current') || {};
  const previous = rows.find(row => row.kind === 'summary' && row.period === 'previous') || {};
  return { source: 'enquiries', sourceLabel: 'Enquiry database', status: 'ready', range, generatedAt,
    metrics: [['value', 'Enquiries received'], ['replied', 'Have been replied to'], ['completed', 'Have been completed'], ['spam', 'Marked as spam']].map(([id, title]) => ({
      id, label: title, format: 'number', value: number(current[id]), previous: range.previous ? number(previous[id]) : null,
      description: 'Enquiries created in the selected dates, using their current recorded state. Erased and erasure-pending records are excluded.',
    })),
    trend: { label: 'Enquiries received', points: series(range, rows.filter(row => row.kind === 'day').map(row => ({
      dateRange: row.period, date: row.label.replaceAll('-', ''), value: row.value,
    })), 'value') },
    breakdowns: [['status', 'Current status'], ['intent', 'Enquiry intent']].map(([kind, title]) => ({ title, metric: 'Enquiries',
      rows: rows.filter(row => row.kind === kind && row.period === 'current').map(row => ({ label: label(row.label), value: number(row.value) })).sort((a, b) => b.value - a.value),
    })), warnings: ['Created-date cohorts, not a historical status snapshot. Reply/completion counts can change as work progresses. Erased and erasure-pending records are excluded.'],
  };
}
export function safeAnalyticsError(error) {
  if (error instanceof TrackError || error?.code === 'INVALID_RANGE') return { status: error.status, code: error.code, message: error.message };
  const upstream = error?.response?.status || error?.status;
  if (upstream === 429) return { status: 429, code: 'GA4_QUOTA', message: 'Google Analytics quota is temporarily exhausted. Retry later.' };
  if ([401, 403].includes(upstream)) return { status: 503, code: 'GA4_ACCESS_REQUIRED', message: 'Google Analytics access failed. Verify the Data API is enabled and the service account has Viewer access to the property.' };
  return { status: 503, code: 'ANALYTICS_UNAVAILABLE', message: 'Analytics is temporarily unavailable. Retry without changing your data or permissions.' };
}
