import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeDiwaliSender, diwaliShareUrl, personalizeDiwaliHtml } from '../src/diwali-sender.mjs';

const original = readFileSync(new URL('../public/diwali-siva.html',import.meta.url),'utf8');
const creator = readFileSync(new URL('../public/diwali-create.html',import.meta.url),'utf8');

test('original Siva greeting remains personal, photo-free and without six caution cards',()=>{
  assert.match(original, /Siva Palavalasa/);
  assert.match(original, /class="diya-stage"/);
  assert.match(original, /class="dog-section" id="compassion"/);
  assert.match(original, /Engineer(?:ed|ing) by/);
  assert.doesNotMatch(original, /<section class="safety"|<article class="precaution"|\b01 \/ 06\b|\b06 \/ 06\b/);
  assert.doesNotMatch(original, /<img\b|siva-portrait|photo\-hero/i);
  assert.match(original, /href="\/diwali\/create"/);
});

test('sender names support Unicode letters and reject unsafe or excessive input',()=>{
  assert.equal(normalizeDiwaliSender('  Siva   Palavalasa '),'Siva Palavalasa');
  assert.equal(normalizeDiwaliSender('అనన్య దేవి'),'అనన్య దేవి');
  assert.equal(normalizeDiwaliSender("O'Connor"),"O'Connor");
  assert.equal(normalizeDiwaliSender('a'),null);
  assert.equal(normalizeDiwaliSender('X'.repeat(49)),null);
  assert.equal(normalizeDiwaliSender('<script>alert(1)</script>'),null);
  assert.equal(normalizeDiwaliSender('"><img src=x>'),null);
  assert.equal(normalizeDiwaliSender('A\nB'),null);
  assert.equal(normalizeDiwaliSender(''),null);
});

test('personalized greeting link is stateless and preserves the card design',()=>{
  const sender='Ananya Rao';
  const url=diwaliShareUrl(sender);
  assert.equal(url,'https://vamsimarripudi.me/corner/diwali?from=Ananya%20Rao');
  const html=personalizeDiwaliHtml(original,sender);
  assert.match(html,/Ananya Rao/);
  assert.match(html,/A warm Diwali greeting from Ananya Rao/);
  assert.doesNotMatch(html,/greeting from Siva,/);
  assert.doesNotMatch(html,/Siva Palavalasa/);
  assert.match(html,/Happy/);
  assert.match(html,/id="compassion"/);
  assert.match(html,/diwali\/preview.png/);
  assert.match(html,/meta name="robots" content="noindex, noarchive"/);
  assert.match(html,/https:\/\/vamsimarripudi.me\/corner\/diwali\?from=Ananya%20Rao/);
  assert.doesNotMatch(html,/<article class="precaution"/);
  assert.doesNotMatch(html,/siva\/preview.png/);
  assert.equal(personalizeDiwaliHtml(original,'<svg>'),null);
});

test('creator offers an accessible name form and working share controls',()=>{
  assert.match(creator, /id="createForm"/);
  assert.match(creator, /id="sender"/);
  assert.match(creator, /id="copyButton"/);
  assert.match(creator, /id="whatsappButton"/);
  assert.match(creator, /encodeURIComponent\(name\)/);
  assert.match(creator, /aria-live="polite"/);
  assert.doesNotMatch(creator, /<img\b/i);
});

test('new routes are isolated inside Corner',()=>{
  const server=readFileSync(new URL('../src/server.mjs',import.meta.url),'utf8');
  for(const route of ["'/diwali/create'","'/diwali/preview.png'","'/diwali/siva'","'/diwali'"]) {
    assert.ok(server.includes(route),'missing '+route);
  }
  assert.match(server, /normalizeDiwaliSender\(from\)/);
  assert.match(server, /personalizeDiwaliHtml\(template,sender\)/);
});
