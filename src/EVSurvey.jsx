import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowLeft, FiArrowRight, FiCheck, FiCheckCircle, FiChevronRight, FiClock, FiLock, FiRotateCcw, FiShield, FiUsers, FiWifiOff, FiZap } from 'react-icons/fi';
import { SURVEY_QUESTIONS, SURVEY_SECTIONS, SURVEY_VERSION, validateSurveyAnswers } from '../shared/ev-survey.mjs';
import './EVSurvey.css';

const STORAGE_KEY = 'vm-ev-owner-interview-v2';
const EXPIRY = 7 * 24 * 60 * 60 * 1000;
const PHASES = ['About you', 'Vehicle profile', 'Real experience', 'Value & permission'];
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
function phaseForSection(section) {
  if (section === 'Basic details') return 0;
  if (section === 'Your EV') return 1;
  if (['Real experiences', 'Service & expense', 'Current solutions'].includes(section)) return 2;
  return 3;
}

function PhaseStepper({ active }) {
  return <nav className="evs-phase-stepper" aria-label="Interview phases">
    {PHASES.map((phase, index) => <div key={phase} className={'evs-phase-item' + (index === active ? ' is-active' : '') + (index < active ? ' is-complete' : '')}>
      <span className="evs-phase-number">{index < active ? <FiCheck aria-hidden="true"/> : index + 1}</span>
      <span className="evs-phase-label">{phase}</span>
    </div>)}
  </nav>;
}

function Option({ selected, children, onClick, multiple = false }) {
  return <button type="button" className={'evs-choice' + (selected ? ' is-selected' : '')} aria-pressed={selected} onClick={onClick}>
    <span className={'evs-choice-mark' + (multiple ? ' evs-square' : '')}>{selected && <FiCheck aria-hidden="true"/>}</span>
    <span>{children}</span>
    <FiChevronRight className="evs-choice-chevron" aria-hidden="true"/>
  </button>;
}

function QuestionInput({ question, answer, onChange, onAdvance }) {
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
    : <input id={'evs-'+question.id} className="evs-textfield" type={question.type === 'phone' ? 'tel' : 'text'} inputMode={question.type === 'phone' ? 'tel' : undefined} autoComplete={question.type === 'phone' ? 'tel-national' : 'off'} enterKeyHint="next" onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); onAdvance(); } }} maxLength={question.type === 'phone' ? 20 : 120} placeholder={question.placeholder || 'Your answer'} value={answer || ''} onChange={event => onChange(event.target.value)}/>;
}

export default function EVSurvey() {
  const [draft, setDraft] = useState(loadDraft);
  const headingRef = useRef(null);
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
  const phaseIndex = current ? phaseForSection(current.section) : (review || complete ? PHASES.length - 1 : 0);

  useEffect(() => {
    const body = document.body;
    const root = document.documentElement;
    const header = document.querySelector('.site-header');
    const syncFrame = () => {
      const bottom = header?.getBoundingClientRect().bottom || 0;
      root.style.setProperty('--evs-frame-top', Math.max(0, Math.ceil(bottom)) + 'px');
    };
    body.classList.add('ev-survey-active');
    syncFrame();
    const observer = header && 'ResizeObserver' in window ? new window.ResizeObserver(syncFrame) : null;
    observer?.observe(header);
    window.addEventListener('resize', syncFrame);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', syncFrame);
      body.classList.remove('ev-survey-active');
      root.style.removeProperty('--evs-frame-top');
    };
  }, []);

  useEffect(() => { if (started && !complete) headingRef.current?.focus({ preventScroll: true }); }, [index, started, complete]);
  useEffect(() => {
    if (complete) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...draft, version: SURVEY_VERSION, savedAt: Date.now() })); }
    catch { /* A working form does not require local storage. */ }
  }, [draft, complete]);

  const patch = (change) => { setError(''); setDraft(previous => ({ ...previous, ...change })); };
  const answer = (value) => patch({ answers: { ...draft.answers, [current.id]: value, ...(current.id === 'follow_up_permission' && value === 'No, do not contact me' ? { participant_phone: '' } : {}) } });
  const next = () => {
    const state = validateSurveyAnswers({ [current.id]: draft.answers[current.id], ...(current.id === 'participant_phone' ? { follow_up_permission: draft.answers.follow_up_permission } : {}) });
    if (state.errors[current.id]) { setError(state.errors[current.id]); return; }
    document.activeElement?.blur?.();
    patch({ step: index + 1 });
    window.scrollTo({ top: 0, behavior: 'auto' });
  };
  const back = () => { document.activeElement?.blur?.(); patch({ step: Math.max(-1, index - 1) }); window.scrollTo({ top: 0, behavior: 'auto' }); };
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
  const discardDraft = () => { if (window.confirm('Discard all answers from this device?')) reset(); };

  return <main className="evs-page" id="main-content">
    <div className="evs-frame">
      <div className="evs-topline">
        <span>INDEPENDENT FIELD RESEARCH <span aria-hidden="true">/</span> 2026</span>
        <span className="evs-top-private"><FiLock aria-hidden="true"/> Private responses</span>
      </div>

      <div className="evs-shell">
        <section className="evs-intro" aria-label="EV owner research introduction">
          <div className="evs-story-copy">
            <p className="evs-kicker"><span className="evs-live-dot"/> EV OWNER RESEARCH / INDIA</p>
            <h1>Real EV problems.<br/><em>Real owner stories.</em></h1>
            <p className="evs-lede">A one-to-one conversation about what actually happens after someone buys an electric car. Charging, breakdowns, service, costs, warranties and the workarounds owners use today.</p>
          </div>

          <div className="evs-trust-grid" aria-label="Research principles">
            <span><b><FiUsers/></b><strong>Owner-first<br/>research</strong></span>
            <span><b><FiZap/></b><strong>Real-world<br/>EV usage</strong></span>
            <span><b><FiLock/></b><strong>Private,<br/>confidential</strong></span>
          </div>

          <div className="evs-intro-meta" aria-label="Interview overview">
            <span><strong>{SURVEY_QUESTIONS.length}</strong> short questions</span>
            <span><strong>15–25 min</strong> one conversation</span>
            <span><strong>{SURVEY_SECTIONS.length}</strong> research stages</span>
          </div>

          <div className="evs-legal-links">
            <Link to="/privacy">Privacy</Link><span aria-hidden="true">·</span>
            <a href="mailto:connect@vamsimarripudi.me?subject=EV%20Survey%20Privacy%20Request">Privacy request</a>
            {!complete && started && <><span aria-hidden="true">·</span><button type="button" onClick={discardDraft}><FiRotateCcw/> Discard draft</button></>}
          </div>

          <div className="evs-car-art" aria-hidden="true">
            <span className="evs-car-body"/>
            <span className="evs-car-glass"/>
            <span className="evs-car-light"/>
            <span className="evs-charge-port"/>
            <span className="evs-charge-cable"/>
          </div>
        </section>

        <section className="evs-workspace" aria-label="EV owner interview form">
          <PhaseStepper active={phaseIndex}/>
          <div className="evs-workspace-body">
            {complete ? <section className="evs-card evs-complete" aria-live="polite">
              <span className="evs-success-icon"><FiCheckCircle/></span>
              <p className="evs-kicker">INTERVIEW SUBMITTED</p>
              <h1>Recorded. Thank you.</h1>
              <p>Responses were saved to the private EV research workspace. Keep this reference to locate the interview later.</p>
              <div className="evs-reference"><span>Interview reference</span><strong>{complete}</strong></div>
              <button type="button" className="evs-primary" onClick={reset}>Begin another interview <FiArrowRight/></button>
              <p className="evs-footnote">Only the site owner can access individual responses or analytics.</p>
            </section> : !started ? <section className="evs-start">
              <div className="evs-panel-no">01 / FIELD NOTES</div>
              <h2>Before we begin</h2>
              <p className="evs-start-lede">Ask about situations the owner has personally experienced. Do not suggest an answer or promise a future product.</p>

              <div className="evs-brief-grid">
                <div><FiCheckCircle/><span><strong>Optional identity</strong><small>Name or nickname is optional.</small></span></div>
                <div><FiShield/><span><strong>Private by design</strong><small>Nothing is published automatically.</small></span></div>
                <div><FiClock/><span><strong>Focused interview</strong><small>Usually 15–25 minutes.</small></span></div>
              </div>

              <div className="evs-start-note">
                <strong>Please avoid sensitive identifiers.</strong>
                <p>Do not enter a number plate, Aadhaar, full address or other identity information. Responses are private, kept up to 12 months, and never sold.</p>
              </div>

              <label className="evs-consent">
                <input type="checkbox" checked={draft.consent} onChange={event => patch({ consent: event.target.checked })}/>
                <span>The participant agrees to this research interview and the <Link to="/privacy">privacy notice</Link>.</span>
              </label>
              {error && <p className="evs-error" role="alert">{error}</p>}
              <div className="evs-start-footer">
                <div className="evs-privacy"><FiShield aria-hidden="true"/> Stored privately. Nothing is published automatically.</div>
                <button type="button" className="evs-primary" onClick={() => draft.consent ? patch({ step: 0 }) : setError('Please confirm the participant agrees before beginning.')}>Start interview <FiArrowRight/></button>
              </div>
            </section> : <section className="evs-interview">
              <div className="evs-progress-top"><span>QUESTION {review ? SURVEY_QUESTIONS.length : index + 1} / {SURVEY_QUESTIONS.length}</span><span>{progress}% COMPLETE</span></div>
              <div className="evs-progress" role="progressbar" aria-label="Interview progress" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: progress + '%' }}/></div>
              <div className="evs-mobile-stage" aria-live="polite"><span>STAGE {review ? SURVEY_SECTIONS.length : sectionIndex + 1} OF {SURVEY_SECTIONS.length}</span><strong>{review ? 'Review answers' : current.section}</strong></div>

              {review ? <div className="evs-card evs-review">
                <p className="evs-kicker">FINAL REVIEW</p>
                <h1 tabIndex={-1} ref={headingRef}>Review the conversation.</h1>
                <p className="evs-subcopy">Check the responses before submitting. You can edit any answer below.</p>
                <div className="evs-review-list">{SURVEY_QUESTIONS.map((question, pos) => <div className="evs-review-row" key={question.id}><div><span>{String(pos+1).padStart(2,'0')} / {question.section}</span><p>{question.title}</p><strong>{valueLabel(draft.answers[question.id])}</strong></div><button type="button" onClick={() => patch({ step: pos })} aria-label={'Edit answer to '+question.title}>Edit</button></div>)}</div>
                {error && <div className="evs-error" role="alert">{error}</div>}
                <div className="evs-actions"><button className="evs-secondary" type="button" onClick={back}><FiArrowLeft/> Back</button><button className="evs-primary" type="button" onClick={submit} disabled={busy}>{busy ? 'Submitting securely…' : 'Submit interview'} <FiCheck/></button></div>
              </div> : <div className="evs-card evs-question" key={current.id}>
                <div className="evs-question-heading">
                  <p className="evs-kicker">{current.section.toUpperCase()} <span>/</span> {String(index+1).padStart(2,'0')}</p>
                  <h1 tabIndex={-1} ref={headingRef}>{current.title}</h1>
                  {current.help && <p className="evs-subcopy">{current.help}</p>}
                  {!current.required && <p className="evs-optional">{current.id === 'participant_phone' && draft.answers.follow_up_permission === 'Yes, contact me once about this EV research' ? 'Requested only because the owner opted in to a follow-up.' : 'Optional — you may leave this blank'}</p>}
                </div>
                <div className="evs-answer">
                  {(current.type === 'text' || current.type === 'long' || current.type === 'phone') && <label htmlFor={'evs-'+current.id} className="evs-answer-label">Your answer</label>}
                  {current.id === 'participant_phone' && draft.answers.follow_up_permission !== 'Yes, contact me once about this EV research' ? <p className="evs-no-contact">The owner declined follow-up, so no mobile number is requested. Continue to the next question.</p> : <QuestionInput question={current} answer={draft.answers[current.id]} onChange={answer} onAdvance={next}/>}
                </div>
                {error && <div role="alert" className="evs-error">{error}</div>}
                <div className="evs-actions"><button className="evs-secondary" type="button" onClick={back}><FiArrowLeft/> Back</button><span className="evs-auto-save">Draft saved on this device</span><button type="button" className="evs-primary" onClick={next}>{index === SURVEY_QUESTIONS.length - 1 ? 'Review answers' : 'Next question'} <FiArrowRight/></button></div>
              </div>}

              <div className="evs-under-card"><span><FiShield/> Responses are private to the researcher</span><span><FiWifiOff/> Unsubmitted drafts remain on this device</span></div>
            </section>}
          </div>
        </section>
      </div>
    </div>
    <input className="evs-honeypot" tabIndex={-1} autoComplete="off" aria-hidden="true" value={honeypot} onChange={event => setHoneypot(event.target.value)} name="website"/>
  </main>;
}
