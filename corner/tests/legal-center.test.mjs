import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {LEGAL_DOCUMENTS,LEGAL_ROUTES,isLegalPath,legalPage} from '../src/legal-ui.mjs';
import {CORE_LEGAL} from '../src/legal-core.mjs';
import {COMMUNITY_LEGAL} from '../src/legal-community.mjs';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const names=new Set(LEGAL_DOCUMENTS.map(x=>x.slug));
const expected=['privacy','cookies','dpdp','security-retention','terms','terms-of-use','viewership','disclaimer','community','copyright','grievances','accessibility'];

test('legal register includes twelve comprehensive original policies',()=>{
 assert.equal(CORE_LEGAL.length,4);
 assert.equal(COMMUNITY_LEGAL.length,8);
 assert.deepEqual([...names].sort(),expected.slice().sort());
 assert.equal(LEGAL_ROUTES.length,13);
 assert.equal(new Set(LEGAL_ROUTES).size,13);
 for(const doc of LEGAL_DOCUMENTS){
  assert.ok(doc.title.length>=8&&doc.summary.length>=32,doc.slug+' metadata');
  assert.match(doc.updated,/27 October 2026/);
  assert.ok(doc.sections.length>=4,doc.slug+' is detailed');
  assert.ok(doc.highlights.length>=2,doc.slug+' has summary');
  const ids=doc.sections.map(x=>x.id);
  assert.equal(new Set(ids).size,ids.length,doc.slug+' unique anchors');
  const copy=doc.sections.flatMap(x=>[...(x.paragraphs||[]),...(x.bullets||[])]);
  assert.ok(copy.join(' ').length>1400,doc.slug+' has substantive content');
  assert.doesNotMatch(copy.join(' '),/(lorem ipsum|TBD|placeholder|insert your|termly\.io)/i);
 }
});

test('legal pages use full navigation, semantic sections and responsive styles',()=>{
 const hub=legalPage('/policies');
 assert.match(hub,/A little more/);
 assert.match(hub,/legal-hub-hero/);
 assert.match(hub,/href="\/legal\.css\?v=trust1"/);
 assert.match(hub,/class="corner-comfort corner-legal"/);
 assert.equal((hub.match(/class="legal-card"/g)||[]).length,12);
 for(const doc of LEGAL_DOCUMENTS){
  const html=legalPage('/'+doc.slug);
  assert.ok(html.includes(doc.title),'Policy title on '+doc.slug);
  assert.match(html,/class="legal-article"/);
  assert.match(html,/aria-label="On this page"/);
  assert.match(html,/class="legal-mobile-index"/);
  assert.match(html,/class="legal-backtop"/);
  assert.match(html,/mailto:connect@vamsimarripudi\.me/);
  assert.match(html,/Reviewed <span class="legal-date">27 October 2026<\/span>/);
  assert.match(html,/href="\/policies"/);
  assert.doesNotMatch(html,/YOUR_POLICY_TITLE|TODO-LEGAL/i);
 }
});

test('DPDP notice accurately reflects staged 2025 to 2027 commencement',()=>{
 const html=legalPage('/dpdp');
 for(const phrase of ['G.S.R. 843(E)','G.S.R. 846(E)','13 November 2025','May 2027','November 2026','Data Protection Board','under 18'])
  assert.ok(html.includes(phrase),'DPDP policy includes '+phrase);
 assert.doesNotMatch(html,/fully certified|100% compliant|GDPR certified/i);
});

test('privacy and cookies match features and keep consent controls available',()=>{
 const privacy=legalPage('/privacy'),cookies=legalPage('/cookies');
 assert.match(privacy,/Detailed first-party reading data/);
 assert.match(privacy,/limited basic event endpoint/i);
 assert.match(cookies,/corner_reading_consent/);
 assert.match(privacy,/90-day cleanup lifecycle/);
 assert.match(privacy,/private profile/i);
 assert.match(privacy,/Resend/);
 for(const cookie of ['corner_member_session','corner_session','corner_visitor','vm_site_analytics','corner_reading_consent'])
  assert.ok(cookies.includes(cookie),'Cookie register contains '+cookie);
 assert.match(cookies,/class="legal-data-table"/);
 for(const page of [privacy,cookies,legalPage('/dpdp')]){
  assert.match(page,/corner-comfort corner-privacy corner-legal/);
  assert.match(page,/src="\/reading-analytics\.js" defer/);
  assert.match(page,/href="#reading-preferences"/);
 }
 const server=read('src/server.mjs'),ui=read('src/ui.mjs'),style=read('public/legal.css');
 assert.match(server,/if\(isLegalPath\(pathname\)\)/);
 assert.match(server,/\/legal\.css/);
 for(const path of ['policies','cookies','dpdp']) assert.ok(ui.includes('href="/'+path+'"'));
 for(const selector of ['legal-content-grid','legal-data-table','legal-hub-note'])assert.ok(style.includes(selector));
 assert.match(style,/@media\(max-width:600px\)/);
 assert.match(style,/@media print/);
 assert.match(style,/prefers-reduced-motion:reduce/);
 assert.match(style,/forced-colors:active/);
});

test('legal copy does not invent corporate ownership, sales or certifications',()=>{
 for(const doc of LEGAL_DOCUMENTS)
  assert.doesNotMatch(JSON.stringify(doc).toLowerCase(),/kravia private limited|razorpay subscription|we are gdpr-certified/);
 assert.match(legalPage('/viewership'),/link to a published post/);
 assert.match(legalPage('/community'),/moderation/i);
 assert.match(legalPage('/grievances'),/statutory/i);
});
