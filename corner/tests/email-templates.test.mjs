import test from 'node:test';
import assert from 'node:assert/strict';
import {renderCornerLetter,transactionalCornerEmail,welcomePreviewFor} from '../src/email-templates.mjs';

const quotes={Vamsi:'Every meaningful beginning starts with a small, honest thought.',Jaya:'The loveliest memories often begin as ordinary days.'};
test('individual welcome letters render names, correct quotes and signed hearts',()=>{
 for(const [name,quote] of Object.entries(quotes)){
  const {html,text,subject}=welcomePreviewFor(name);
  assert.match(subject,new RegExp(name));
  assert.ok(html.includes('Dear '+name+','));
  assert.ok(text.includes('Dear '+name+',\n“'+quote+'”'));
  assert.ok(html.indexOf('Dear '+name+',')<html.indexOf(quote));
  assert.ok(text.includes('FROM VAMSI’S HEART')&&text.includes('— Vamsi'));
  assert.match(html,/max-width:640px/);
  assert.match(html,/background:#080808/);
  assert.match(html,/background:#ffffff/);
  assert.match(html,/border-radius:26px 26px 0 0/);
  assert.match(html,/@media screen and \(max-width:620px\)/);
  assert.ok(!/<script|<img\b/.test(html));
 }
 assert.notEqual(welcomePreviewFor('Vamsi').html,welcomePreviewFor('Jaya').html);
});
test('verification, recovery and invitations preserve first action URL and text fallback',()=>{
 for(const flow of ['verify-email','reset-password','confirm-email','admin/register']){
  const url='https://vamsimarripudi.me/corner/'+flow+'#token=qa-only';
  const mail=transactionalCornerEmail({subject:'Test',recipientName:'Sam',flow,actionUrl:url});
  assert.equal(mail.text.match(/https?:\/\/\S+/)?.[0],url);
  assert.ok(mail.html.includes(url));
  assert.ok(mail.html.includes('Dear Sam,'));
 }
});
test('links are validated and hostile displayed text is escaped',()=>{
 const mail=renderCornerLetter({recipientName:'<img>',quote:'<script>x</script>',actionUrl:'https://vamsimarripudi.me/corner?a=1&b=2'});
 assert.ok(mail.html.includes('&lt;img&gt;')&&mail.html.includes('&lt;script&gt;'));
 assert.ok(mail.html.includes('?a=1&amp;b=2'));
 assert.throws(()=>renderCornerLetter({actionUrl:'javascript:alert(1)'}),/HTTPS/);
 assert.throws(()=>renderCornerLetter({actionUrl:'http://example.com'}),/HTTPS/);
 assert.doesNotThrow(()=>renderCornerLetter({actionUrl:'http://localhost:3000/corner'}));
});
test('table email is accessible, self-contained and does not use remote styling',()=>{
 const mail=welcomePreviewFor('Jaya');
 assert.match(mail.html,/role="presentation"/);
 assert.match(mail.html,/meta name="viewport"/);
 assert.match(mail.html,/A little space for things worth keeping/);
 assert.match(mail.html,/background:#f5f2eb/);
 assert.ok(!mail.html.includes('@font-face'));
 assert.ok(!mail.html.includes('<iframe'));
});
