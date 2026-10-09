import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {emailShell} from '../api/lib/track.js';

test('reply email brand uses two email-safe columns with role aligned under sender name',()=>{
 const html=emailShell({preheader:'Message received.',body:'<tr><td>Reply body.</td></tr>'});
 assert.match(html,/role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse"/);
 assert.match(html,/<td valign="middle"[^>]*>\s*<strong[^>]*>VM<span[^>]*>\.<\/span><\/strong><\/td><td valign="middle"[^>]*>\s*<div[^>]*>Vamsi Marripudi<\/div><div[^>]*>Founder Engineer<\/div><\/td>/);
 assert.doesNotMatch(html,/<br>\s*Founder Engineer/,'Founder Engineer must not wrap under logo');
 assert.match(html,/max-width:620px/,'Email body width remains bounded');
 assert.match(html,/https:\/\/vamsimarripudi\.me\/privacy/,'Existing footer links remain intact');
 assert.match(html,/Reply body\./,'Original user-authored reply body is preserved');
});
test('reply template visually labels and escapes the enquiry reference',()=>{
 const source=readFileSync(new URL('../api/track/enquiries/[referenceId]/reply.js',import.meta.url),'utf8');
 assert.match(source,/Enquiry reference&nbsp;/);
 assert.match(source,/escapeHtml\(enquiry\.reference_id\)/,'Never render reference without HTML escaping');
 assert.match(source,/overflow-wrap:anywhere/,'Long references wrap without overflow');
 assert.doesNotMatch(source,/color:#64665f;font-size:12px;font-weight:700;letter-spacing:\.08em/,'Old low contrast badge is removed');
});
