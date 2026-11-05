import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FiArrowUp, FiArrowUpRight, FiBookOpen, FiChevronDown, FiChevronRight,
  FiFileText, FiHash, FiList, FiMail, FiShield, FiSearch, FiPrinter,
} from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { printLegalDocument } from './legalPrintActions.js';
import './LegalDocument.css';
import './LegalPrint.css';

const sectionSlug = (title) => title.toLowerCase().normalize('NFKD')
  .replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');

const documentDetails = {
  privacy: {
    kicker: 'Information and transparency',
    heading: 'Your privacy, explained clearly.',
    description: 'A structured guide to the information handled by this site, its purpose, and how to get in touch about your data.',
    sectionLabel: 'Privacy notice',
  },
  cookies: {
    kicker: 'Browser storage and your choices',
    heading: 'Cookies and analytics, in practical terms.',
    description: 'A factual account of local preferences, the optional first-party analytics choice and how to withdraw consent. It does not publish a new product contract.',
    sectionLabel: 'Cookie information',
  },
  terms: {
    kicker: 'Website use and expectations',
    heading: 'The ground rules, made readable.',
    description: 'A straightforward reference for using this portfolio, its public content, and the ways to make contact.',
    sectionLabel: 'Terms of use',
  },
};

export default function LegalDocument({ kind, sections, version, lastUpdated, operator, site, footerTitle, footer }) {
  const mobileContents = useRef(null);
  const [active, setActive] = useState(null);
  const [sectionQuery, setSectionQuery] = useState('');
  const config = documentDetails[kind] || documentDetails.terms;
  const entries = useMemo(() => sections.map((section, index) => ({
    ...section,
    id: kind + '-' + sectionSlug(section.title) + '-' + (index + 1),
    number: String(index + 1).padStart(2, '0'),
  })), [kind, sections]);

  const filteredHeadings = useMemo(() => {
    const needle = sectionQuery.trim().toLowerCase();
    return needle ? entries.filter(entry => entry.title.toLowerCase().includes(needle)) : entries;
  }, [entries, sectionQuery]);

  useEffect(() => {
    setActive(entries[0]?.id || null);
    if (!('IntersectionObserver' in window)) return undefined;
    const observer = new IntersectionObserver((records) => {
      const visible = records.filter((record) => record.isIntersecting)
        .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top);
      if (visible[0]) setActive(visible[0].target.id);
    }, { rootMargin: '-16% 0px -65% 0px', threshold: 0 });
    entries.forEach(({ id }) => {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    });
    return () => observer.disconnect();
  }, [entries]);

  const jumpTo = (id) => {
    setActive(id);
    if (mobileContents.current) mobileContents.current.open = false;
  };

  const contents = (mobile = false) => (
    <nav className="legal-toc" aria-label={mobile ? 'Mobile table of contents' : 'Document table of contents'}>
      {filteredHeadings.map(entry => (
        <a key={entry.id} href={'#' + entry.id}
          className={active === entry.id ? 'is-active' : undefined}
          aria-current={active === entry.id ? 'location' : undefined}
          onClick={() => jumpTo(entry.id)}>
          <span className="legal-toc-number">{entry.number}</span>
          <span className="legal-toc-title">{entry.title}</span>
          <FiChevronRight className="legal-toc-chevron" aria-hidden="true"/>
        </a>
      ))}
      {filteredHeadings.length === 0 && <p role="status" className="legal-toc-empty">No matching headings. Full notice remains visible below.</p>}
    </nav>
  );

  const currentPosition = Math.max(1, entries.findIndex((entry) => entry.id === active) + 1);

  return (
    <article className={'legal-document legal-document--' + kind} aria-label={config.sectionLabel}>
      <div className="legal-print-watermark" aria-hidden="true"><img src="/vm-mark.svg" alt=""/></div>
      <div className="legal-print-page-footer" aria-hidden="true"><span><img src="/vm-mark.svg" alt=""/> Vamsi Marripudi</span><span>{config.sectionLabel} · vamsimarripudi.me</span></div>
      <div className="legal-document-bar">
        <div className="legal-document-breadcrumb">
          <Link to="/legal">Legal center</Link>
          <FiChevronRight aria-hidden="true"/>
          <span aria-current="page">{config.sectionLabel}</span>
        </div>
        <div className="legal-document-actions">
          <a className="legal-pdf-action" href={'/legal-pdf/' + kind + '.pdf'} target="_blank" rel="noopener noreferrer" aria-label={'Open or save printable PDF of ' + config.sectionLabel}>Open PDF <FiArrowUpRight aria-hidden="true"/></a>
          <button type="button" className="legal-print-action" onClick={() => printLegalDocument(kind)} aria-label={'Print or save PDF of ' + config.sectionLabel}>
            <FiPrinter aria-hidden="true"/> Print / Save
          </button>
        </div>
      </div>
      <p className="legal-mobile-print-help">On mobile or inside an app, Print / Save opens the PDF. Use Share to print or save to Files.</p>
      <div className="legal-document-meta">
        <span><FiFileText aria-hidden="true"/> {kind === 'cookies' ? 'Website information · review pending' : 'Existing portfolio notice'}</span>
        {lastUpdated && <span>Last updated: <strong>{lastUpdated}</strong></span>}
        {version && <span>Version: <strong>{version}</strong></span>}
        <span>{entries.length} sections</span>
      </div>
      <details ref={mobileContents} className="legal-mobile-contents">
        <summary><FiList aria-hidden="true"/><span>Table of contents</span><small>{entries.length} sections</small><FiChevronDown className="legal-mobile-caret" aria-hidden="true"/></summary>
        <label className="legal-toc-search">
          <FiSearch aria-hidden="true"/>
          <span className="sr-only">Find section headings</span>
          <input type="search" value={sectionQuery} onChange={event => setSectionQuery(event.target.value)} placeholder="Find a section" autoComplete="off"/>
        </label>
        {contents(true)}
      </details>

      <div className="legal-reader">
        <aside className="legal-reader-sidebar">
          <div className="legal-sidebar-sticky">
            <div className="legal-sidebar-heading">
              <p className="legal-sidebar-kicker">TABLE OF CONTENTS</p>
              <span className="legal-navigation-progress">{String(currentPosition).padStart(2, '0')} <span>/ {String(entries.length).padStart(2, '0')}</span></span>
            </div>
            <label className="legal-toc-search">
              <FiSearch aria-hidden="true"/>
              <span className="sr-only">Find section headings</span>
              <input type="search" value={sectionQuery} onChange={event => setSectionQuery(event.target.value)} placeholder="Find a section" autoComplete="off"/>
            </label>
            {contents()}
            <div className="legal-reading-progress" role="progressbar" aria-label="Section reading position" aria-valuemin={0} aria-valuemax={entries.length} aria-valuenow={currentPosition}>
              <span style={{width: (currentPosition / Math.max(entries.length, 1) * 100) + '%'}}/>
            </div>
            <div className="legal-sidebar-support">
              <span className="legal-sidebar-support-icon"><FiMail aria-hidden="true" /></span>
              <strong>Need clarification?</strong>
              <span>A direct line for questions about this document.</span>
              <a href="mailto:connect@vamsimarripudi.me">Get in touch <FiArrowUpRight aria-hidden="true" /></a>
            </div>
          </div>
        </aside>

        <div className="legal-reader-body">
          <section className="legal-overview" aria-labelledby="legal-overview-title">
            <div className="legal-overview-symbol" aria-hidden="true">
              {kind === 'privacy' ? <FiShield /> : <FiBookOpen />}
            </div>
            <div className="legal-overview-copy">
              <p className="legal-overview-kicker">{config.kicker}</p>
              <h2 id="legal-overview-title">Summary of key topics</h2>
              <p>{config.description} Use the table of contents to navigate; the complete original text appears below.</p>
              {operator && site && <div className="legal-operator">This notice is for {site}, operated by {operator}.</div>}
              <div className="legal-topic-shortcuts" aria-label="Key document sections">
                {entries.slice(0,4).map(entry =>
                  <a href={'#' + entry.id} key={entry.id}><span>{entry.number}</span>{entry.title}<FiArrowUpRight aria-hidden="true"/></a>
                )}
              </div>
            </div>
          </section>

          <div className="legal-full-text-heading">
            <div><p className="legal-overview-kicker">COMPLETE POLICY TEXT</p><h2>Document details</h2></div>
            <span>{entries.length} sections</span>
          </div>
          <div className="legal-sections" aria-label="Document text">
            {entries.map((entry) => (
              <section
                className="legal-clause"
                id={entry.id}
                key={entry.id}
                aria-labelledby={entry.id + '-heading'}
              >
                <div className="legal-clause-heading">
                  <span className="legal-clause-index">{entry.number}</span>
                  <h2 id={entry.id + '-heading'}>{entry.title}</h2>
                  <a className="legal-clause-anchor" href={'#' + entry.id} aria-label={'Direct link to ' + entry.title}>
                    <FiHash aria-hidden="true" />
                  </a>
                </div>
                <p>{entry.body}</p>
              </section>
            ))}
          </div>

          <div className="legal-print-closing" aria-hidden="true">
            <svg className="legal-gradient-signature" viewBox="0 0 930 142" xmlns="http://www.w3.org/2000/svg">
              <defs><linearGradient id={'legal-signature-' + kind} x1="0%" x2="100%" y1="0%" y2="0%">
                <stop offset="0%" stopColor="#d5462d"/><stop offset="27%" stopColor="#e99539"/><stop offset="49%" stopColor="#bccc4b"/><stop offset="75%" stopColor="#338491"/><stop offset="100%" stopColor="#45558f"/>
              </linearGradient></defs>
              <text x="465" y="100" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontSize="83" fontWeight="800" letterSpacing="-4" fill={'url(#legal-signature-' + kind + ')'}>Vamsi Marripudi</text>
            </svg>
            <span>Personal portfolio · vamsimarripudi.me · connect@vamsimarripudi.me</span>
          </div>
          <aside className="legal-endnote" aria-label={footerTitle}>
            <div className="legal-endnote-icon"><FiMail aria-hidden="true" /></div>
            <div>
              <p className="legal-endnote-kicker">HERE TO HELP</p>
              <h2>{footerTitle}</h2>
              {footer}
            </div>
          </aside>

          <div className="legal-end-actions">
            <span>{config.sectionLabel} <span aria-hidden="true">·</span> {entries.length} sections</span>
            <div className="legal-end-links"><Link to="/legal">All legal documents <FiArrowUpRight aria-hidden="true"/></Link><a href="#main">Back to top <FiArrowUp aria-hidden="true" /></a></div>
          </div>
        </div>
      </div>
    </article>
  );
}
