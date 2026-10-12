// Synthetic provider responses for tests only. Never imported by the application.
export const NOW = new Date('2026-10-12T12:00:00Z');
export const GA_ENV = { GA4_PROPERTY_ID: '123456', GA4_SERVICE_ACCOUNT_JSON: JSON.stringify({
  type: 'service_account', client_email: 'analytics@fixture.iam.gserviceaccount.com',
  private_key: '-----BEGIN PRIVATE KEY-----\nNOT_A_REAL_KEY\n-----END PRIVATE KEY-----',
}) };
export function fakeGa4Report(data) {
  const dimensions = (data.dimensions || []).map(item => item.name);
  const multi = data.dateRanges.length > 1;
  const dimensionHeaders = [...dimensions, ...(multi ? ['dateRange'] : [])].map(name => ({ name }));
  const metricHeaders = data.metrics.map(({ name }) => ({ name, type: name === 'engagementRate' ? 'TYPE_FLOAT' : 'TYPE_INTEGER' }));
  const examples = { sessionDefaultChannelGroup: 'Organic Search', pagePath: '/corner', deviceCategory: 'mobile', country: 'India', eventName: 'page_view' };
  const values = { activeUsers: 10, newUsers: 4, sessions: 15, screenPageViews: 25, engagementRate: .6, keyEvents: 2, eventCount: 30 };
  const rows = data.dateRanges.map((range, index) => ({
    dimensionValues: [...dimensions.map(name => ({ value: name === 'date' ? range.startDate.replaceAll('-', '') : examples[name] || 'test' })), ...(multi ? [{ value: range.name }] : [])],
    metricValues: data.metrics.map(({ name }) => ({ value: String((values[name] || 1) * (index ? .5 : 1)) })),
  }));
  return { dimensionHeaders, metricHeaders, rows, rowCount: rows.length, metadata: { timeZone: 'Asia/Kolkata' } };
}
