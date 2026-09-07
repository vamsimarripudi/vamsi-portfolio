import { useEffect, useMemo, useRef, useState } from 'react';
import { FiArrowLeft, FiCopy, FiMusic, FiPause, FiPlay, FiRotateCcw, FiShare2 } from 'react-icons/fi';
import { DEFAULT_BIRTHDAY_MESSAGE, BIRTHDAY_LIMITS, birthdayShareUrl, decodeBirthdayPayload, normalizeBirthdayData } from './birthday-utils.js';
import './Birthday.css';

const setBirthdayMeta = () => {
  const description = 'Create and share a beautifully handwritten birthday surprise.';
  const set = (selector, content) => document.head.querySelector(selector)?.setAttribute('content', content);
  document.title = 'Birthday Surprise | Vamsi Marripudi';
  set('meta[name="description"]', description);
  set('meta[property="og:title"]', 'A birthday surprise is waiting for you 🎂');
  set('meta[property="og:description"]', 'A small handwritten birthday surprise, made especially for you.');
  set('meta[name="twitter:title"]', 'A birthday surprise is waiting for you 🎂');
  set('meta[name="twitter:description"]', 'A small handwritten birthday surprise, made especially for you.');
};

const useReducedMotion = () => {
  const [reduced, setReduced] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!query) return undefined;
    const change = () => setReduced(query.matches);
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, []);
  return reduced;
};

function useBirthdayAudio() {
  const contextRef = useRef(null);
  const timersRef = useRef([]);
  const [muted, setMuted] = useState(false);
  const stop = () => {
    timersRef.current.forEach(window.clearTimeout);
    timersRef.current = [];
    contextRef.current?.close?.().catch(() => {});
    contextRef.current = null;
  };
  useEffect(() => stop, []);
  const start = () => {
    if (contextRef.current) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const context = new AudioContext();
      contextRef.current = context;
      const notes = [523.25, 659.25, 783.99, 659.25, 587.33, 698.46, 783.99, 1046.5];
      notes.forEach((frequency, index) => {
        const timer = window.setTimeout(() => {
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          oscillator.type = 'sine';
          oscillator.frequency.value = frequency;
          gain.gain.setValueAtTime(0.0001, context.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.045, context.currentTime + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.65);
          oscillator.connect(gain).connect(context.destination);
          oscillator.start();
          oscillator.stop(context.currentTime + 0.7);
        }, index * 530);
        timersRef.current.push(timer);
      });
    } catch { stop(); }
  };
  const play = () => { if (!muted) start(); };
  const toggle = () => {
    if (muted) { setMuted(false); start(); return; }
    setMuted(true);
    stop();
  };
  return { muted, play, stop, toggle };
}

function MugguFrame() {
  return <svg className="birthday-muggu" viewBox="0 0 1200 800" aria-hidden="true" focusable="false">
    <defs><pattern id="birthday-dots" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="14" cy="14" r="1.4"/></pattern></defs>
    <rect width="1200" height="800" fill="url(#birthday-dots)" opacity=".36"/>
    <g fill="none" stroke="currentColor" strokeWidth="1.4" opacity=".7">
      <path d="M42 222C106 158 106 82 42 18M18 42c64 64 140 64 204 0M42 18c-28 84 14 126 98 98C168 32 126-10 42 18z"/>
      <path d="M1158 222c-64-64-64-140 0-204m24 24c-64 64-140 64-204 0m180-24c28 84-14 126-98 98-28-84 14-126 98-98z"/>
      <path d="M42 578c64 64 64 140 0 204M18 758c64-64 140-64 204 0m-180 24c28-84-14-126 98-98 28 84-14 126-98 98z"/>
      <path d="M1158 578c-64 64-64 140 0 204m24-24c-64-64-140-64-204 0m180 24c-28-84 14-126-98-98-28 84 14 126 98 98z"/>
      <circle cx="600" cy="400" r="270" strokeDasharray="2 14" opacity=".42"/>
      <circle cx="600" cy="400" r="310" strokeDasharray="1 24" opacity=".25"/>
    </g>
  </svg>;
}

function CelebrationParticles({ active, quiet = false }) {
  const particles = useMemo(() => Array.from({ length: quiet ? 12 : 26 }, (_, index) => ({
    id: index, x: (index * 37) % 96 + 2, y: (index * 53) % 76 + 8, delay: (index % 8) * 85, rotate: (index * 47) % 180,
  })), [quiet]);
  return <div className={`birthday-particles ${active ? 'is-active' : ''}`} aria-hidden="true">{particles.map(particle => <i key={particle.id} style={{ '--x': `${particle.x}%`, '--y': `${particle.y}%`, '--delay': `${particle.delay}ms`, '--rotate': `${particle.rotate}deg` }}/>)}</div>;
}

function BirthdayEnvelope({ onOpen, disabled }) {
  return <div className={`birthday-envelope ${disabled ? 'is-opening' : ''}`}>
    <div className="envelope-shadow"/>
    <div className="envelope-back"/>
    <div className="envelope-flap"/>
    <div className="envelope-face"><span>For you</span><i/></div>
    <button className="wax-seal" type="button" onClick={onOpen} disabled={disabled} aria-label="Open the birthday letter"><b>V</b><small>Tap to open</small></button>
  </div>;
}

function BirthdayLetter({ data, stage, progress }) {
  const paragraphs = data.message.split(/\n\s*\n/).filter(Boolean);
  const complete = stage === 'complete';
  return <article className={`birthday-letter ${stage === 'letter' || stage === 'writing' || complete ? 'is-visible' : ''}`} aria-live="polite">
    <div className="letter-corner top-left"/><div className="letter-corner top-right"/><div className="letter-corner bottom-left"/><div className="letter-corner bottom-right"/>
    <p className="letter-to">Dear {data.recipientName},</p>
    <div className="letter-copy">{paragraphs.map((paragraph, index) => <p className={complete || index < progress ? 'is-written' : ''} key={`${paragraph}-${index}`}>{paragraph}</p>)}</div>
    <p className={`letter-signoff ${complete || progress >= paragraphs.length ? 'is-written' : ''}`}>With warm wishes,<br/><strong>{data.senderName}</strong></p>
    <span className={`writing-pen ${stage === 'writing' && !complete ? 'is-writing' : ''}`} aria-hidden="true"><i/><b/></span>
  </article>;
}

function RecipientToolbar({ audio, stage, onReadNow, onReplay, onShare }) {
  return <nav className="birthday-toolbar" aria-label="Birthday experience controls">
    <button type="button" onClick={audio.toggle} aria-pressed={audio.muted}>{audio.muted ? <FiPause/> : <FiMusic/>}<span>{audio.muted ? 'Sound off' : 'Sound'}</span></button>
    {(stage === 'writing' || stage === 'letter') && <button type="button" onClick={onReadNow}><FiPlay/><span>Read now</span></button>}
    {stage === 'complete' && <button type="button" onClick={onReplay}><FiRotateCcw/><span>Replay</span></button>}
    <button type="button" onClick={onShare}><FiShare2/><span>Share</span></button>
  </nav>;
}

function BirthdayExperience({ data, onExitPreview }) {
  const reduced = useReducedMotion();
  const [stage, setStage] = useState('intro');
  const [progress, setProgress] = useState(0);
  const [finalBurst, setFinalBurst] = useState(false);
  const timers = useRef([]);
  const audio = useBirthdayAudio();
  const clearTimers = () => { timers.current.forEach(window.clearTimeout); timers.current = []; };
  const later = (callback, delay) => { const timer = window.setTimeout(callback, delay); timers.current.push(timer); };
  useEffect(() => { later(() => setStage('envelope'), reduced ? 0 : 2200); return () => { clearTimers(); }; }, [reduced]);
  useEffect(() => {
    if (stage !== 'writing') return undefined;
    const paragraphs = data.message.split(/\n\s*\n/).filter(Boolean).length;
    if (reduced) { setProgress(paragraphs); setStage('complete'); setFinalBurst(true); return undefined; }
    setProgress(0);
    let current = 0;
    const interval = window.setInterval(() => {
      current += 1; setProgress(current);
      if (current >= paragraphs) { window.clearInterval(interval); later(() => { setStage('complete'); setFinalBurst(true); }, 700); }
    }, 900);
    return () => window.clearInterval(interval);
  }, [stage, data.message, reduced]);
  const open = () => {
    if (stage !== 'envelope') return;
    audio.play(); setStage('opening');
    later(() => setStage('letter'), reduced ? 80 : 800);
    later(() => setStage('writing'), reduced ? 140 : 1320);
  };
  const readNow = () => { const paragraphs = data.message.split(/\n\s*\n/).filter(Boolean).length; clearTimers(); setProgress(paragraphs); setStage('complete'); setFinalBurst(true); };
  const replay = () => { clearTimers(); audio.stop(); setProgress(0); setFinalBurst(false); setStage('intro'); later(() => setStage('envelope'), reduced ? 0 : 1200); };
  const share = async () => {
    const url = window.location.href;
    try { if (navigator.share) await navigator.share({ title: 'A birthday surprise is waiting for you 🎂', url }); else await navigator.clipboard?.writeText(url); } catch { /* Sharing is optional. */ }
  };
  return <main className={`birthday-page stage-${stage}`}>
    <MugguFrame/><CelebrationParticles active={stage === 'intro'} quiet={reduced}/>{finalBurst && <CelebrationParticles active quiet/>}
    {onExitPreview && <button className="birthday-preview-exit" type="button" onClick={onExitPreview}><FiArrowLeft/> Edit surprise</button>}
    <section className="birthday-scene" aria-labelledby="birthday-recipient">
      <p className="birthday-kicker">A little something for</p>
      <h1 id="birthday-recipient">{data.recipientName}</h1>
      <p className="birthday-quiet-note">Made with warm wishes from {data.senderName}</p>
      <div className="birthday-object"><BirthdayEnvelope onOpen={open} disabled={stage !== 'envelope'}/><BirthdayLetter data={data} stage={stage} progress={progress}/></div>
      {stage === 'complete' && <p className="birthday-final">Happy Birthday, {data.recipientName} <span aria-hidden="true">✦</span></p>}
    </section>
    <RecipientToolbar audio={audio} stage={stage} onReadNow={readNow} onReplay={replay} onShare={share}/>
  </main>;
}

function BirthdayCreator() {
  const [form, setForm] = useState({ recipientName: '', senderName: 'Vamsi', message: DEFAULT_BIRTHDAY_MESSAGE });
  const [previewing, setPreviewing] = useState(false);
  const [notice, setNotice] = useState('');
  const data = normalizeBirthdayData(form);
  const valid = Boolean(data.recipientName && data.message);
  const link = valid ? birthdayShareUrl(data) : '';
  const update = (key, value) => { setForm(current => ({ ...current, [key]: value })); setNotice(''); };
  const preview = () => { if (!valid) { setNotice('Add their name before previewing the surprise.'); return; } setPreviewing(true); };
  const copy = async () => { try { await navigator.clipboard.writeText(link); setNotice('Birthday link copied.'); } catch { setNotice('Copy the link from the field below.'); } };
  const share = async () => { try { if (navigator.share) await navigator.share({ title: 'A birthday surprise is waiting for you 🎂', text: 'I made a little birthday surprise for you 🎂', url: link }); else setNotice('Your browser does not support sharing here. Use WhatsApp or copy the link.'); } catch { /* User cancelled sharing. */ } };
  if (previewing) return <BirthdayExperience data={data} onExitPreview={() => setPreviewing(false)}/>;
  return <main className="birthday-creator"><MugguFrame/><section className="birthday-creator-card"><p className="creator-eyebrow">Vamsi Marripudi / birthday note</p><h1>Create a birthday surprise</h1><p className="creator-intro">A handwritten little moment they can open anywhere.</p><form onSubmit={(event) => { event.preventDefault(); preview(); }}>
      <label>Birthday person’s name<input value={form.recipientName} onChange={event => update('recipientName', event.target.value)} maxLength={BIRTHDAY_LIMITS.recipientName} autoComplete="name" placeholder="Their name" required/></label>
      <label>From<input value={form.senderName} onChange={event => update('senderName', event.target.value)} maxLength={BIRTHDAY_LIMITS.senderName} placeholder="Vamsi"/></label>
      <label>Birthday message<textarea value={form.message} onChange={event => update('message', event.target.value)} maxLength={BIRTHDAY_LIMITS.message} rows="9"/></label>
      <div className="creator-actions"><button className="birthday-primary" type="submit">Preview surprise</button><button className="birthday-secondary" type="button" onClick={() => { if (valid) setNotice('Your birthday link is ready below.'); else setNotice('Add their name before creating a link.'); }}>Create birthday link</button></div>
    </form>{notice && <p className="creator-notice" role="status">{notice}</p>}
    {link && <section className="birthday-share-panel" aria-label="Share birthday surprise"><label>Shareable link<input value={link} readOnly aria-label="Shareable birthday link"/></label><div><button type="button" onClick={copy}><FiCopy/> Copy link</button><a href={`https://wa.me/?text=${encodeURIComponent(`I made a little birthday surprise for you 🎂 Open it here: ${link}`)}`} target="_blank" rel="noreferrer">WhatsApp</a><button type="button" onClick={share}><FiShare2/> Share</button></div></section>}
  </section></main>;
}

export default function BirthdayPage() {
  const recipientData = useMemo(() => decodeBirthdayPayload(new URLSearchParams(window.location.search).get('b')), []);
  useEffect(() => {
    setBirthdayMeta();
    const robots = document.createElement('meta'); robots.name = 'robots'; robots.content = 'noindex, nofollow'; robots.dataset.birthday = 'true'; document.head.appendChild(robots);
    return () => robots.remove();
  }, []);
  return recipientData ? <BirthdayExperience data={recipientData}/> : <BirthdayCreator/>;
}
