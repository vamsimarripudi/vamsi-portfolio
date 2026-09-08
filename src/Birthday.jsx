import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FiArrowLeft, FiCopy, FiEdit3, FiGift, FiMusic, FiPause, FiPlay, FiRotateCcw, FiShare2, FiX } from 'react-icons/fi';
import { BIRTHDAY_LIMITS, birthdayShareIdIsValid, birthdayShortShareUrl, decodeBirthdayPayload, normalizeBirthdayData, randomBirthdayMessage } from './birthday-utils.js';
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

const createShortBirthdayLink = async (data) => {
  const response = await fetch('/api/birthday', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !birthdayShareIdIsValid(payload.id)) throw new Error(payload.message || 'Your birthday link could not be created.');
  return birthdayShortShareUrl(payload.id);
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
  const envelopeRef = useRef(null);
  const applauseRef = useRef(null);
  const envelopeStopTimerRef = useRef(null);
  const mutedRef = useRef(false);
  const [muted, setMuted] = useState(false);
  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => {
    envelopeRef.current = new Audio('/sounds/birthday-envelope-open.mp3');
    applauseRef.current = new Audio('/sounds/birthday-applause.mp3');
    envelopeRef.current.preload = 'auto'; envelopeRef.current.volume = 0.34;
    applauseRef.current.preload = 'auto'; applauseRef.current.volume = 0.26;
    return () => { if (envelopeStopTimerRef.current) window.clearTimeout(envelopeStopTimerRef.current); [envelopeRef.current, applauseRef.current].forEach((sound) => { if (sound) { sound.pause(); sound.currentTime = 0; } }); };
  }, []);
  const playSound = useCallback((reference) => {
    if (mutedRef.current || !reference.current) return;
    reference.current.currentTime = 0;
    reference.current.play().catch(() => {});
  }, []);
  const paper = useCallback(() => {
    playSound(envelopeRef);
    if (envelopeStopTimerRef.current) window.clearTimeout(envelopeStopTimerRef.current);
    envelopeStopTimerRef.current = window.setTimeout(() => { const sound = envelopeRef.current; if (sound) { sound.pause(); sound.currentTime = 0; } }, 700);
  }, [playSound]);
  const celebrate = useCallback(() => playSound(applauseRef), [playSound]);
  const toggle = useCallback(() => setMuted(current => !current), []);
  const clear = useCallback(() => { if (envelopeStopTimerRef.current) window.clearTimeout(envelopeStopTimerRef.current); [envelopeRef.current, applauseRef.current].forEach((sound) => { if (sound) { sound.pause(); sound.currentTime = 0; } }); }, []);
  return { muted, paper, celebrate, toggle, clear };
}

function MugguCorner({ transform }) {
  return <g transform={transform} className="invitation-corner" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path className="invitation-vine" d="M12 142C16 105 23 77 47 53 69 31 99 22 136 20"/>
    <path className="invitation-vine" d="M20 124C49 122 71 105 78 78M52 55C72 67 92 68 112 53"/>
    <path className="invitation-leaf" d="M31 100c-18-20-10-37 11-36 12 8 9 27-11 36Z"/>
    <path className="invitation-leaf" d="M61 75c-8-23 8-35 27-25 6 13-4 27-27 25Z"/>
    <path className="invitation-leaf" d="M91 46c3-22 21-28 34-14 0 15-13 24-34 14Z"/>
    <path className="invitation-flower" d="M17 122c-18-9-16-29 2-32 13 8 11 25-2 32ZM17 122c9 18 29 16 32-2-8-13-25-11-32 2Z"/>
    <circle className="invitation-dot" cx="14" cy="144" r="2.4"/><circle className="invitation-dot" cx="139" cy="18" r="2.4"/>
  </g>;
}

function BorderMotif({ transform }) {
  return <g transform={transform} className="invitation-side-motif" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path className="invitation-stem" d="M0 0v62"/>
    <path className="invitation-diamond" d="M0 13 10 23 0 33-10 23Z"/>
    <path className="invitation-diamond" d="M0 43 15 58 0 73-15 58Z"/>
    <path className="invitation-leaf" d="M-15 58C-37 50-35 34-17 32c13 6 13 20 2 26ZM15 58c22-8 20-24 2-26-13 6-13 20-2 26Z"/>
    <circle className="invitation-dot" cx="0" cy="86" r="2"/><circle className="invitation-dot" cx="0" cy="98" r="2"/>
  </g>;
}

function MugguFrame({ letter = false }) {
  const height = letter ? 1100 : 800;
  const lowerCorner = height - 38;
  const lowerRule = height - 22;
  const lowerInnerRule = height - 33;
  return <svg className={letter ? 'letter-muggu' : 'birthday-muggu'} viewBox={`0 0 1200 ${height}`} preserveAspectRatio={letter ? 'none' : undefined} aria-hidden="true" focusable="false">
    <g className="muggu-frame-lines" fill="none" stroke="currentColor" strokeLinecap="round">
      <rect x="22" y="22" width="1156" height={height - 44}/><rect x="33" y="33" width="1134" height={height - 66}/>
      <path d={`M188 22H575m50 0h387M188 ${lowerRule}H575m50 0h387`}/>
      <path d={`M600 11 611 22 600 33 589 22ZM600 ${lowerInnerRule}l11 11-11 11-11-11Z`}/>
    </g>
    <MugguCorner transform="translate(38 38)"/><MugguCorner transform="translate(1162 38) scale(-1 1)"/>
    <MugguCorner transform={`translate(38 ${lowerCorner}) scale(1 -1)`}/><MugguCorner transform={`translate(1162 ${lowerCorner}) scale(-1 -1)`}/>
    <BorderMotif transform={`translate(43 ${Math.round(height * 0.3)})`}/><BorderMotif transform={`translate(1157 ${Math.round(height * 0.3)})`}/>
    <BorderMotif transform={`translate(43 ${Math.round(height * 0.64)})`}/><BorderMotif transform={`translate(1157 ${Math.round(height * 0.64)})`}/>
  </svg>;
}const burstColours = ['#f5c974', '#b95a4e', '#df9376', '#6f3437', '#f7e7c5'];
const burstPieces = (run) => Array.from({ length: 38 }, (_, index) => {
  const seed = (index * 47 + run * 71) % 101;
  return { colour: burstColours[(index + run) % burstColours.length], delay: `${(seed % 18) * 0.035}s`, left: `${3 + ((seed * 9 + index * 13) % 94)}%`, rotate: `${(seed * 31) % 180}deg`, size: `${6 + (seed % 8)}px`, drift: `${-42 + ((seed * 7) % 85)}px`, shape: index % 5 === 0 ? 'is-petal' : index % 3 === 0 ? 'is-ribbon' : '' };
});

function OpeningBurst({ active, run, reduced }) {
  const pieces = useMemo(() => burstPieces(run), [run]);
  if (!active || reduced) return null;
  return <div className="birthday-opening-burst" aria-hidden="true" key={run}>{pieces.map((piece, index) => <i className={piece.shape} key={`${run}-${index}`} style={{ '--burst-colour': piece.colour, '--burst-delay': piece.delay, '--burst-left': piece.left, '--burst-rotate': piece.rotate, '--burst-size': piece.size, '--burst-drift': piece.drift }}/>)}</div>;
}

function BirthdayEnvelope({ onOpen, disabled }) {
  return <div className={`birthday-envelope ${disabled ? 'is-opening' : ''}`}><div className="envelope-shadow"/><div className="envelope-back"/><div className="envelope-flap"/><div className="envelope-face"><span>For you</span><i/></div><button className="wax-seal" type="button" onClick={onOpen} disabled={disabled} aria-label="Open the birthday letter"><b>V</b><small>Tap to open</small></button></div>;
}

function WrittenParagraph({ text, visibleCharacters, complete }) {
  return <p className="letter-paragraph">{Array.from(text).map((character, index) => <span className={complete || index < visibleCharacters ? 'is-written' : ''} key={`${character}-${index}`}>{character}</span>)}</p>;
}

function BirthdayLetter({ data, stage, writtenCharacters }) {
  const paragraphs = data.message.split(/\n\s*\n/).filter(Boolean).slice(0, 4);
  const complete = stage === 'complete';
  let consumed = 0;
  return <article className={`birthday-letter ${stage === 'letter' || stage === 'writing' || complete ? 'is-visible' : ''}`} aria-live="polite"><MugguFrame letter/><p className="letter-title">A birthday letter</p><p className={`letter-greeting ${complete || writtenCharacters > 0 ? 'is-written' : ''}`}>Happy birthday, {data.recipientName}.</p><div className="letter-copy">{paragraphs.map((paragraph, index) => { const visible = Math.max(0, writtenCharacters - consumed); consumed += Array.from(paragraph).length; return <WrittenParagraph text={paragraph} visibleCharacters={visible} complete={complete} key={`${paragraph}-${index}`}/>; })}</div><p className={`letter-signoff ${complete ? 'is-written' : ''}`}>From<br/><strong>{data.senderName}</strong><FiEdit3 className="letter-pen-icon" aria-label="Written with care"/></p></article>;
}

function RecipientToolbar({ audio, stage, onReadNow, onReplay, onShare }) {
  return <nav className="birthday-toolbar" aria-label="Birthday experience controls"><button type="button" onClick={audio.toggle} aria-pressed={audio.muted}>{audio.muted ? <FiPause/> : <FiMusic/>}<span>{audio.muted ? 'Sound off' : 'Sound'}</span></button>{(stage === 'writing' || stage === 'letter') && <button type="button" onClick={onReadNow}><FiPlay/><span>Read now</span></button>}{stage === 'complete' && <button type="button" onClick={onReplay}><FiRotateCcw/><span>Replay</span></button>}<button type="button" onClick={onShare}><FiShare2/><span>Share</span></button></nav>;
}

function MakeWishPanel({ onClose }) {
  const [recipientName, setRecipientName] = useState(''); const [senderName, setSenderName] = useState(''); const [message, setMessage] = useState(randomBirthdayMessage); const [notice, setNotice] = useState(''); const [link, setLink] = useState(''); const [busy, setBusy] = useState(false);
  const data = normalizeBirthdayData({ recipientName, senderName, message });
  const update = (setter) => (event) => { setter(event.target.value); setLink(''); setNotice(''); };
  const create = async () => { if (!data.recipientName) { setNotice('Add their name before creating the link.'); return; } setBusy(true); setNotice(''); try { setLink(await createShortBirthdayLink(data)); setNotice('Your short birthday link is ready.'); } catch (error) { setNotice(error.message); } finally { setBusy(false); } };
  const copy = async () => { try { await navigator.clipboard.writeText(link); setNotice('Your short birthday link is ready to share.'); } catch { setNotice('Copy your link from the field below.'); } };
  return <section className="make-wish-panel" role="dialog" aria-modal="true" aria-labelledby="make-wish-title"><button type="button" className="make-wish-close" onClick={onClose} aria-label="Close"><FiX/></button><p className="creator-eyebrow">make a little moment</p><h2 id="make-wish-title">Who are you celebrating?</h2><p>Write the feeling you want them to open. Their link is private and shareable.</p><label>Their name<input value={recipientName} onChange={update(setRecipientName)} maxLength={BIRTHDAY_LIMITS.recipientName} placeholder="Manohar" autoFocus/></label><label>From<input value={senderName} onChange={update(setSenderName)} maxLength={BIRTHDAY_LIMITS.senderName} placeholder="Satish"/></label><label>Your note<textarea value={message} onChange={update(setMessage)} maxLength={BIRTHDAY_LIMITS.message} rows="5"/></label>{!link && <button className="birthday-primary" type="button" onClick={create} disabled={busy}>{busy ? 'Creating short link…' : 'Create short birthday link'}</button>}{link && <><input className="make-wish-link" value={link} readOnly aria-label="Your short shareable birthday link"/><button className="birthday-primary" type="button" onClick={copy}><FiCopy/> Copy my birthday link</button></>}{notice && <p className="creator-notice" role="status">{notice}</p>}</section>;
}
function BirthdayExperience({ data, onExitPreview }) {
  const reduced = useReducedMotion(); const [stage, setStage] = useState('intro'); const [writtenCharacters, setWrittenCharacters] = useState(0); const [makerOpen, setMakerOpen] = useState(false); const [burstActive, setBurstActive] = useState(false); const [burstRun, setBurstRun] = useState(0);
  const timers = useRef([]); const { muted, paper, celebrate, toggle, clear: clearAudio } = useBirthdayAudio();
  const paragraphs = data.message.split(/\n\s*\n/).filter(Boolean).slice(0, 4); const totalCharacters = Array.from(paragraphs.join('')).length;
  const clearTimers = () => { timers.current.forEach(window.clearTimeout); timers.current = []; };
  const later = (callback, delay) => { const timer = window.setTimeout(callback, delay); timers.current.push(timer); };
  useEffect(() => { later(() => setStage('envelope'), reduced ? 0 : 500); return () => clearTimers(); }, [reduced]);
  useEffect(() => {
    if (stage !== 'writing') return undefined;
    if (reduced) { setWrittenCharacters(totalCharacters); setStage('complete'); return undefined; }
    setWrittenCharacters(0);
    const interval = window.setInterval(() => { setWrittenCharacters(current => { const next = Math.min(current + 1, totalCharacters); if (next === totalCharacters) { window.clearInterval(interval); later(() => setStage('complete'), 360); } return next; }); }, 18);
    return () => window.clearInterval(interval);
  }, [stage, totalCharacters, reduced, celebrate]);
  const open = () => { if (stage !== 'envelope') return; paper(); setStage('opening'); later(() => { setBurstRun(current => current + 1); setBurstActive(true); celebrate(); later(() => setBurstActive(false), 10000); }, reduced ? 0 : 420); later(() => setStage('letter'), reduced ? 80 : 780); later(() => setStage('writing'), reduced ? 130 : 1240); };
  const readNow = () => { clearTimers(); setWrittenCharacters(totalCharacters); setStage('complete'); };
  const replay = () => { clearTimers(); clearAudio(); setBurstActive(false); setWrittenCharacters(0); setStage('intro'); later(() => setStage('envelope'), reduced ? 0 : 500); };
  const share = async () => { try { if (navigator.share) await navigator.share({ title: 'A birthday surprise is waiting for you 🎂', url: window.location.href }); else await navigator.clipboard?.writeText(window.location.href); } catch { /* A cancelled share is not an error. */ } };
  return <main className={`birthday-page stage-${stage}`}><MugguFrame/><OpeningBurst active={burstActive} run={burstRun} reduced={reduced}/>{onExitPreview && <button className="birthday-preview-exit" type="button" onClick={onExitPreview}><FiArrowLeft/> Edit surprise</button>}<section className="birthday-scene" aria-labelledby="birthday-recipient"><p className="birthday-kicker">A little something for</p><h1 id="birthday-recipient">{data.recipientName}</h1><p className="birthday-quiet-note">From {data.senderName}</p><div className="birthday-object"><BirthdayEnvelope onOpen={open} disabled={stage !== 'envelope'}/><BirthdayLetter data={data} stage={stage} writtenCharacters={writtenCharacters}/></div>{stage === 'complete' && <div className="birthday-complete"><p className="birthday-final">Happy Birthday, {data.recipientName}</p><button type="button" className="birthday-make-wish" onClick={() => setMakerOpen(true)}><FiGift/> Make a wish / Try yours</button></div>}</section><RecipientToolbar audio={{ muted, toggle }} stage={stage} onReadNow={readNow} onReplay={replay} onShare={share}/>{makerOpen && <MakeWishPanel onClose={() => setMakerOpen(false)}/>}</main>;
}

function BirthdayCreator() {
  const [form, setForm] = useState(() => ({ recipientName: '', senderName: 'Vamsi', message: randomBirthdayMessage() })); const [previewing, setPreviewing] = useState(false); const [notice, setNotice] = useState(''); const [link, setLink] = useState(''); const [busy, setBusy] = useState(false);
  const data = normalizeBirthdayData(form); const valid = Boolean(data.recipientName && data.message);
  const update = (key, value) => { setForm(current => ({ ...current, [key]: value })); setLink(''); setNotice(''); };
  const preview = () => { if (!valid) { setNotice('Add their name before previewing the surprise.'); return; } setPreviewing(true); };
  const create = async () => { if (!valid) { setNotice('Add their name before creating the link.'); return; } setBusy(true); setNotice(''); try { setLink(await createShortBirthdayLink(data)); setNotice('Your short birthday link is ready.'); } catch (error) { setNotice(error.message); } finally { setBusy(false); } };
  const copy = async () => { try { await navigator.clipboard.writeText(link); setNotice('Birthday link copied.'); } catch { setNotice('Copy the link from the field below.'); } };
  const share = async () => { try { if (navigator.share) await navigator.share({ title: 'A birthday surprise is waiting for you 🎂', text: 'I made a little birthday surprise for you 🎂', url: link }); else setNotice('Use WhatsApp or copy the link.'); } catch { /* User cancelled sharing. */ } };
  if (previewing) return <BirthdayExperience data={data} onExitPreview={() => setPreviewing(false)}/>;
  return <main className="birthday-creator"><MugguFrame/><section className="birthday-creator-card"><p className="creator-eyebrow">Vamsi Marripudi / birthday note</p><h1>Create a birthday surprise</h1><p className="creator-intro">A handwritten little moment they can open anywhere.</p><form onSubmit={(event) => { event.preventDefault(); preview(); }}><label>Birthday person’s name<input value={form.recipientName} onChange={event => update('recipientName', event.target.value)} maxLength={BIRTHDAY_LIMITS.recipientName} autoComplete="name" placeholder="Their name" required/></label><label>From<input value={form.senderName} onChange={event => update('senderName', event.target.value)} maxLength={BIRTHDAY_LIMITS.senderName} placeholder="Vamsi"/></label><label>Your personal note<textarea value={form.message} onChange={event => update('message', event.target.value)} maxLength={BIRTHDAY_LIMITS.message} rows="6"/></label><div className="creator-actions"><button className="birthday-primary" type="submit">Preview surprise</button><button className="birthday-secondary" type="button" onClick={create} disabled={busy}>{busy ? 'Creating short link…' : 'Create short link'}</button><button className="birthday-secondary" type="button" onClick={() => update('message', randomBirthdayMessage())}>Another message</button></div></form>{notice && <p className="creator-notice" role="status">{notice}</p>}{link && <section className="birthday-share-panel" aria-label="Share birthday surprise"><label>Short shareable link<input value={link} readOnly aria-label="Short shareable birthday link"/></label><div><button type="button" onClick={copy}><FiCopy/> Copy link</button><a href={`https://wa.me/?text=${encodeURIComponent(`I made a little birthday surprise for you 🎂 Open it here: ${link}`)}`} target="_blank" rel="noreferrer">WhatsApp</a><button type="button" onClick={share}><FiShare2/> Share</button></div></section>}</section></main>;
}
export default function BirthdayPage() {
  const shareId = useMemo(() => {
    const part = window.location.pathname.split('/').filter(Boolean).at(-1);
    return birthdayShareIdIsValid(part) ? part : '';
  }, []);
  const legacyRecipientData = useMemo(() => decodeBirthdayPayload(new URLSearchParams(window.location.search).get('b')), []);
  const [remote, setRemote] = useState(() => shareId ? { state: 'loading', data: null, message: '' } : { state: 'idle', data: null, message: '' });
  useEffect(() => { setBirthdayMeta(); const robots = document.createElement('meta'); robots.name = 'robots'; robots.content = 'noindex, nofollow'; robots.dataset.birthday = 'true'; document.head.appendChild(robots); return () => robots.remove(); }, []);
  useEffect(() => {
    if (!shareId) return undefined;
    const controller = new AbortController();
    fetch(`/api/birthday?id=${encodeURIComponent(shareId)}`, { signal: controller.signal }).then(async (response) => {
      const payload = await response.json().catch(() => ({}));
      const data = normalizeBirthdayData(payload.data || {});
      if (!response.ok || !payload.ok || !data.recipientName) throw new Error(payload.message || 'This birthday link is unavailable.');
      setRemote({ state: 'ready', data, message: '' });
    }).catch((error) => { if (error.name !== 'AbortError') setRemote({ state: 'error', data: null, message: error.message || 'This birthday link is unavailable.' }); });
    return () => controller.abort();
  }, [shareId]);
  if (shareId && remote.state === 'loading') return <main className="birthday-creator"><section className="birthday-creator-card"><p className="creator-eyebrow">birthday surprise</p><h1>Opening your letter…</h1></section></main>;
  if (shareId && remote.state === 'error') return <main className="birthday-creator"><section className="birthday-creator-card"><p className="creator-eyebrow">birthday surprise</p><h1>This link is unavailable.</h1><p className="creator-intro">{remote.message}</p></section></main>;
  const recipientData = shareId ? remote.data : legacyRecipientData;
  return recipientData ? <BirthdayExperience data={recipientData}/> : <BirthdayCreator/>;
}