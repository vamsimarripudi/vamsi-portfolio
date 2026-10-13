import AnimatedContent from './components/react-bits/AnimatedContent.jsx';
import CountNumber from './components/CountNumber.jsx';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FiDownload, FiRefreshCw, FiBarChart2 } from 'react-icons/fi';
import { RANGE_PRESETS, REPORT_TIME_ZONE, analyticsCsv, calendarToday, changeFor, resolveRange } from '../shared/track-analytics.mjs';
import './TrackAnalytics.css';

const formatNumber = (value, format = 'number') => new Intl.NumberFormat('en-IN', format === 'percent'
  ? { style: 'percent', maximumFractionDigits: 1 } : { maximumFractionDigits: 1 }).format(value);
function RangeControls({ applied, timeZone, onApply, busy }) {
  const [draft, setDraft] = useState(() => {
    let range;
    try { range = resolveRange(applied, new Date(), timeZone); }
    catch { range = resolveRange({}, new Date(), timeZone); }
    return { source: applied.source || 'ga4', range: applied.range || '28d', compare: applied.compare || 'previous',
      start: applied.start || range.start, end: applied.end || range.end };
  });
  const [error, setError] = useState('');
  const update = (key, value) => { setDraft(previous => ({ ...previous, [key]: value })); setError(''); };
  const submit = event => {
    event.preventDefault();
    try {
      resolveRange(draft, new Date(), timeZone);
      const next = { source: draft.source, range: draft.range, compare: draft.compare };
      if (draft.range === 'custom') { next.start = draft.start; next.end = draft.end; }
      onApply(next);
    } catch (failure) { setError(failure.message); }
  };
  return <form className="ta-controls" onSubmit={submit} aria-label="Analytics date range">
    <label>Data source<select aria-label="Data source" value={draft.source} onChange={event => update('source', event.target.value)}>
      <option value="ga4">Google Analytics 4</option><option value="enquiries">Enquiry database</option>
    </select></label>
    <label>Date range<select aria-label="Date range" value={draft.range} onChange={event => update('range', event.target.value)}>
      {RANGE_PRESETS.map(([value, title]) => <option key={value} value={value}>{title}</option>)}
    </select></label>
    <label>Compare with<select aria-label="Compare with" value={draft.compare} onChange={event => update('compare', event.target.value)}>
      <option value="previous">Previous period</option><option value="year">Previous year</option><option value="none">No comparison</option>
    </select></label>
    {draft.range === 'custom' && <div className="ta-custom-dates">
      <label>Start date<input aria-label="Start date" type="date" required min="2000-01-01" max={calendarToday(new Date(), timeZone)} value={draft.start} onChange={event => update('start', event.target.value)}/></label>
      <label>End date<input aria-label="End date" type="date" required min="2000-01-01" max={calendarToday(new Date(), timeZone)} value={draft.end} onChange={event => update('end', event.target.value)}/></label>
    </div>}
    <button type="submit" className="ta-apply" disabled={busy}>Apply range</button>
    <p className="ta-control-hint">Last 7/28/90 days exclude today. Dates are inclusive; custom ranges support up to 366 days.</p>
    {error && <p className="ta-error" role="alert">{error}</p>}
  </form>;
}
function Metric({ metric }) {
  const change = changeFor(metric.value, metric.previous, metric.format);
  return <AnimatedContent as="article" className="ta-metric" title={metric.description}>
    <h2>{metric.label}</h2><strong><CountNumber value={metric.value} format={value => formatNumber(value, metric.format)}/></strong>
    {change && <p className="ta-change">{change.unit === 'new' ? 'New · no prior baseline'
      : `${change.value > 0 ? '+' : ''}${formatNumber(change.value)}${change.unit === 'pp' ? ' pp' : '%'} vs comparison`}</p>}
    {metric.previous !== null && <small>Previously {formatNumber(metric.previous, metric.format)}</small>}
  </AnimatedContent>;
}
function Trend({ trend }) {
  const points = trend.points, maximum = Math.max(1, ...points.flatMap(point => [point.value, point.previous || 0]));
  const path = field => points.map((point, index) => point[field] === null ? ''
    : `${index === 0 ? 'M' : 'L'}${36 + index / Math.max(1, points.length - 1) * 648},${166 - point[field] / maximum * 146}`).filter(Boolean).join(' ');
  return <section className="ta-panel ta-trend" aria-labelledby="ta-trend-title">
    <div className="ta-panel-heading"><h2 id="ta-trend-title">{trend.label} over time</h2><span>Daily · aligned from period start</span></div>
    <div className="ta-legend"><span><i/> Selected period</span>{points.some(point => point.previous !== null) && <span><i className="ta-previous-key"/> Comparison</span>}</div>
    <svg viewBox="0 0 720 202" role="img" aria-labelledby="ta-chart-title ta-chart-description">
      <title id="ta-chart-title">Daily {trend.label.toLowerCase()}</title>
      <desc id="ta-chart-description">Selected and comparison periods, aligned by day number. Exact values are available in the daily data table below.</desc>
      {[0, .5, 1].map(fraction => <g key={fraction}><line x1="36" x2="684" y1={166 - fraction * 146} y2={166 - fraction * 146} className="ta-gridline"/><text x="30" y={170 - fraction * 146} textAnchor="end">{formatNumber(maximum * fraction)}</text></g>)}
      {points.some(point => point.previous !== null) && <path d={path('previous')} className="ta-line ta-previous"/>}
      <path d={path('value')} className="ta-line"/>
      {points.length === 1 && <circle cx="36" cy={166 - points[0].value / maximum * 146} r="4" className="ta-dot"/>}
      <text x="36" y="192">{points[0]?.date}</text><text x="684" y="192" textAnchor="end">{points.at(-1)?.date}</text>
    </svg>
    <details className="ta-daily"><summary>View daily data table</summary><div className="ta-table-scroll" role="region" aria-label="Daily analytics data" tabIndex="0">
      <table><caption className="sr-only">Daily selected and comparison values</caption><thead><tr><th scope="col">Date</th><th scope="col">{trend.label}</th><th scope="col">Comparison date</th><th scope="col">Comparison</th></tr></thead>
        <tbody>{points.map(point => <tr key={point.date}><th scope="row">{point.date}</th><td>{formatNumber(point.value)}</td><td>{point.previousDate || '—'}</td><td>{point.previous === null ? '—' : formatNumber(point.previous)}</td></tr>)}</tbody>
      </table></div></details>
  </section>;
}
function Breakdown({ table }) {
  return <section className="ta-panel"><div className="ta-panel-heading"><h2>{table.title}</h2>
    {table.totalRows > table.rows.length && <span>Top {table.rows.length} of {formatNumber(table.totalRows)}</span>}</div>
    {table.rows.length === 0 ? <p className="ta-muted">No records for this period.</p>
      : <table className="ta-breakdown"><caption className="sr-only">{table.title} in the selected date range</caption>
        <thead><tr><th scope="col">{table.title}</th><th scope="col">{table.metric}</th></tr></thead>
        <tbody>{table.rows.map((row, index) => <tr key={`${row.label}-${index}`}><th scope="row">{row.label}</th><td>{formatNumber(row.value)}</td></tr>)}</tbody></table>}
  </section>;
}
function ConnectionNeeded({ report, onEnquiries }) {
  return <section className="ta-panel ta-connection" aria-labelledby="ta-connection-heading">
    <FiBarChart2 aria-hidden="true"/><h2 id="ta-connection-heading">Connect Google Analytics</h2><p>{report.message}</p>
    <p>This dashboard reads an existing property through Google’s Data API. It does not install a tracking tag or collect visitor data.</p>
    <ol><li>Enable the Google Analytics Data API in the service account’s Google Cloud project.</li>
      <li>Grant that service account <strong>Viewer</strong> access to the existing GA4 property.</li>
      <li>Set server-only <code>GA4_PROPERTY_ID</code> (numeric, not a G- measurement ID) and <code>GA4_SERVICE_ACCOUNT_JSON</code> in the deployment environment, then redeploy.</li></ol>
    <p>Never paste credentials here or use a VITE_ prefix. Keep the existing consent and tracking configuration unchanged.</p>
    <button type="button" onClick={onEnquiries}>View enquiry analytics instead</button>
  </section>;
}
export default function TrackAnalytics({ onSessionExpired }) {
  const [params, setParams] = useSearchParams(), queryKey = params.toString();
  const [state, setState] = useState({ status: 'loading', report: null, error: '' });
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading', report: null, error: '' });
    const search = new URLSearchParams(queryKey);
    if (!search.has('source')) search.set('source', 'ga4');
    fetch(`/api/track/analytics?${search}`, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const data = await response.json().catch(() => null);
        if (response.status === 401) { onSessionExpired?.('guest'); throw new Error('Your session expired. Sign in again.'); }
        if (!response.ok || data?.ok !== true || !data.report) throw new Error(data?.message || 'Analytics could not be loaded. Please retry.');
        if (!['ready', 'not_configured'].includes(data.report.status)) throw new Error('Analytics returned an incomplete report.');
        if (!controller.signal.aborted) setState({ status: 'loaded', report: data.report, error: '' });
      }).catch(error => { if (!controller.signal.aborted) setState({ status: 'error', report: null, error: error.message }); });
    return () => controller.abort();
  }, [queryKey, refresh, onSessionExpired]);
  const report = state.report, ready = state.status === 'loaded' && report?.status === 'ready';
  const apply = next => { setParams(next); setRefresh(value => value + 1); };
  const download = () => {
    if (!ready) return;
    const url = URL.createObjectURL(new Blob([analyticsCsv(report)], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url;
    link.download = `analytics-${report.source}-${report.range.start}-${report.range.end}.csv`;
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <main className="track-page ta-page">
    <header className="ta-heading"><div><p className="track-kicker">Private reporting workspace</p><h1>Analytics</h1><p>Understand traffic and enquiries. Choose a source, set dates, and compare periods.</p></div>
      <div className="ta-actions"><button type="button" onClick={() => setRefresh(value => value + 1)} disabled={state.status === 'loading'} aria-label="Refresh analytics"><FiRefreshCw aria-hidden="true"/><span>Refresh</span></button>
        <button type="button" disabled={!ready} onClick={download}><FiDownload aria-hidden="true"/>Export CSV</button></div>
    </header>
    <RangeControls key={queryKey} applied={Object.fromEntries(params)} timeZone={report?.range?.timeZone || REPORT_TIME_ZONE} onApply={apply} busy={false}/>
    <div aria-live="polite" aria-atomic="true" className="ta-status">
      {state.status === 'loading' && <p role="status">Loading analytics…</p>}
      {ready && <p><strong>{report.sourceLabel}</strong> · {report.range.start} — {report.range.end} · {report.range.timeZone}
        {report.range.previous && <> · Compared with {report.range.previous.start} — {report.range.previous.end}</>}</p>}
    </div>
    {state.status === 'error' && <section className="ta-panel"><p className="ta-error" role="alert">{state.error}</p><button type="button" onClick={() => setRefresh(value => value + 1)}>Retry analytics</button></section>}
    {report?.status === 'not_configured' && <ConnectionNeeded report={report} onEnquiries={() => apply({ source: 'enquiries', range: '28d', compare: 'previous' })}/>}
    {ready && <>
      {report.range.partial && <p className="ta-notice">This range includes today and is incomplete. The comparison period may contain full days.</p>}
      {report.metrics.every(metric => metric.value === 0) && <p className="ta-notice">No recorded activity was returned for this period. This does not prove that no visitors reached the site.</p>}
      <section className="ta-metrics" aria-label="Analytics summary">{report.metrics.map(metric => <Metric key={metric.id} metric={metric}/>)}</section>
      <Trend trend={report.trend}/><div className="ta-breakdowns">{report.breakdowns.map(table => <Breakdown key={table.title} table={table}/>)}</div>
      <footer className="ta-notes"><p>Retrieved {new Date(report.generatedAt).toLocaleString('en-IN', { timeZone: report.range.timeZone })} ({report.range.timeZone}).
        {report.source === 'ga4' && ' GA4 reports may be delayed; this is not a realtime visitor counter. Reports are cached for up to 60 seconds.'}</p>
        {report.warnings.map(warning => <p key={warning}>{warning}</p>)}
        <p>Range totals are calculated by the source. Unique users must not be summed across days or breakdown rows. CSV exports only the report currently displayed.</p></footer>
    </>}
  </main>;
}
