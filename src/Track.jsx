import { useEffect, useState } from 'react';
import { Link, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiExternalLink, FiLock, FiLogOut, FiMail, FiRefreshCw, FiSend } from 'react-icons/fi';
import { useToast } from './Resilience.jsx';
import './Track.css';

const OWNER = 'enquiry.portfolio@vamsimarripudi.tech';
const statuses = ['NEW', 'ACKNOWLEDGED', 'REVIEWING', 'REPLIED', 'FOLLOW_UP_DUE', 'WAITING_ON_CONTACT', 'COMPLETED', 'CLOSED', 'SPAM', 'ERASURE_PENDING', 'ERASED'];
const priorityOptions = ['NORMAL', 'HIGH', 'URGENT'];

const request = async (url, options = {}) => {
  const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(data.message || 'The request could not be completed.'); error.status = response.status; error.code = data.code; throw error; }
  return data;
};

const formatDate = (value) => value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
const label = (value) => String(value || '').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
const statusClass = (status) => `track-status status-${String(status || '').toLowerCase().replaceAll('_', '-')}`;

function TrackHeader({ onLogout }) {
  return <header className="track-header"><Link to="/track" className="track-brand" aria-label="Enquiry Tracker home"><span>VM<span>.</span></span><b>Enquiry Tracker</b></Link><div><span className="track-private"><FiLock/> Private owner workspace</span>{onLogout && <button type="button" className="track-logout" onClick={onLogout}><FiLogOut/> Sign out</button>}</div></header>;
}

function SignIn({ onAuthenticated }) {
  const [email, setEmail] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [code, setCode] = useState('');
  const [state, setState] = useState('email');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const requestCode = async (event) => {
    event?.preventDefault();
    setState('sending'); setMessage(''); setMessageType('success');
    try {
      const result = await request('/api/track/auth/request', { method: 'POST', body: JSON.stringify({ email }) });
      setChallengeId(result.challengeId); setCode(''); setMessage(result.message); setMessageType('success'); setState('verify');
    } catch (error) { setMessage(error.message); setMessageType('error'); setState('email'); }
  };
  const verifyCode = async (event) => {
    event.preventDefault(); setState('verifying'); setMessage(''); setMessageType('success');
    try {
      await request('/api/track/auth/verify', { method: 'POST', body: JSON.stringify({ challengeId, code }) });
      onAuthenticated();
    } catch (error) { setMessage(error.message); setMessageType('error'); setState('verify'); }
  };
  const reset = () => { setChallengeId(''); setCode(''); setMessage(''); setMessageType('success'); setState('email'); };
  return <main className="track-auth"><section><p className="track-kicker">Vamsi Marripudi / private workspace</p><h1>Enquiry Tracker</h1>{state === 'email' || state === 'sending' ? <><p>Enter the approved owner email to receive a six-digit verification code.</p><form onSubmit={requestCode}><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required placeholder="enquiry.portfolio@vamsimarripudi.tech"/></label><button type="submit" disabled={state === 'sending'}>{state === 'sending' ? 'Sending code…' : <><FiMail/> Send verification code</>}</button></form></> : <><p>A verification code was sent to <strong>{OWNER}</strong>. Enter it below to open the private tracker.</p><form onSubmit={verifyCode}><label>Six-digit code<input className="track-otp-input" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength="6" required autoFocus placeholder="000000"/></label><button type="submit" disabled={state === 'verifying' || code.length !== 6}>{state === 'verifying' ? 'Verifying code…' : <><FiLock/> Verify and sign in</>}</button></form><button type="button" className="track-secondary-action" onClick={requestCode} disabled={state === 'verifying'}>Send a new code</button><button type="button" className="track-text-action" onClick={reset}>Use a different email</button></>}{message && <p className={messageType === 'error' ? 'track-alert' : 'track-success'} role={messageType === 'error' ? 'alert' : 'status'}>{message}</p>}<Link to="/" className="track-back"><FiArrowLeft/> Back to public site</Link></section></main>;
}
function Dashboard() {
  const toast = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState([]); const [metrics, setMetrics] = useState(null); const [state, setState] = useState('loading');
  const [filters, setFilters] = useState({ query: '', status: '' });
  const load = async () => { setState('loading'); try { const params = new URLSearchParams(); if (filters.query) params.set('q', filters.query); if (filters.status) params.set('status', filters.status); const [list, summary] = await Promise.all([request(`/api/track/enquiries?${params}`), request('/api/track/metrics')]); setItems(list.items || []); setMetrics(summary.metrics || {}); setState('ready'); } catch (error) { setState('error'); toast.error({ title: 'Tracker unavailable', description: error.message }); } };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { const timer = window.setTimeout(load, 180); return () => window.clearTimeout(timer); }, [filters.query, filters.status]);
  return <main className="track-page"><div className="track-page-title"><div><p className="track-kicker">Owner dashboard</p><h1>Incoming enquiries</h1><p>Private records from the website contact form, delivered to {OWNER}.</p></div><button type="button" className="track-icon-button" onClick={load} aria-label="Refresh enquiries"><FiRefreshCw/></button></div><section className="track-kpis" aria-label="Enquiry summary">{[['New', metrics?.new_count], ['In progress', metrics?.in_progress_count], ['Follow-up due', metrics?.follow_up_due_count], ['Completed', metrics?.completed_count]].map(([name, value]) => <article key={name}><span>{name}</span><strong>{metrics ? value : '—'}</strong></article>)}</section><section className="track-list"><div className="track-filters"><label>Search enquiries<input value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} placeholder="Name, email, subject, reference"/></label><label>Status<select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}><option value="">All statuses</option>{statuses.map((status) => <option key={status} value={status}>{label(status)}</option>)}</select></label></div>{state === 'loading' ? <p className="track-empty">Loading secure records…</p> : state === 'error' ? <div className="track-empty"><p>Records could not be loaded.</p><button type="button" onClick={load}>Try again</button></div> : items.length === 0 ? <p className="track-empty">No enquiries match these filters.</p> : <div className="track-table-wrap"><table><thead><tr><th>Enquiry</th><th>Intent</th><th>Status</th><th>Priority</th><th>Received</th><th/></tr></thead><tbody>{items.map((item) => <tr key={item.reference_id}><td><b>{item.name}</b><span>{item.email}</span><small>{item.reference_id}{item.subject ? ` · ${item.subject}` : ''}</small></td><td>{item.intent}</td><td><span className={statusClass(item.status)}>{label(item.status)}</span></td><td>{label(item.priority)}</td><td>{formatDate(item.created_at)}</td><td><button type="button" onClick={() => navigate(`/track/enquiries/${item.reference_id}`)} aria-label={`Open ${item.reference_id}`}><FiExternalLink/></button></td></tr>)}</tbody></table></div>}</section></main>;
}

function Detail() {
  const { referenceId } = useParams(); const navigate = useNavigate(); const toast = useToast(); const [record, setRecord] = useState(null); const [loading, setLoading] = useState(true); const [note, setNote] = useState(''); const [reply, setReply] = useState(''); const [actionBusy, setActionBusy] = useState(false); const [privacy, setPrivacy] = useState(''); const [followUpAt, setFollowUpAt] = useState('');
  const load = async () => { setLoading(true); try { const data = await request(`/api/track/enquiries/${encodeURIComponent(referenceId)}`); setRecord(data); } catch (error) { toast.error({ title: 'Enquiry unavailable', description: error.message }); } finally { setLoading(false); } };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [referenceId]);
  const act = async (payload, success) => { setActionBusy(true); try { await request(`/api/track/enquiries/${encodeURIComponent(referenceId)}/actions`, { method: 'POST', body: JSON.stringify(payload) }); toast.success({ title: success, description: 'The private record was updated.' }); await load(); } catch (error) { toast.error({ title: 'Update not saved', description: error.message }); } finally { setActionBusy(false); } };
  const sendReply = async (event) => { event.preventDefault(); if (!reply.trim()) return; setActionBusy(true); try { await request(`/api/track/enquiries/${encodeURIComponent(referenceId)}/reply`, { method: 'POST', body: JSON.stringify({ message: reply }) }); setReply(''); toast.success({ title: 'Reply sent', description: 'The message was sent and the enquiry is waiting on the contact.' }); await load(); } catch (error) { toast.error({ title: 'Reply not sent', description: error.message }); } finally { setActionBusy(false); } };
  if (loading) return <main className="track-page"><p className="track-empty">Loading secure record…</p></main>; if (!record?.enquiry) return <main className="track-page"><p className="track-empty">This enquiry is unavailable.</p><button type="button" onClick={() => navigate('/track')}>Back to dashboard</button></main>;
  const enquiry = record.enquiry;
  return <main className="track-page track-detail"><Link className="track-back" to="/track"><FiArrowLeft/> All enquiries</Link><div className="track-record-heading"><div><p className="track-kicker">{enquiry.reference_id}</p><h1>{enquiry.name}</h1><a href={`mailto:${enquiry.email}`}>{enquiry.email}</a></div><span className={statusClass(enquiry.status)}>{label(enquiry.status)}</span></div><div className="track-detail-grid"><section className="track-panel track-message"><p className="track-label">Contact message</p><h2>{enquiry.subject || enquiry.intent}</h2><p>{enquiry.message}</p><dl><div><dt>Intent</dt><dd>{enquiry.intent}</dd></div><div><dt>Received</dt><dd>{formatDate(enquiry.created_at)}</dd></div><div><dt>Follow-up</dt><dd>{formatDate(enquiry.follow_up_at)}</dd></div><div><dt>Retention review</dt><dd>{formatDate(new Date(new Date(enquiry.last_activity_at || enquiry.created_at).setMonth(new Date(enquiry.last_activity_at || enquiry.created_at).getMonth() + 24)))}</dd></div></dl></section><aside className="track-panel track-actions"><p className="track-label">Manage</p><label>Status<select value={enquiry.status} disabled={actionBusy || enquiry.status === 'ERASED'} onChange={(event) => act({ action: 'set_status', status: event.target.value }, 'Status updated')}><option value={enquiry.status}>{label(enquiry.status)}</option>{(record.allowedStatuses || []).map((status) => <option key={status} value={status}>{label(status)}</option>)}</select></label><label>Priority<select value={enquiry.priority} disabled={actionBusy || enquiry.status === 'ERASED'} onChange={(event) => act({ action: 'set_priority', priority: event.target.value }, 'Priority updated')}>{priorityOptions.map((priority) => <option key={priority} value={priority}>{label(priority)}</option>)}</select></label><label>Follow up<input type="datetime-local" value={followUpAt} onChange={(event) => setFollowUpAt(event.target.value)} disabled={actionBusy || enquiry.status === 'ERASED'}/></label><button type="button" onClick={() => { if (followUpAt) act({ action: 'set_follow_up', followUpAt }, 'Follow-up scheduled'); }} disabled={!followUpAt || actionBusy || enquiry.status === 'ERASED'}>Schedule follow-up</button></aside></div><div className="track-detail-grid"><form className="track-panel" onSubmit={(event) => { event.preventDefault(); if (note.trim()) { act({ action: 'add_note', body: note }, 'Note saved'); setNote(''); } }}><p className="track-label">Private note</p><label>Note<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Visible only in this tracker" maxLength="4000"/></label><button type="submit" disabled={!note.trim() || actionBusy}>Save note</button></form><form className="track-panel track-reply" onSubmit={sendReply}><p className="track-label">Reply by email</p><label>Reply to {enquiry.email}<textarea value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Write a clear, professional reply…" maxLength="6000"/></label><button type="submit" disabled={!reply.trim() || actionBusy}><FiSend/> Send reply</button></form></div><div className="track-detail-grid"><section className="track-panel"><p className="track-label">Activity</p><ol className="track-activity">{(record.activity || []).map((event) => <li key={event.id}><b>{label(event.event_type)}</b><span>{formatDate(event.created_at)}</span></li>)}</ol></section><section className="track-panel"><p className="track-label">Privacy workflow</p><label>Request type<select value={privacy} onChange={(event) => setPrivacy(event.target.value)} disabled={enquiry.status === 'ERASED'}><option value="">Select a request</option>{['ACCESS', 'CORRECTION', 'ERASURE', 'GRIEVANCE', 'WITHDRAWAL'].map((type) => <option key={type} value={type}>{label(type)}</option>)}</select></label><button type="button" disabled={!privacy || actionBusy || enquiry.status === 'ERASED'} onClick={() => act({ action: 'privacy_request', requestType: privacy }, 'Privacy request logged')}>Start privacy workflow</button>{enquiry.status === 'ERASURE_PENDING' && <button type="button" className="track-danger" disabled={actionBusy} onClick={() => { if (window.prompt('Type ERASE to permanently redact this record.') === 'ERASE') act({ action: 'erase', confirm: 'ERASE' }, 'Personal data redacted'); }}>Complete erasure</button>}</section></div>{record.notes?.length > 0 && <section className="track-panel"><p className="track-label">Notes</p><ul className="track-notes">{record.notes.map((item) => <li key={item.id}><p>{item.body}</p><small>{formatDate(item.created_at)}</small></li>)}</ul></section>}</main>;
}

function PrivateTrack() {
  const toast = useToast(); const [session, setSession] = useState('checking'); const location = useLocation();
  const checkSession = async () => { try { await request('/api/track/auth/session'); setSession('ready'); } catch (error) { if (error.status !== 401) toast.error({ title: 'Tracker configuration needed', description: error.message }); setSession('guest'); } };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { checkSession(); }, [location.pathname]);
  const logout = async () => { try { await request('/api/track/auth/logout', { method: 'POST', body: '{}' }); } finally { setSession('guest'); window.location.assign('/track'); } };
  if (session === 'checking') return <main className="track-auth"><p>Checking secure access…</p></main>;
  if (session === 'guest') return <SignIn onAuthenticated={() => setSession('ready')}/>;
  return <><TrackHeader onLogout={logout}/><Routes><Route index element={<Dashboard/>}/><Route path="enquiries/:referenceId" element={<Detail/>}/><Route path="*" element={<Dashboard/>}/></Routes></>;
}

export default function TrackApp() { return <PrivateTrack/>; }
