/** Vamsi's Corner — original account email flows, visually aligned with Corner.
 * No delivery operations here; the existing IdentityService remains authoritative.
 * The VM brand image is served from this same first-party domain, as PNG for
 * email clients which do not support the original SVG logo.
 */
import {BRAND_MARK_URL,CORNER_URL} from './communication-templates.mjs';
const BASE=CORNER_URL,INK='#080808',WHITE='#ffffff',PAPER='#f5f2eb',COPPER='#b86f55';
const FONT='Arial,Helvetica,sans-serif',SERIF='Georgia,Times New Roman,serif',MONO='Courier New,Courier,monospace';
const escapeHtml=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const normal=value=>String(value??'').replace(/[\x00-\x1f\x7f]/g,' ').trim();
function actionLink(value){
 const url=new URL(String(value||BASE));
 if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)))throw Error('Email action must use HTTPS');
 return url.toString();
}
export function renderCornerLetter({
 subject='A note from Vamsi’s Corner',recipientName='there',
 eyebrow='A LETTER FROM THE CORNER',title='A little note, just for you.',
 quote='Some moments deserve a place of their own.',paragraphs=[],
 note='A small place to keep the things that matter.',noteLabel='FROM VAMSI’S HEART',
 actionUrl=BASE,actionLabel='Visit Vamsi’s Corner',kind='welcome',
 supportEmail='connect@vamsimarripudi.me'
}={}){
 const name=normal(recipientName).replace(/\s+/g,' ').slice(0,64)||'there';
 const greeting='Dear '+name+',';
 const url=actionLink(actionUrl),safeUrl=escapeHtml(url),welcome=kind==='welcome';
 const reason=welcome?'This is a personal welcome letter from Vamsi’s Corner.':'This is an account-related message. If you did not request it, you may ignore it.';
 const body=Array.isArray(paragraphs)?paragraphs.slice(0,4).map(p=>normal(p).slice(0,1500)).filter(Boolean):[];
 const text=[normal(subject),'',greeting,'“'+normal(quote)+'”','',...body.flatMap(p=>[p,'']),normal(actionLabel)+': '+url,'',normal(noteLabel),normal(note),'','— Vamsi','Vamsi’s Corner · '+BASE,'',reason,'Contact: '+supportEmail].join('\n');
 const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(subject)}</title>
 <style>@media screen and (max-width:620px){.mail-wrap{padding:13px 9px!important}.mail-block{padding:28px 24px!important}.mail-headline{font-size:35px!important}.brand-meta{display:none!important}.mail-foot{padding:24px!important}}@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}</style></head>
 <body style="margin:0;padding:0;width:100%;background:${PAPER};color:${INK};font-family:${FONT};-webkit-text-size-adjust:100%">
 <div style="display:none!important;max-height:0;overflow:hidden;opacity:0;line-height:0;font-size:1px">${escapeHtml(welcome?'A personal welcome letter from Vamsi’s Corner.':subject)}</div>
 <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${PAPER}" style="border-collapse:collapse;background:${PAPER}"><tr><td align="center" class="mail-wrap" style="padding:29px 13px 40px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;border-collapse:separate;border-spacing:0">
 <tr><td style="padding:9px 2px 20px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td width="50" style="width:50px;vertical-align:middle"><img src="${escapeHtml(BRAND_MARK_URL)}" alt="VM." width="46" height="46" style="display:block;width:46px;height:46px;border:0;border-radius:12px;outline:none;color:#202020;font-weight:bold"></td><td style="vertical-align:middle;padding-left:9px"><strong style="font-family:${FONT};font-size:18px;font-weight:800;letter-spacing:-.7px;color:${INK}">Vamsi’s Corner<span style="color:${COPPER}">.</span></strong><div style="margin-top:5px;font-family:${MONO};font-size:9px;font-weight:700;letter-spacing:1.1px;color:#706961">NOTES FROM THE IN-BETWEEN</div></td><td class="brand-meta" align="right" style="font:700 10px ${MONO};color:#706961">PERSONAL / EST. 2026</td></tr></table></td></tr>
 <tr><td bgcolor="${COPPER}" height="2" style="height:2px;line-height:2px;font-size:1px;background:${COPPER}">&nbsp;</td></tr>
 <tr><td bgcolor="${WHITE}" style="border:1px solid #e6dfd8;border-top:0;border-radius:20px 20px 0 0;background:${WHITE}"><div class="mail-block" style="padding:36px 40px 38px">
 <div style="font-family:${MONO};font-weight:700;font-size:10px;letter-spacing:1.3px;color:${COPPER};line-height:1.7">${escapeHtml(eyebrow)}</div><h1 class="mail-headline" style="font:normal 43px/1.13 ${SERIF};letter-spacing:-1.2px;margin:19px 0 23px;color:${INK}">${escapeHtml(title)}</h1>
 <p style="font-family:${SERIF};font-size:22px;margin:0 0 21px;color:${INK}">${escapeHtml(greeting)}</p>
 <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f6f1ed" style="background:#f6f1ed;margin-bottom:24px;border-left:3px solid ${COPPER}"><tr><td style="padding:19px 21px;font:italic 20px/1.55 ${SERIF};color:${INK}">“${escapeHtml(quote)}”</td></tr></table>
 ${body.map(p=>`<p style="font-family:${FONT};font-size:14px;line-height:1.85;color:${INK};margin:0 0 17px">${escapeHtml(p)}</p>`).join('')}
 <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:27px 0 0"><tr><td bgcolor="${INK}" style="background:#080808;border-radius:12px"><a href="${safeUrl}" style="display:inline-block;padding:15px 24px;color:#ffffff;text-decoration:none;font:700 13px/1.5 ${FONT}">${escapeHtml(actionLabel)} &nbsp; ↗</a></td></tr></table>
 </div></td></tr>
 <tr><td class="mail-foot" bgcolor="#f5f2eb" style="background:#f5f2eb;border:1px solid #e6dfd8;border-top:0;border-radius:0 0 19px 19px;padding:27px 39px 29px"><div style="font:700 10px ${MONO};letter-spacing:1.2px;color:${COPPER}">${escapeHtml(noteLabel)}</div><p style="font:italic 19px/1.55 ${SERIF};color:${INK};margin:12px 0 9px">${escapeHtml(note)}</p><p style="font:700 12px ${FONT};margin:0;color:${INK}">— Vamsi</p><div style="height:1px;background:#d9d0c9;margin:23px 0 16px;font-size:1px">&nbsp;</div><p style="font:11px/1.8 ${FONT};color:#706961;margin:0">${escapeHtml(reason)}</p><p style="font:12px/1.9 ${FONT};margin:9px 0 0"><a href="${escapeHtml(BASE)}" style="color:${INK}">Visit Corner</a> &nbsp; · &nbsp; <a href="mailto:${escapeHtml(supportEmail)}" style="color:${INK}">${escapeHtml(supportEmail)}</a></p></td></tr>
 <tr><td style="text-align:center;padding:16px;color:#706961;font:10px/1.65 ${FONT}">vamsimarripudi.me/corner &nbsp; · &nbsp; © ${new Date().getUTCFullYear()} Vamsi Marripudi</td></tr>
 </table></td></tr></table></body></html>`;
 return {subject:normal(subject),html,text};
}
export function welcomeLetterFor(profileOrName,{actionUrl=BASE}={}){
 const source=typeof profileOrName==='string'?profileOrName:profileOrName?.display_name??profileOrName?.displayName??profileOrName?.name;
 const name=normal(source).replace(/\s+/g,' ').slice(0,60)||'there';
 return renderCornerLetter({kind:'welcome',recipientName:name,
  subject:'A letter for '+name+' — from Vamsi’s heart | Vamsi’s Corner',
  eyebrow:'A PERSONAL WELCOME · LETTER NO. 01',title:'Some things are worth keeping.',
  quote:'Every meaningful beginning starts with a small, honest thought.',
  paragraphs:[
   'Welcome to my little corner of the internet — a quiet place for ideas, stories, things I build, and moments worth celebrating.',
   'I wanted this space to feel less like a feed and more like opening a familiar notebook. Come by whenever you like; there is always room for another thoughtful moment.'
  ],noteLabel:'FROM VAMSI’S HEART',
  note:'May we keep noticing the little things that make a day meaningful. Every small step belongs to the story.',
  actionUrl,actionLabel:'Step into the Corner'});
}
export const welcomePreviewFor=name=>welcomeLetterFor({displayName:name});
const actions={
 'verify-email':{eyebrow:'YOUR PRIVATE CORNER · EMAIL VERIFICATION',title:'A place to begin.',quote:'Every little beginning deserves a moment of welcome.',paragraphs:['One quick step will make this space yours. Confirm your email address to activate your private Corner account.','This link can be used only once and expires after 30 minutes.'],actionLabel:'Verify my email',noteLabel:'A QUIET REMINDER',note:'If you did not request an account, no action is required.'},
 'reset-password':{eyebrow:'ACCOUNT SECURITY · PRIVATE LETTER',title:'A fresh start, simply.',quote:'A small reset can make room for a fresh beginning.',paragraphs:['We received a request to reset the password for your Corner account. Use the secure link below to choose a new password.','For your security, this link expires after 20 minutes and works only once.'],actionLabel:'Reset my password',noteLabel:'A QUIET REMINDER',note:'If you did not request this reset, you can safely ignore this message.'},
 'confirm-email':{eyebrow:'YOUR ACCOUNT · EMAIL UPDATE',title:'One detail, kept safe.',quote:'Even small changes deserve a little care.',paragraphs:['Confirm your new email address to complete your Corner account update.','This one-time verification link expires after 20 minutes.'],actionLabel:'Confirm new email',noteLabel:'A QUIET REMINDER',note:'If this was not your request, leave the link unopened and contact us.'},
 'admin/register':{eyebrow:'PRIVATE STUDIO · INVITATION',title:'A seat at the studio.',quote:'The best things are built with people we trust.',paragraphs:['You have been invited to help care for Vamsi’s Corner. This invitation is personal and single-use.','Accept it within 48 hours. Studio access also requires an authenticator.'],actionLabel:'Accept studio invitation',noteLabel:'A PERSONAL NOTE',note:'Thank you for bringing care and attention to the little details.'}
};
export function transactionalCornerEmail({subject,recipientName='there',actionUrl,flow}){
 return renderCornerLetter({kind:'security',subject,recipientName,actionUrl,...(actions[flow]||actions['verify-email'])});
}
