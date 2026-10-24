import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowLeft, FiArrowRight, FiCheck, FiCheckCircle, FiChevronRight, FiLock, FiRotateCcw, FiShield, FiWifiOff } from 'react-icons/fi';
import { SURVEY_QUESTIONS, SURVEY_SECTIONS, SURVEY_VERSION, validateSurveyAnswers } from '../shared/ev-survey.mjs';
import './EVSurvey.css';

const STORAGE_KEY = 'vm-ev-owner-interview-v1';
const EXPIRY = 7 * 24 * 60 * 60 * 1000;
const freshDraft = () => ({ step: -1, answers: {}, consent: false, submissionId: crypto.randomUUID() });
function loadDraft() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved && saved.version === SURVEY_VERSION && Date.now() - saved.savedAt < EXPIRY &&
      Number.isInteger(saved.step) && saved.step >= -1 && saved.step <= SURVEY_QUESTIONS.length &&
      typeof saved.answers === 'object' && saved.answers && typeof saved.submissionId === 'string') {
      return { step: saved.step, answers: saved.answers, consent: saved.consent === true, submissionId: saved.submissionId };
    }
  } catch { /* Unavailable browser storage is not a blocker. */ }
  return freshDraft();
}
function valueLabel(value) { return Array.isArray(value) ? value.join(', ') : (value || 'Not answered'); }
function Option({ selected, children, onClick, multiple = false }) {
  return <button type="button" className={'evs-choice' + (selected ? ' is-selected' : '')} aria-pressed={selected} onClick={onClick}>
    <span className={'evs-choice-mark' + (multiple ? ' evs-square' : '')}>{selected && <FiCheck aria-hidden="true"/>}</span><span>{children}</span><FiChevronRight className="evs-choice-chevron" aria-hidden="true"/>
  </button>;
}
function QuestionInput({ question, answer, onChange }) {
  if (question.type === 'single') return <div className="evs-options" role="group" aria-label={question.title}>{question.options.map((option) =>
    <Option key={option} selected={answer === option} onClick={() => onChange(option)}>{option}</Option>
  )}</div>;
  if (question.type === 'multi') return <><p className="evs-inline-help">Choose all that apply.</p><div className="evs-options" role="group" aria-label={question.title}>{question.options.map((option) =>
    <Option key={option} multiple selected={Array.isArray(answer) && answer.includes(option)} onClick={() => {
      const before = Array.isArray(answer) ? answer : [];
      const exclusive = ['None of these', 'Nothing is particularly difficult'];
      if (before.includes(option)) onChange(before.filter(item => item !== option));
      else if (exclusive.includes(option)) onChange([option]);
      else onChange([...before.filter(item => !exclusive.includes(item)), option]);
    }}>{option}</Option>
  )}</div></>;
  return question.type === 'long'
    ? <textarea id={'evs-'+question.id} className="evs-textfield evs-textarea" rows={5} maxLength={1500} placeholder={question.placeholder || 'Your answer'} value={answer || ''} onChange={event => onChange(event.target.value)}/>
    : <input id={'evs-'+question.id} className="evs-textfield" type="text" maxLength={120} placeholder={question.placeholder || 'Your answer'} value={answer || ''} onChange={event => onChange(event.target.value)}/>;
}

export default function EVSurvey() {
  const [draft, setDraft] = useState(loadDraft);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const index = draft.step;
  const current = SURVEY_QUESTIONS[index];
  const review = index === SURVEY_QUESTIONS.length;
  const started = index >= 0;
  const progress = Math.round(Math.min(Math.max(index, 0), SURVEY_QUESTIONS.length) / SURVEY_QUESTIONS.length * 100);
  const sectionIndex = current ? SURVEY_SECTIONS.indexOf(current.section) : SURVEY_SECTIONS.length - 1;

  useEffect(() => {
    if (complete) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...draft, version: SURVEY_VERSION, savedAt: Date.now() })); }
    catch { /* A working form does not require local storage. */ }
  }, [draft, complete]);
  const patch = (change) => { setError(''); setDraft(previous => ({ ...previous, ...change })); };
  const answer = (value) => patch({ answers: { ...draft.answers, [current.id]: value } });
  const next = () => {
    const state = validateSurveyAnswers({ [current.id]: draft.answers[current.id] });
    if (state.errors[current.id]) { setError(state.errors[current.id]); return; }
    patch({ step: index + 1 });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const back = () => { patch({ step: Math.max(-1, index - 1) }); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const submit = async () => {
    const checked = validateSurveyAnswers(draft.answers);
    if (!checked.ok) {
      const first = SURVEY_QUESTIONS.findIndex(q => checked.errors[q.id]);
      patch({ step: first < 0 ? 0 : first });
      setError('Please complete this required answer.');
      return;
    }
    if (!draft.consent) { setError('Participant consent is required.'); return; }
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/ev-survey', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ surveyVersion: SURVEY_VERSION, submissionId: draft.submissionId, answers: checked.answers, consent: true, website: honeypot }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.message || 'Could not submit this interview.');
      setComplete(result.referenceId);
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* No-op */ }
    } catch (submitError) { setError(submitError.message || 'Submission unavailable. Your answers are still on this device.'); }
    finally { setBusy(false); }
  };
  const reset = () => { setComplete(''); setError(''); setHoneypot(''); setDraft(freshDraft()); };
  return <main className="evs-page" id="main-content">
    <div className="evs-wrap">
      <div className="evs-topline"><span className="evs-symbol">VM<span>.</span></span><span>INDEPENDENT FIELD RESEARCH <span aria-hidden="true">/</span> 2026</span><span className="evs-top-private"><FiLock aria-hidden="true"/> Private responses</span></div>
      {complete ? <section className="evs-card evs-complete" aria-live="polite">
        <span className="evs-success-icon"><FiCheckCircle/></span>
        <p className="evs-kicker">INTERVIEW SUBMITTED</p><h1>Recorded. Thank you.</h1>
        <p>Responses were saved to the private EV research workspace. Keep this reference to locate the interview later.</p>
        <div className="evs-reference"><span>Interview reference</span><strong>{complete}</strong></div>
        <button type="button" className="evs-primary" onClick={reset}>Begin another interview <FiArrowRight/></button>
        <p className="evs-footnote">Only the site owner can access individual responses or analytics.</p>
      </section> : !started ? <section className="evs-intro">
        <div className="evs-intro-grid">
          <div><p className="evs-kicker"><span className="evs-live-dot"/> EV OWNER RESEARCH / INDIA</p><h1>Real EV problems.<br/><em>Real owner stories.</em></h1>
            <p className="evs-lede">A one-to-one conversation about what actually happens after someone buys an electric car. Charging, breakdowns, service, costs, warranties and the workarounds owners use today.</p>
            <div className="evs-intro-meta"><span><strong>{SURVEY_QUESTIONS.length}</strong> short questions</span><span><strong>15–20</strong> minutes</span><span><strong>{SURVEY_SECTIONS.length}</strong> research stages</span></div>
          </div>
          <div className="evs-intro-panel">
            <div className="evs-panel-no">01 / FIELD NOTES</div>
            <h2>Before we begin</h2>
            <p>Ask about situations the owner has personally experienced. Do not suggest an answer or promise a future product.</p>
            <ul><li>No name, number plate, Aadhaar or phone number required.</li><li>Participation is voluntary. Any question can be declined by ending the interview.</li><li>Responses will be kept privately for research, up to 12 months, and never sold.</li></ul>
            <label className="evs-consent"><input type="checkbox" checked={draft.consent} onChange={event => patch({ consent: event.target.checked })}/><span>The participant agrees to this research interview and the <Link to="/privacy">privacy notice</Link>.</span></label>
            {error && <p className="evs-error" role="alert">{error}</p>}
            <button type="button" className="evs-primary" onClick={() => draft.consent ? patch({ step: 0 }) : setError('Please confirm the participant agrees before beginning.')}>Start interview <FiArrowRight/></button>
            <div className="evs-privacy"><FiShield aria-hidden="true"/> Stored privately. Nothing is published automatically.</div>
          </div>
        </div>
      </section> : <section className="evs-interview">
        <div className="evs-progress-top"><span>QUESTION {review ? SURVEY_QUESTIONS.length : index + 1} / {SURVEY_QUESTIONS.length}</span><span>{progress}% COMPLETE</span></div>
        <div className="evs-progress" role="progressbar" aria-label="Interview progress" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: progress + '%' }}/></div>
        <nav className="evs-stages" aria-label="Research stages">{SURVEY_SECTIONS.map((section, pos) => <span key={section} className={pos === sectionIndex ? 'active' : pos < sectionIndex || review ? 'done' : ''}>{String(pos+1).padStart(2,'0')} {section}</span>)}</nav>
        {review ? <div className="evs-card evs-review">
          <p className="evs-kicker">FINAL REVIEW</p><h1>Review the conversation.</h1><p className="evs-subcopy">Check the responses before submitting. You can edit any answer below.</p>
          <div className="evs-review-list">{SURVEY_QUESTIONS.map((question, pos) => <div className="evs-review-row" key={question.id}><div><span>{String(pos+1).padStart(2,'0')} / {question.section}</span><p>{question.title}</p><strong>{valueLabel(draft.answers[question.id])}</strong></div><button type="button" onClick={() => patch({ step: pos })} aria-label={'Edit answer to '+question.title}>Edit</button></div>)}</div>
          {error && <div className="evs-error" role="alert">{error}</div>}
          <div className="evs-actions"><button className="evs-secondary" type="button" onClick={back}><FiArrowLeft/> Back</button><button className="evs-primary" type="button" onClick={submit} disabled={busy}>{busy ? 'Submitting securely…' : 'Submit interview'} <FiCheck/></button></div>
        </div> : <div className="evs-card evs-question" key={current.id}>
          <p className="evs-kicker">{current.section.toUpperCase()} <span>/</span> {String(index+1).padStart(2,'0')}</p>
          <h1>{current.title}</h1>
          {current.help && <p className="evs-subcopy">{current.help}</p>}
          {!current.required && <p className="evs-optional">Optional — you may leave this blank</p>}
          <div className="evs-answer">
            {(current.type === 'text' || current.type === 'long') && <label htmlFor={'evs-'+current.id} className="evs-answer-label">Your answer</label>}
            <QuestionInput question={current} answer={draft.answers[current.id]} onChange={answer}/>
          </div>
          {error && <div role="alert" className="evs-error">{error}</div>}
          <div className="evs-actions"><button className="evs-secondary" type="button" onClick={back}><FiArrowLeft/> Back</button><span className="evs-auto-save">Draft saved on this device</span><button type="button" className="evs-primary" onClick={next}>{index === SURVEY_QUESTIONS.length - 1 ? 'Review answers' : 'Next question'} <FiArrowRight/></button></div>
        </div>}
        <div className="evs-under-card"><span><FiShield/> Responses are private to the researcher</span><span><FiWifiOff/> Unsubmitted drafts remain on this device</span></div>
      </section>}
      <footer className="evs-bottom"><span>EV OWNER STUDY / VAMSI MARRIPUDI</span><span><Link to="/privacy">Privacy</Link> <span aria-hidden="true">·</span> <a href="mailto:connect@vamsimarripudi.me?subject=EV%20Survey%20Privacy%20Request">Privacy request</a> <span aria-hidden="true">·</span> {!complete && started && <button type="button" onClick={() => { if (window.confirm('Discard all answers from this device?')) reset(); }}><FiRotateCcw/> Discard draft</button>}</span></footer>
    </div>
  </main>;
}
