import { useCallback, useEffect, useState } from 'react';
import { FiArrowDownRight, FiArrowRight, FiBarChart2, FiDownload, FiFileText, FiRefreshCw, FiSearch, FiShield, FiTrash2 } from 'react-icons/fi';
import { SURVEY_QUESTIONS } from '../shared/ev-survey.mjs';
import './EVSurveyTrack.css';

const empty = { overview: { total: 0 }, distributions: { issues: [], prices: [], interest: [] }, weeks: [], items: [], matchCount: 0, page: 1 };
const format = (value) => value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
const show = value => Array.isArray(value) ? value.join(', ') : (value || '—');
function Stat({ label, value, denominator, note }) {
  return <div className="evst-stat"><span>{label}</span><strong>{Number(value || 0).toLocaleString('en-IN')}</strong><small>{denominator > 0 ? Math.round(Number(value || 0) / denominator * 100) + '% of interviewed owners' : note || 'No submissions yet'}</small></div>;
}
function Distribution({ title, description, items, total }) {
  return <section className="evst-card evst-distribution"><div className="evst-card-header"><div><h2>{title}</h2><p>{description}</p></div><FiBarChart2 aria-hidden="true"/></div>
    {!items.length ? <p className="evst-empty">No responses to analyze yet.</p> : <div className="evst-bars">{items.map(item => {
      const percent = total ? Math.round(item.count / total * 100) : 0;
      return <div className="evst-bar-row" key={item.label}><div className="evst-bar-label"><strong>{item.label}</strong><span>{item.count} / {percent}%</span></div><div className="evst-bar-track" role="meter" aria-label={item.label} aria-valuemin={0} aria-valuemax={total || 1} aria-valuenow={item.count}><span style={{ width: percent + '%' }}/></div></div>;
    })}</div>}
  </section>;
}
export default function EVSurveyTrack({ onSessionExpired }) {
  const [data, setData] = useState(empty);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState('');
  const [state, setState] = useState('loading');
  const [message, setMessage] = useState('');
  const load = useCallback(async (signal) => {
    setState('loading'); setMessage('');
    try {
      const params = new URLSearchParams({ q: query, page: String(page) });
      const response = await fetch('/api/track/ev-surveys?' + params, { credentials: 'same-origin', cache: 'no-store', signal });
      if (response.status === 401) { onSessionExpired?.('guest'); return; }
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.message || 'Could not load research records.');
      setData(result); setState('ready');
    } catch (error) {
      if (error.name === 'AbortError') return;
      setState('error'); setMessage(error.message);
    }
  }, [onSessionExpired, page, query]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => { void load(controller.signal); }, 220);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [load, refresh]);

  const erase = async (referenceId) => {
    if (window.prompt('Permanently erase interview ' + referenceId + '? Type DELETE to confirm.') !== 'DELETE') return;
    try {
      const response = await fetch('/api/track/ev-surveys', { method: 'DELETE', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ referenceId, confirm: 'DELETE' }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.message || 'Could not erase interview.');
      setSelected(''); setRefresh(r => r + 1);
    } catch (error) { setMessage(error.message); }
  };
  const total = Number(data.overview?.total || 0);
  const top = data.distributions?.issues?.[0];
  const sampleWarning = total < 20;
  return <main className="track-page evst-page">
    <div className="evst-intro"><div><p className="track-kicker">Private workspace / field research</p><h1>EV owner interviews<span>.</span></h1><p>Capture what owners experienced, identify recurring pain and measure how often willingness to pay translates into real demand.</p></div><div className="evst-toolbar"><a className="evst-outline" href="/ev-survey" target="_blank" rel="noreferrer">Open interview form <FiArrowRight/></a><a className="evst-solid" href="/api/track/ev-surveys?format=csv" download="ev-owner-survey.csv"><FiDownload/> Export CSV</a></div></div>
    <div className="evst-banner"><FiShield/><p>Owner-only research data. Responses are not public testimonials. Percentages describe this interview sample only, not all Indian EV owners.</p></div>
    <section className="evst-stats" aria-label="Research metrics">
      <Stat label="Interviews received" value={total} note="Total recorded"/>
      <Stat label="Unclear repair estimates" value={data.overview?.unclear_estimates} denominator={total}/>
      <Stat label="Warranty concerns" value={data.overview?.warranty_concerns} denominator={total}/>
      <Stat label="Public charging failures" value={data.overview?.charging_failures} denominator={total}/>
      <Stat label="Paid for outside help" value={data.overview?.previously_paid} denominator={total}/>
      <Stat label="Would consider paid review" value={data.overview?.willing_to_consider} denominator={total}/>
    </section>
    {sampleWarning && <p className="evst-small-sample"><FiFileText/> Early research: fewer than 20 interviews. These signals are exploratory, not representative market estimates.</p>}
    {top && <section className="evst-insight"><div><span>LEADING SELF-REPORTED PRIORITY</span><h2>{top.label}</h2><p>{top.count} of {total} owners chose this as the single issue they would most want solved. Compare this with observed past spending and interview narratives before making a product decision.</p></div><FiArrowDownRight aria-hidden="true"/></section>}
    <div className="evst-analytics-grid">
      <Distribution title="Highest-priority problems" description="One primary issue selected per interview." items={data.distributions?.issues || []} total={total}/>
      <Distribution title="Price willingness" description="Hypothetical maximum for a one-time repair document review." items={data.distributions?.prices || []} total={total}/>
      <Distribution title="Purchase intention" description="Consideration is not a confirmed payment." items={data.distributions?.interest || []} total={total}/>
      <section className="evst-card"><div className="evst-card-header"><div><h2>Weekly interview volume</h2><p>Submission counts, newest weeks on the right.</p></div><FiBarChart2 aria-hidden="true"/></div>
        {data.weeks?.length ? <div className="evst-trend">{data.weeks.map(point => <div key={point.week} className="evst-trend-column"><span style={{ height: Math.max(5, point.count / Math.max(...data.weeks.map(x => x.count), 1) * 125) + 'px' }} title={point.week + ': ' + point.count + ' interviews'}/><strong>{point.count}</strong><small>{point.week.slice(5)}</small></div>)}</div> : <p className="evst-empty">Interview volume will appear here after the first submission.</p>}
      </section>
    </div>
    <section className="evst-card evst-records"><div className="evst-card-header"><div><h2>Interview records</h2><p>Full individual answers, available only to the authenticated site owner.</p></div><button type="button" className="evst-icon" onClick={() => setRefresh(r => r + 1)} aria-label="Refresh EV interviews"><FiRefreshCw/></button></div>
      <div className="evst-search"><FiSearch aria-hidden="true"/><input type="search" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} placeholder="Search reference, EV model or city" aria-label="Search interviews"/><span>{data.matchCount} matching</span></div>
      {message && <p className="evst-error" role="alert">{message}</p>}
      {state === 'loading' && <p className="evst-empty" role="status">Loading research responses…</p>}
      {state === 'error' && <button type="button" className="evst-outline" onClick={() => setRefresh(r => r + 1)}>Retry loading</button>}
      {state === 'ready' && (data.items?.length ? <div className="evst-record-list">{data.items.map(row => <article className="evst-record" key={row.reference_id}>
        <button type="button" className="evst-record-head" onClick={() => setSelected(selected === row.reference_id ? '' : row.reference_id)} aria-expanded={selected === row.reference_id}><span className="evst-ref">{row.reference_id}<small>{format(row.created_at)}</small></span><span><strong>{show(row.answers?.ev_model)}</strong><small>{show(row.answers?.city)}</small></span><span><strong>{show(row.answers?.primary_issue)}</strong><small>Primary pain point</small></span><span><strong>{show(row.answers?.pay_for_review)}</strong><small>Paid-review consideration</small></span><FiArrowRight className={selected === row.reference_id ? 'is-open' : ''}/></button>
        {selected === row.reference_id && <div className="evst-record-body"><div className="evst-answer-grid">{SURVEY_QUESTIONS.map(question => <div key={question.id} className="evst-answer"><span>{question.title}</span><p>{show(row.answers?.[question.id])}</p></div>)}</div><div className="evst-record-actions"><span>Interview answers are private; delete on verified withdrawal or expiry.</span><button type="button" onClick={() => void erase(row.reference_id)}><FiTrash2/> Erase this interview</button></div></div>}
      </article>)}</div> : <p className="evst-empty">No interviews match this search. Open the form to record the first conversation.</p>)}
      <div className="evst-pagination"><span>Page {data.page} · {data.matchCount} matching records</span><div><button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button><button type="button" disabled={page * 25 >= data.matchCount} onClick={() => setPage(p => p + 1)}>Next</button></div></div>
    </section>
    <p className="evst-footer">Research quality reminder: recruit owners across brands and different usage patterns, avoid leading questions, and treat willingness-to-pay responses as hypotheses until someone purchases.</p>
  </main>;
}
