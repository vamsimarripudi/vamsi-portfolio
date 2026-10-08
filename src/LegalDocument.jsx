import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FiArrowUp, FiArrowUpRight, FiBookOpen, FiChevronDown, FiChevronRight,
  FiFileText, FiHash, FiList, FiMail, FiShield,
} from 'react-icons/fi';
import './LegalDocument.css';

const sectionSlug = (title) => title.toLowerCase().normalize('NFKD')
  .replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');

const documentDetails = {
  privacy: {
    kicker: 'Information and transparency',
    heading: 'Your privacy, explained clearly.',
    description: 'A structured guide to the information handled by this site, its purpose, and how to get in touch about your data.',
    sectionLabel: 'Privacy notice',
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
  const config = documentDetails[kind] || documentDetails.terms;
  const entries = useMemo(() => sections.map((section, index) => ({
    ...section,
    id: kind + '-' + sectionSlug(section.title) + '-' + (index + 1),
    number: String(index + 1).padStart(2, '0'),
  })), [kind, sections]);

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
    <nav className="legal-toc" aria-label={mobile ? 'Mobile document contents' : 'Document contents'}>
      {entries.map((entry) => (
        <a
          key={entry.id}
          href={'#' + entry.id}
          className={active === entry.id ? 'is-active' : undefined}
          aria-current={active === entry.id ? 'location' : undefined}
          onClick={() => jumpTo(entry.id)}
        >
          <span className="legal-toc-number">{entry.number}</span>
          <span className="legal-toc-title">{entry.title}</span>
          <FiChevronRight className="legal-toc-chevron" aria-hidden="true" />
        </a>
      ))}
    </nav>
  );

  const currentPosition = Math.max(1, entries.findIndex((entry) => entry.id === active) + 1);

  return (
    <article className={'legal-document legal-document--' + kind} aria-label={config.sectionLabel}>
      <div className="legal-document-bar">
        <span className="legal-document-identity"><FiFileText aria-hidden="true" /> {config.sectionLabel}</span>
        <div className="legal-document-tags">
          {version && <span>Version {version}</span>}
          {lastUpdated && <span>Updated {lastUpdated}</span>}
          <span>{entries.length} sections</span>
        </div>
      </div>

      <details ref={mobileContents} className="legal-mobile-contents">
        <summary>
          <FiList aria-hidden="true" />
          <span>On this page</span>
          <small>{entries.length} sections</small>
          <FiChevronDown className="legal-mobile-caret" aria-hidden="true" />
        </summary>
        {contents(true)}
      </details>

      <div className="legal-reader">
        <aside className="legal-reader-sidebar">
          <div className="legal-sidebar-sticky">
            <div className="legal-sidebar-heading">
              <p className="legal-sidebar-kicker">DOCUMENT GUIDE</p>
              <span className="legal-navigation-progress">{String(currentPosition).padStart(2, '0')} <span>/ {String(entries.length).padStart(2, '0')}</span></span>
            </div>
            {contents()}
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
              <h2 id="legal-overview-title">{config.heading}</h2>
              <p>{config.description}</p>
              {operator && site && <div className="legal-operator">This notice is for {site}, operated by {operator}.</div>}
            </div>
          </section>

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
            <a href="#main">Back to top <FiArrowUp aria-hidden="true" /></a>
          </div>
        </div>
      </div>
    </article>
  );
}
