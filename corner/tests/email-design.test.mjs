import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CATEGORIES,CATEGORY_THEMES,BRAND_MARK_URL,TEMPLATE_VERSION,renderStoryAlert,renderWeeklyDigest,renderAccountNotice,renderModerationNotice,renderSubscriptionNotice,renderOperationsReport,templateCatalog} from '../src/communication-templates.mjs';
import {renderCornerLetter,welcomeLetterFor,welcomePreviewFor,transactionalCornerEmail} from '../src/email-templates.mjs';
const unsub='https://vamsimarripudi.me/corner/follow/unsubscribe#token=sample-token-not-live';
const post=(category='Latest')=>({state:'published',category,slug:category.toLowerCase()+'-story',title:'A story <b> & little & true',excerpt:'A real note, not a tracking message.',body:'...',published_at:'2026-10-28T12:00:00.000Z'});
test('the branded asset exists, is a real PNG, and every email references the first-party host',()=>{
 assert.ok(fs.existsSync(new URL('../public/email-vm-mark.png',import.meta.url)));
 const bytes=fs.readFileSync(new URL('../public/email-vm-mark.png',import.meta.url));
 assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 assert.equal(BRAND_MARK_URL,'https://vamsimarripudi.me/corner/email-vm-mark.png');
 assert.ok(TEMPLATE_VERSION.includes('domain'));
});
test('six category layouts are differentiated editorial motifs in one shared Corner palette',()=>{
 const html=CATEGORIES.map(category=>renderStoryAlert({post:post(category),unsubscribeUrl:unsub}).html);
 assert.equal(new Set(html).size,6);
 assert.equal(new Set(CATEGORIES.map(category=>CATEGORY_THEMES[category].mode)).size,6);
 for(const text of html){
  assert.match(text,/Vamsi’s Corner/);assert.match(text,/NOTES FROM THE IN-BETWEEN/);
  assert.match(text,/email-vm-mark\.png/);assert.match(text,/Unsubscribe/);
  assert.match(text,/background:#FFFFFF/);assert.match(text,/#B86F55/);
  assert.match(text,/role="presentation"/);assert.doesNotMatch(text,/<script\b/);
  assert.doesNotMatch(text,/(?:fonts\.googleapis|utm_source|<img[^>]+width=\"1\")/i);
  assert.match(text,/&lt;b&gt; &amp; little &amp; true/);
 }
 assert.equal(templateCatalog().length,20);
});
test('no false List-Unsubscribe one-click advertisement for fragment-token links',()=>{
 const notice=renderStoryAlert({post:post(),unsubscribeUrl:unsub});
 assert.ok(notice.recommendedHeaders['List-ID']);
 assert.equal(notice.recommendedHeaders['List-Unsubscribe'],undefined);
 assert.match(notice.text,/Unsubscribe:/);
});
test('no insecure or unrelated remote images, unsafe links, or preview-only drafts',()=>{
 assert.throws(()=>renderStoryAlert({post:post(),unsubscribeUrl:unsub,coverImageUrl:'https://evil.test/tracker.png',category:'Moments'}),/Corner site/);
 assert.throws(()=>renderStoryAlert({post:{...post(),state:'draft'},unsubscribeUrl:unsub}),/Draft or archived/);
 assert.throws(()=>renderStoryAlert({post:post(),unsubscribeUrl:'javascript:alert(1)'}),/HTTPS/);
 assert.throws(()=>renderStoryAlert({post:post(),unsubscribeUrl:'https://fake-vamsimarripudi.me/corner'}),/Corner site/);
 assert.throws(()=>renderWeeklyDigest({posts:[post()]}),/unsubscribe/i);
 const photo=renderStoryAlert({post:post('Moments'),unsubscribeUrl:unsub,coverImageUrl:'https://vamsimarripudi.me/corner/media/example.jpg'});
 assert.match(photo.html,/Photograph accompanying/);
});
test('digest and service emails preserve a unified brand and sensible recipient purpose',()=>{
 const variants=[
 renderWeeklyDigest({posts:[post('Notes'),post('Wishes')],unsubscribeUrl:unsub}),
 renderAccountNotice({type:'welcome'}),
 renderAccountNotice({type:'reset',actionUrl:'https://vamsimarripudi.me/corner/reset-password#token=fake'}),
 renderSubscriptionNotice({type:'confirm',actionUrl:'https://vamsimarripudi.me/corner/follow/confirm#token=fake'}),
 renderModerationNotice({type:'new',commenterName:'<&>'}),
 renderOperationsReport({metrics:{registered:5,ip:'1.2.3.4'}})
 ];
 variants.forEach(mail=>{assert.match(mail.html,/email-vm-mark\.png/);assert.match(mail.html,/#B86F55/);assert.match(mail.text,/Corner/);});
 assert.doesNotMatch(variants[4].html,/<&>/);assert.match(variants[4].html,/&lt;&amp;&gt;/);
 assert.doesNotMatch(variants[5].html,/1\.2\.3\.4/);
});
test('legacy welcome and requested security flows maintain exact APIs and first-action URLs',()=>{
 for(const name of ['Manohar','Asha','Kiran','Vamsi','Jaya']){
  const m=welcomeLetterFor({display_name:name});
  assert.ok(m.subject.includes(name));assert.ok(m.html.includes('Dear '+name+','));
  assert.ok(m.text.includes('Dear '+name+','));
  assert.ok(m.text.includes('FROM VAMSI’S HEART')&&m.text.includes('— Vamsi'));
  assert.match(m.html,/background:#080808/);assert.match(m.html,/background:#ffffff/);
  assert.match(m.html,/@media screen and \(max-width:620px\)/);
  assert.equal(welcomePreviewFor(name).html,m.html);
 }
 assert.ok(welcomeLetterFor(null).text.includes('Dear there,'));
 for(const flow of ['verify-email','reset-password','confirm-email','admin/register']){
  const url='https://vamsimarripudi.me/corner/'+flow+'#token=fake';
  const m=transactionalCornerEmail({subject:'Test',recipientName:'Manohar',flow,actionUrl:url});
  assert.equal(m.text.match(/https?:\/\/\S+/)?.[0],url);
  assert.ok(m.html.includes(url));assert.ok(m.html.includes('Dear Manohar,'));
 }
 const clean=renderCornerLetter({recipientName:'&example',quote:'Welcome <here>',actionUrl:'https://vamsimarripudi.me/corner?a=1&b=2'});
 assert.match(clean.html,/&amp;example/);assert.match(clean.html,/&lt;here&gt;/);assert.match(clean.html,/\?a=1&amp;b=2/);
 assert.throws(()=>renderCornerLetter({actionUrl:'javascript:alert(1)'}),/HTTPS/);
 assert.doesNotThrow(()=>renderCornerLetter({actionUrl:'http://localhost:3000/corner'}));
 assert.doesNotMatch(clean.html,/<iframe/);assert.doesNotMatch(clean.html,/@font-face/);
});
