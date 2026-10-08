import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowUp, FiArrowUpRight, FiFileText, FiLink2, FiPrinter, FiShield } from 'react-icons/fi';
import { PRIVACY } from './privacy.js';
import './LegalDocument.css';

const makeId = (kind, index) => 'legal-' + kind + '-' + String(index + 1).padStart(2, '0');

export default function LegalDocument({ kind, sections }) {
  const isPrivacy = kind === 'privacy';
  const entries = sections.map((section, index) => ({
    ...section,
    number: String(index + 1).padStart(2, '0'),
    id: makeId(kind, index),
  }));
  const [activeId, setActiveId] = useState(entries[0]?.id ?? '');
  const [progress, setProgress] = useState(0);
  const readingRef = useRef(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      const reading = readingRef.current;
      if (!reading) return;
      let current = entries[0]?.id ?? '';
      for (const entry of entries) {
        const element = document.getElementById(entry.id);
        if (element && element.getBoundingClientRect().top <= 190) current = entry.id;
      }
      setActiveId((previous) => previous === current ? previous : current);
      const rect = reading.getBoundingClientRect();
      const total = Math.max(1, rect.height - window.innerHeight * 0.45);
      const covered = Math.max(0, Math.min(total, window.innerHeight * 0.3 - rect.top));
      const next = Math.round((covered / total) * 100);
      setProgress((previous) => previous === next ? previous : next);
    };
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        update();
      });
    };
    const initialHash = decodeURIComponent(window.location.hash.slice(1));
    const hashMatches = entries.some((entry) => entry.id === initialHash);
    const initialScroll = hashMatches
      ? window.setTimeout(() => document.getElementById(initialHash)?.scrollIntoView({ block: 'start' }), 60)
      : undefined;
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      window.cancelAnimationFrame(frame);
      if (initialScroll !== undefined) window.clearTimeout(initialScroll);
    };
    // The document type and section count are stable while a route is mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, entries.length]);

  return (
    <div className="legal-experience">
      <div className="legal-document-meta">
        <div className="legal-document-identity">
          <span className="legal-document-symbol" aria-hidden="true">
            {isPrivacy ? <FiShield /> : <FiFileText />}
          </span>
          <div>
            <strong>{isPrivacy ? 'Privacy Notice' : 'Terms of Use'}</strong>
            <span>{isPrivacy ? 'Data practices & your choices' : 'Using this portfolio'}</span>
          </div>
        </div>
        <button className="legal-print" type="button" onClick={() => window.print()}>
          <FiPrinter aria-hidden="true" /> Print document
        </button>
      </div>

      <dl className="legal-facts">
        <div><dt>Document</dt><dd>{isPrivacy ? 'Privacy Notice' : 'Terms of Use'}</dd></div>
        <div><dt>{isPrivacy ? 'Last updated' : 'Applies to'}</dt><dd>{isPrivacy ? PRIVACY.lastUpdated : 'vamsimarripudi.me'}</dd></div>
        <div><dt>{isPrivacy ? 'Version' : 'Sections'}</dt><dd>{isPrivacy ? PRIVACY.version : String(entries.length).padStart(2, '0')}</dd></div>
      </dl>

      {isPrivacy && (
        <p className="legal-scope-note">
          This notice is for {PRIVACY.siteUrl.replace('https://', '')}, operated by {PRIVACY.operator}.
        </p>
      )}

      <div className="legal-layout">
        <aside className="legal-rail" aria-label="Document navigation">
          <div className="legal-rail-head">
            <span>On this page</span>
            <span>{String(entries.length).padStart(2, '0')} sections</span>
          </div>
          <nav className="legal-navigation" aria-label="Policy sections">
            {entries.map((entry) => (
              <a
                key={entry.id}
                href={'#' + entry.id}
                className={activeId === entry.id ? 'is-current' : ''}
                aria-current={activeId === entry.id ? 'location' : undefined}
                onClick={() => setActiveId(entry.id)}
              >
                <span className="legal-nav-number" aria-hidden="true">{entry.number}</span>
                <span className="legal-nav-label">{entry.title}</span>
              </a>
            ))}
          </nav>
          <div className="legal-reading-progress" aria-hidden="true"><span style={{ width: progress + '%' }} /></div>
          <p className="legal-rail-footer">Reading progress <strong>{progress}%</strong></p>
        </aside>

        <article className="legal-reading" aria-label={isPrivacy ? 'Privacy Notice content' : 'Terms of Use content'} ref={readingRef}>
          {entries.map((entry) => (
            <section className="legal-section" id={entry.id} key={entry.id} tabIndex={-1} aria-labelledby={entry.id + '-heading'}>
              <div className="legal-section-header">
                <span className="legal-section-number" aria-hidden="true">{entry.number}</span>
                <h2 id={entry.id + '-heading'}>{entry.title}</h2>
                <a className="legal-section-anchor" href={'#' + entry.id} aria-label={'Link to ' + entry.title}>
                  <FiLink2 aria-hidden="true" />
                </a>
              </div>
              <p>{entry.body}</p>
            </section>
          ))}
          <aside className="legal-support" aria-labelledby="legal-support-title">
            <div className="legal-support-icon" aria-hidden="true">{isPrivacy ? <FiShield /> : <FiFileText />}</div>
            <div className="legal-support-copy">
              <p className="legal-support-eyebrow">{isPrivacy ? 'Need assistance?' : 'Continue reading'}</p>
              <h2 id="legal-support-title">{isPrivacy ? 'Privacy contact' : 'Related information'}</h2>
              {isPrivacy ? (
                <p>
                  For a privacy question or request, email{' '}
                  <a href={'mailto:' + PRIVACY.contactEmail + '?subject=' + encodeURIComponent('Privacy request')}>{PRIVACY.contactEmail}</a>
                  {' '}with <strong>Privacy request</strong> in the subject.
                </p>
              ) : (
                <p>
                  Read the <Link to="/privacy">Privacy Notice</Link> for contact-form and browser-preference details,
                  {' '}or <Link to="/contact">start a conversation</Link> when you have a professional enquiry.
                </p>
              )}
              <Link className="legal-support-link" to={isPrivacy ? '/terms' : '/privacy'}>
                {isPrivacy ? 'View Terms of Use' : 'View Privacy Notice'} <FiArrowUpRight aria-hidden="true" />
              </Link>
            </div>
          </aside>
          <a className="legal-back-top" href="#main">
            Back to top <FiArrowUp aria-hidden="true" />
          </a>
        </article>
      </div>
    </div>
  );
}
