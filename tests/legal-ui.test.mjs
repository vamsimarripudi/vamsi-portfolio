import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';
import { PRIVACY, privacySections } from '../src/privacy.js';

let server;
let LegalDocument;

before(async () => {
  server = await createServer({
    configFile: 'vite.config.js',
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'error',
  });
  ({ default: LegalDocument } = await server.ssrLoadModule('/src/LegalDocument.jsx'));
});

after(async () => { await server?.close(); });

const render = (kind, sections) => renderToStaticMarkup(
  React.createElement(MemoryRouter, null, React.createElement(LegalDocument, { kind, sections }))
);
const escapeHtml = (text) => String(text)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#x27;');

test('Privacy Notice renders every existing section without changing its wording', () => {
  const markup = render('privacy', privacySections);
  assert.equal((markup.match(/class="legal-section"/g) || []).length, privacySections.length);
  for (const [index, section] of privacySections.entries()) {
    const id = 'legal-privacy-' + String(index + 1).padStart(2, '0');
    assert.ok(markup.includes('id="' + id + '"'), 'missing section id ' + id);
    assert.ok(markup.includes(escapeHtml(section.title)), 'missing heading: ' + section.title);
    assert.ok(markup.includes(escapeHtml(section.body)), 'changed legal copy: ' + section.title);
    assert.ok(markup.includes('href="#' + id + '"'), 'missing table-of-contents link: ' + id);
  }
  assert.ok(markup.includes(escapeHtml(PRIVACY.lastUpdated)));
  assert.ok(markup.includes('href="mailto:connect@vamsimarripudi.me?subject=Privacy%20request"'));
});

test('Terms uses the same accessible layout and preserves supplied text', () => {
  const sections = [
    { title: 'Using this site', body: 'Read the terms without hidden or collapsed sections.' },
    { title: 'Changes and contact', body: 'Questions may be sent to connect@vamsimarripudi.me.' },
  ];
  const markup = render('terms', sections);
  assert.equal((markup.match(/class="legal-section"/g) || []).length, sections.length);
  sections.forEach((section) => {
    assert.ok(markup.includes(escapeHtml(section.title)));
    assert.ok(markup.includes(escapeHtml(section.body)));
  });
  assert.ok(markup.includes('aria-label="Policy sections"'));
  assert.ok(markup.includes('href="#legal-terms-01"'));
  assert.ok(markup.includes('href="/privacy"'));
});

test('Route metadata and existing toast API remain in place', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const resilience = readFileSync(new URL('../src/Resilience.jsx', import.meta.url), 'utf8');
  assert.ok(app.includes('metaTitle="Privacy Notice"'));
  assert.ok(app.includes('metaTitle="Terms of Use"'));
  assert.ok(app.includes('sections={privacySections}'));
  assert.ok(app.includes('termsSections.map(([title,body])=>({title,body}))'));
  for (const method of ['success:', 'info:', 'warning:', 'error:', 'loading:', 'promise:']) {
    assert.ok(resilience.includes(method), 'missing existing toast method ' + method);
  }
  assert.ok(resilience.includes('toast--exiting'));
  assert.ok(resilience.includes('aria-live='));
});
