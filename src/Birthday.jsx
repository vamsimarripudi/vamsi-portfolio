import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FiArrowLeft, FiCopy, FiGift, FiMusic, FiPause, FiPlay, FiRotateCcw, FiShare2, FiX } from 'react-icons/fi';
import { BIRTHDAY_LIMITS, birthdayShareUrl, decodeBirthdayPayload, normalizeBirthdayData, randomBirthdayMessage } from './birthday-utils.js';
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

const makeNoise = (context, seconds) => {
  const length = Math.max(1, Math.floor(context.sampleRate * seconds));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < length; index += 1) samples[index] = (Math.random() * 2 - 1) * (1 - index / length);
  return buffer;
};

function useBirthdayAudio() {
  const contextRef = useRef(null);
  const timersRef = useRef([]);
  const mutedRef = useRef(false);
  const [muted, setMuted] = useState(false);
  useEffect(() => { mutedRef.current = muted; }, [muted]);
  const getContext = useCallback(() => {
    if (contextRef.current) return contextRef.current;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    contextRef.current = new AudioContext();
    return contextRef.current;
  }, []);
  const clear = useCallback(() => { timersRef.current.forEach(window.clearTimeout); timersRef.current = []; }, []);
  useEffect(() => () => { clear(); contextRef.current?.close?.().catch(() => {}); }, [clear]);
  const paper = useCallback(() => {
    if (mutedRef.current) return;
    try {
      const context = getContext(); if (!context) return;
      context.resume?.();
      const source = context.createBufferSource(); const filter = context.createBiquadFilter(); const gain = context.createGain();
      source.buffer = makeNoise(context, 0.48); filter.type = 'bandpass'; filter.frequency.value = 1650; filter.Q.value = 0.7;
      gain.gain.setValueAtTime(0.0001, context.currentTime); gain.gain.exponentialRampToValueAtTime(0.13, context.currentTime + 0.03); gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.46);
      source.connect(filter).connect(gain).connect(context.destination); source.start();
    } catch { /* Sound is progressive enhancement. */ }
  }, [getContext]);
  const celebrate = useCallback(() => {
    if (mutedRef.current) return;
    try {
      const context = getContext(); if (!context) return;
      context.resume?.();
      Array.from({ length: 11 }, (_, index) => index).forEach((index) => {
        const timer = window.setTimeout(() => {
          const clap = context.createBufferSource(); const filter = context.createBiquadFilter(); const gain = context.createGain();
          clap.buffer = makeNoise(context, 0.1); filter.type = 'highpass'; filter.frequency.value = 900 + (index % 3) * 180;
          gain.gain.setValueAtTime(0.0001, context.currentTime); gain.gain.exponentialRampToValueAtTime(0.055, context.currentTime + 0.008); gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.095);
          clap.connect(filter).connect(gain).connect(context.destination); clap.start();
        }, index * 95 + (index % 2) * 40);
        timersRef.current.push(timer);
      });
    } catch { /* Sound is progressive enhancement. */ }
  }, [getContext]);
  const toggle = useCallback(() => setMuted(current => !current), []);
  return { muted, paper, celebrate, toggle, clear };
}

function MugguFrame({ letter = false }) {
  const dots = letter ? 'letter-dots' : 'birthday-dots';
  return <svg className={letter ? 'letter-muggu' : 'birthday-muggu'} viewBox="0 0 1200 800" aria-hidden="true" focusable="false">
    <defs><pattern id={dots} width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="14" cy="14" r="1.4"/></pattern></defs>
    {!letter && <rect width="1200" height="800" fill={`url(#${dots})`} opacity=".35"/>}
    <g fill="none" stroke="currentColor" strokeWidth={letter ? '2' : '1.4'} opacity=".78">
      <path d="M42 222C106 158 106 82 42 18M18 42c64 64 140 64 204 0M42 18c-28 84 14 126 98 98C168 32 126-10 42 18z"/>
      <path d="M1158 222c-64-64-64-140 0-204m24 24c-64 64-140 64-204 0m180-24c28 84-14 126-98 98-28-84 14-126 98-98z"/>
      <path d="M42 578c64 64 64 140 0 204M18 758c64-64 140-64 204 0m-180 24c28-84-14-126 98-98 28 84-14 126-98 98z"/>
      <path d="M1158 578c-64 64-64 140 0 204m24-24c-64-64-140-64-204 0m180 24c28-84 14-126-98-98-28 84 14 126 98 98z"/>
      {!letter && <><circle cx="600" cy="400" r="270" strokeDasharray="2 14" opacity=".42"/><circle cx="600" cy="400" r="310" strokeDasharray="1 24" opacity=".25"/></>}
    </g>
  </svg>;
}

function CelebrationParticles({ active, quiet = false }) {
  const particles = useMemo(() => Array.from({ length: quiet ? 16 : 38 }, (_, index) => ({ id: index, x: (index * 37) % 96 + 2, delay: (index % 12) * 95, rotate: (index * 47) % 180, size: 5 + (index % 4) * 2 })), [quiet]);
  return <div className={`birthday-particles ${active ? 'is-active' : ''}`} aria-hidden="true">{particles.map(particle => <i key={particle.id} style={{ '--x': `${particle.x}%`, '--delay': `${particle.delay}ms`, '--rotate': `${particle.rotate}deg`, '--size': `${particle.size}px` }}/>)}</div>;
}

function BirthdayEnvelope({ onOpen, disabled }) {
  return <div className={`birthday-envelope ${disabled ? 'is-opening' : ''}`}><div className="envelope-shadow"/><div className="envelope-back"/><div className="envelope-flap"/><div className="envelope-face"><span>For you</span><i/></div><button className="wax-seal" type="button" onClick={onOpen} disabled={disabled} aria-label="Open the birthday letter"><b>V</b><small>Tap to open</small></button></div>;
}

function WrittenParagraph({ text, visibleCharacters, complete }) {
  return <p className="letter-paragraph">{Array.from(text).map((character, index) => <span className={complete || index < visibleCharacters ? 'is-written' : ''} key={`${character}-${index}`}>{character === ' ' ? ' ' : character}</span>)}</p>;
}

function BirthdayLetter({ data, stage, writtenCharacters }) {
  const paragraphs = data.message.split(/\n\s*\n/).filter(Boolean).slice(0, 4);
  const complete = stage === 'complete';
  let consumed = 0;
  return <article className={`birthday-letter ${stage === 'letter' || stage === 'writing' || complete ? 'is-visible' : ''}`} aria-live="polite"><MugguFrame letter/><p className="letter-title">A birthday letter</p><p className={`letter-greeting ${complete || writtenCharacters > 0 ? 'is-written' : ''}`}>Happy birthday, {data.recipientName}.</p><div className="letter-copy">{paragraphs.map((paragraph, index) => { const visible = Math.max(0, writtenCharacters - consumed); consumed += Array.from(paragraph).length; return <WrittenParagraph text={paragraph} visibleCharacters={visible} complete={complete} key={`${paragraph}-${index}`}/>; })}</div><p className={`letter-signoff ${complete ? 'is-written' : ''}`}>From<br/><strong>{data.senderName}</strong></p><span className={`writing-pen ${stage === 'writing' && !complete ? 'is-writing' : ''}`} aria-hidden="true"><i/><b/></span></article>;
}

function RecipientToolbar({ audio, stage, onReadNow, onReplay, onShare }) {
  return <nav className="birthday-toolbar" aria-label="Birthday experience controls"><button type="button" onClick={audio.toggle} aria-pressed={audio.muted}>{audio.muted ? <FiPause/> : <FiMusic/>}<span>{audio.muted ? 'Sound off' : 'Sound'}</span></button>{(stage === 'writing' || stage === 'letter') && <button type="button" onClick={onReadNow}><FiPlay/><span>Read now</span></button>}{stage === 'complete' && <button type="button" onClick={onReplay}><FiRotateCcw/><span>Replay</span></button>}<button type="button" onClick={onShare}><FiShare2/><span>Share</span></button></nav>;
}

function MakeWishPanel({ onClose }) {
  const [recipientName, setRecipientName] = useState(''); const [senderName, setSenderName] = useState(''); const [message, setMessage] = useState(randomBirthdayMessage); const [notice, setNotice] = useState('');
  const data = normalizeBirthdayData({ recipientName, senderName, message }); const link = data.recipientName ? birthdayShareUrl(data) : '';
  const copy = async () => { try { await navigator.clipboard.writeText(link); setNotice('Your birthday link is ready to share.'); } catch { setNotice('Copy your link from the field below.'); } };
  return <section className="make-wish-panel" role="dialog" aria-modal="true" aria-labelledby="make-wish-title"><button type="button" className="make-wish-close" onClick={onClose} aria-label="Close"><FiX/></button><p className="creator-eyebrow">make a little moment</p><h2 id="make-wish-title">Who are you celebrating?</h2><p>Write the feeling you want them to open. Their link is private and shareable.</p><label>Their name<input value={recipientName} onChange={event => setRecipientName(event.target.value)} maxLength={BIRTHDAY_LIMITS.recipientName} placeholder="Manohar" autoFocus/></label><label>From<input value={senderName} onChange={event => setSenderName(event.target.value)} maxLength={BIRTHDAY_LIMITS.senderName} placeholder="Satish"/></label><label>Your note<textarea value={message} onChange={event => setMessage(event.target.value)} maxLength={BIRTHDAY_LIMITS.message} rows="5"/></label>{link && <><input className="make-wish-link" value={link} readOnly aria-label="Your shareable birthday link"/><button className="birthday-primary" type="button" onClick={copy}><FiCopy/> Copy my birthday link</button></>}{notice && <p className="creator-notice" role="status">{notice}</p>}</section>;
}

function BirthdayExperience({ data, onExitPreview }) {
  const reduced = useReducedMotion(); const [stage, setStage] = useState('intro'); const [writtenCharacters, setWrittenCharacters] = useState(0); const [celebrating, setCelebrating] = useState(true); const [makerOpen, setMakerOpen] = useState(false);
  const timers = useRef([]); const { muted, paper, celebrate, toggle, clear: clearAudio } = useBirthdayAudio();
  const paragraphs = data.message.split(/\n\s*\n/).filter(Boolean).slice(0, 4); const totalCharacters = Array.from(paragraphs.join('')).length;
  const clearTimers = () => { timers.current.forEach(window.clearTimeout); timers.current = []; };
  const later = (callback, delay) => { const timer = window.setTimeout(callback, delay); timers.current.push(timer); };
  useEffect(() => { later(() => setStage('envelope'), reduced ? 0 : 2100); later(() => setCelebrating(false), reduced ? 0 : 10000); return () => clearTimers(); }, [reduced]);
  useEffect(() => {
    if (stage !== 'writing') return undefined;
    if (reduced) { setWrittenCharacters(totalCharacters); setStage('complete'); setCelebrating(true); celebrate(); later(() => setCelebrating(false), 10000); return undefined; }
    setWrittenCharacters(0);
    const interval = window.setInterval(() => { setWrittenCharacters(current => { const next = Math.min(current + 2, totalCharacters); if (next === totalCharacters) { window.clearInterval(interval); later(() => { setStage('complete'); setCelebrating(true); celebrate(); later(() => setCelebrating(false), 10000); }, 360); } return next; }); }, 28);
    return () => window.clearInterval(interval);
  }, [stage, totalCharacters, reduced, celebrate]);
  const open = () => { if (stage !== 'envelope') return; paper(); setStage('opening'); later(() => setStage('letter'), reduced ? 80 : 780); later(() => setStage('writing'), reduced ? 130 : 1240); };
  const readNow = () => { clearTimers(); setWrittenCharacters(totalCharacters); setStage('complete'); setCelebrating(true); celebrate(); later(() => setCelebrating(false), 10000); };
  const replay = () => { clearTimers(); clearAudio(); setWrittenCharacters(0); setCelebrating(true); setStage('intro'); later(() => setStage('envelope'), reduced ? 0 : 1700); later(() => setCelebrating(false), reduced ? 0 : 10000); };
  const share = async () => { try { if (navigator.share) await navigator.share({ title: 'A birthday surprise is waiting for you 🎂', url: window.location.href }); else await navigator.clipboard?.writeText(window.location.href); } catch { /* A cancelled share is not an error. */ } };
  return <main className={`birthday-page stage-${stage}`}><MugguFrame/>{celebrating && <CelebrationParticles active quiet={reduced}/>} {onExitPreview && <button className="birthday-preview-exit" type="button" onClick={onExitPreview}><FiArrowLeft/> Edit surprise</button>}<section className="birthday-scene" aria-labelledby="birthday-recipient"><p className="birthday-kicker">A little something for</p><h1 id="birthday-recipient">{data.recipientName}</h1><p className="birthday-quiet-note">From {data.senderName}</p><div className="birthday-object"><BirthdayEnvelope onOpen={open} disabled={stage !== 'envelope'}/><BirthdayLetter data={data} stage={stage} writtenCharacters={writtenCharacters}/></div>{stage === 'complete' && <div className="birthday-complete"><p className="birthday-final">Happy Birthday, {data.recipientName} <span aria-hidden="true">✦</span></p><button type="button" className="birthday-make-wish" onClick={() => setMakerOpen(true)}><FiGift/> Make a wish / Try yours</button></div>}</section><RecipientToolbar audio={{ muted, toggle }} stage={stage} onReadNow={readNow} onReplay={replay} onShare={share}/>{makerOpen && <MakeWishPanel onClose={() => setMakerOpen(false)}/>}</main>;
}

function BirthdayCreator() {
  const [form, setForm] = useState(() => ({ recipientName: '', senderName: 'Vamsi', message: randomBirthdayMessage() })); const [previewing, setPreviewing] = useState(false); const [notice, setNotice] = useState('');
  const data = normalizeBirthdayData(form); const valid = Boolean(data.recipientName && data.message); const link = valid ? birthdayShareUrl(data) : '';
  const update = (key, value) => { setForm(current => ({ ...current, [key]: value })); setNotice(''); };
  const preview = () => { if (!valid) { setNotice('Add their name before previewing the surprise.'); return; } setPreviewing(true); };
  const copy = async () => { try { await navigator.clipboard.writeText(link); setNotice('Birthday link copied.'); } catch { setNotice('Copy the link from the field below.'); } };
  const share = async () => { try { if (navigator.share) await navigator.share({ title: 'A birthday surprise is waiting for you 🎂', text: 'I made a little birthday surprise for you 🎂', url: link }); else setNotice('Use WhatsApp or copy the link.'); } catch { /* User cancelled sharing. */ } };
  if (previewing) return <BirthdayExperience data={data} onExitPreview={() => setPreviewing(false)}/>;
  return <main className="birthday-creator"><MugguFrame/><section className="birthday-creator-card"><p className="creator-eyebrow">Vamsi Marripudi / birthday note</p><h1>Create a birthday surprise</h1><p className="creator-intro">A handwritten little moment they can open anywhere.</p><form onSubmit={(event) => { event.preventDefault(); preview(); }}><label>Birthday person’s name<input value={form.recipientName} onChange={event => update('recipientName', event.target.value)} maxLength={BIRTHDAY_LIMITS.recipientName} autoComplete="name" placeholder="Their name" required/></label><label>From<input value={form.senderName} onChange={event => update('senderName', event.target.value)} maxLength={BIRTHDAY_LIMITS.senderName} placeholder="Vamsi"/></label><label>Your personal note<textarea value={form.message} onChange={event => update('message', event.target.value)} maxLength={BIRTHDAY_LIMITS.message} rows="6"/></label><div className="creator-actions"><button className="birthday-primary" type="submit">Preview surprise</button><button className="birthday-secondary" type="button" onClick={() => update('message', randomBirthdayMessage())}>Another message</button></div></form>{notice && <p className="creator-notice" role="status">{notice}</p>}{link && <section className="birthday-share-panel" aria-label="Share birthday surprise"><label>Shareable link<input value={link} readOnly aria-label="Shareable birthday link"/></label><div><button type="button" onClick={copy}><FiCopy/> Copy link</button><a href={`https://wa.me/?text=${encodeURIComponent(`I made a little birthday surprise for you 🎂 Open it here: ${link}`)}`} target="_blank" rel="noreferrer">WhatsApp</a><button type="button" onClick={share}><FiShare2/> Share</button></div></section>}</section></main>;
}

export default function BirthdayPage() {
  const recipientData = useMemo(() => decodeBirthdayPayload(new URLSearchParams(window.location.search).get('b')), []);
  useEffect(() => { setBirthdayMeta(); const robots = document.createElement('meta'); robots.name = 'robots'; robots.content = 'noindex, nofollow'; robots.dataset.birthday = 'true'; document.head.appendChild(robots); return () => robots.remove(); }, []);
  return recipientData ? <BirthdayExperience data={recipientData}/> : <BirthdayCreator/>;
}
