import test from 'node:test';
import assert from 'node:assert/strict';
import { renderCornerLetter, transactionalCornerEmail, welcomeLetterFor, welcomePreviewFor } from '../src/email-templates.mjs';

test('welcome letter personalizes dynamically from saved profile display names',()=>{
 for(const name of ['Manohar','Asha','Kiran','Vamsi','Jaya']){
  const result=welcomeLetterFor({display_name:name});
  assert.ok(result.subject.includes(name));
  assert.ok(result.html.includes('Dear '+name+','));
  assert.ok(result.text.includes('Dear '+name+','));
  assert.ok(result.text.includes('FROM VAMSI’S HEART')&&result.text.includes('— Vamsi'));
  assert.match(result.html,/background:#080808/);
  assert.match(result.html,/background:#ffffff/);
  assert.match(result.html,/@media screen and \(max-width:620px\)/);
  assert.equal(welcomePreviewFor(name).html,result.html);
 }
 assert.notEqual(welcomeLetterFor({display_name:'Manohar'}).html,welcomeLetterFor({displayName:'Asha'}).html);
});
test('welcome uses current profile, not a hard-coded name or email local-part',()=>{
 const profile={display_name:'Original Name'};
 assert.ok(welcomeLetterFor(profile).text.includes('Dear Original Name,'));
 profile.display_name='Updated Name';
 assert.ok(welcomeLetterFor(profile).text.includes('Dear Updated Name,'));
 assert.ok(welcomeLetterFor(null).text.includes('Dear there,'));
});
test('verification, recovery and invitations keep secure URL and profile greeting',()=>{
 for(const flow of ['verify-email','reset-password','confirm-email','admin/register']){
  const url='https://vamsimarripudi.me/corner/'+flow+'#token=qa-only';
  const mail=transactionalCornerEmail({subject:'Test',recipientName:'Manohar',flow,actionUrl:url});
  assert.equal(mail.text.match(/https?:\/\/\S+/)?.[0],url);
  assert.ok(mail.html.includes(url));
  assert.ok(mail.html.includes('Dear Manohar,'));
 }
});
test('validates action links and escapes displayed text',()=>{
 const mail=renderCornerLetter({recipientName:'&example',quote:'Welcome <here>',actionUrl:'https://vamsimarripudi.me/corner?a=1&b=2'});
 assert.ok(mail.html.includes('&amp;example')&&mail.html.includes('&lt;here&gt;'));
 assert.ok(mail.html.includes('?a=1&amp;b=2'));
 assert.throws(()=>renderCornerLetter({actionUrl:'javascript:alert(1)'}),/HTTPS/);
 assert.throws(()=>renderCornerLetter({actionUrl:'http://example.com'}),/HTTPS/);
 assert.doesNotThrow(()=>renderCornerLetter({actionUrl:'http://localhost:3000/corner'}));
});
test('self-contained responsive letter has no remote dependencies',()=>{
 const mail=welcomeLetterFor({display_name:'Manohar'});
 assert.match(mail.html,/role="presentation"/);
 assert.match(mail.html,/meta name="viewport"/);
 assert.match(mail.html,/background:#f5f2eb/);
 assert.ok(!mail.html.includes('@font-face'));
 assert.ok(!mail.html.includes('<iframe'));
});
