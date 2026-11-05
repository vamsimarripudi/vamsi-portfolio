import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowUpRight, FiFileText, FiSearch, FiShield, FiMail } from 'react-icons/fi';
import { legacyPublicLegalDocuments } from './legalPublicDocs.js';
import './LegalCenter.css';

export default function LegalCenter() {
  const [query, setQuery] = useState('');
  const results = useMemo(() => {
    const text = query.trim().toLocaleLowerCase();
    return legacyPublicLegalDocuments.filter((doc) =>
      !text || [doc.title, doc.description, doc.category].some((field) => field.toLocaleLowerCase().includes(text))
    );
  }, [query]);

  useEffect(() => {
    document.title = 'Vamsi Marripudi — Legal Center';
    document.head.querySelector('link[rel="canonical"]')?.setAttribute('href', 'https://vamsimarripudi.me/legal');
    let robots = document.head.querySelector('meta[name="robots"]');
    const created = !robots;
    if (!robots) {
      robots = document.createElement('meta');
      robots.setAttribute('name', 'robots');
      document.head.appendChild(robots);
    }
    const previous = robots.getAttribute('content');
    robots.setAttribute('content', 'noindex, follow');
    return () => {
      if (created) robots.remove();
      else if (previous === null) robots.removeAttribute('content');
      else robots.setAttribute('content', previous);
    };
  }, []);

  return <main className="page legal-hub" id="main">
    <header className="legal-hub-heading">
      <p className="eyebrow">VAMSI MARRIPUDI / PERSONAL LEGAL INFORMATION</p>
      <h1>Find the right legal information.</h1>
      <p>This directory currently links to documents already published for this personal portfolio. It does not create or approve new product agreements.</p>
    </header>
    <section className="legal-hub-library" aria-labelledby="legal-library-title">
      <div className="legal-hub-section-head">
        <div><p className="eyebrow">CURRENT WEBSITE DOCUMENTS</p><h2 id="legal-library-title">Existing public notices</h2></div>
        <p>Product-specific documents will appear only after verification, legal review and owner authorization.</p>
      </div>
      <label className="legal-hub-search">
        <FiSearch aria-hidden="true"/>
        <span className="sr-only">Search existing website legal documents</span>
        <input value={query} onChange={event=>setQuery(event.target.value)} type="search" placeholder="Search privacy or website terms" autoComplete="off"/>
      </label>
      <div className="legal-hub-document-list" role="list">
        {results.map(doc=><Link to={doc.href} key={doc.id} role="listitem" className="legal-hub-document">
          <span className="legal-hub-document-icon"><FiFileText aria-hidden="true"/></span>
          <span className="legal-hub-document-copy"><small>{doc.category} · Existing document</small><strong>{doc.title}</strong><span>{doc.description}</span></span>
          <FiArrowUpRight className="legal-hub-open" aria-hidden="true"/>
        </Link>)}
        {results.length===0&&<p className="legal-hub-empty" role="status">No matching existing documents. Try “privacy” or “terms”.</p>}
      </div>
    </section>
    <section className="legal-hub-help" aria-label="Legal questions and privacy requests">
      <div><FiShield aria-hidden="true"/><h2>Questions or privacy requests?</h2><p>The new secure legal request center is not active. For now, use the existing portfolio contact page and privacy-request instructions; do not upload sensitive identity documents through the general contact form.</p><Link to="/contact">Contact Vamsi <FiArrowUpRight aria-hidden="true"/></Link></div>
      <div><FiMail aria-hidden="true"/><h2>Already use a personal product?</h2><p>Continue using that product's currently published legal and support links. This directory does not replace any product's existing agreements.</p><Link to="/privacy">Current portfolio privacy notice <FiArrowUpRight aria-hidden="true"/></Link></div>
    </section>
    <p className="legal-hub-scope">Central legal consolidation, product-specific policies and private case tracking require separate technical verification, qualified legal review and explicit owner approval.</p>
  </main>;
}
