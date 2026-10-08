/**
 * Vamsi's Corner — premium, accessible, dependency-free email system.
 * The HTML is table-based and self-contained for Gmail, Outlook and Apple Mail.
 */
const INK='#080808',WHITE='#ffffff',PAPER='#f5f2eb',MUTED='#55504b',COPPER='#c89371';
const BASE='https://vamsimarripudi.me/corner';
const FONT='Arial,Helvetica,sans-serif',SERIF='Georgia,Times New Roman,serif';
const escapeHtml=(value)=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const normal=(value)=>String(value??'').replace(/[\x00-\x1F\x7F]/g,' ').trim();
function actionLink(value){
  const url=new URL(String(value||BASE));
  if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)))
    throw Error('Email action must use HTTPS');
  return url.toString();
}
export function renderCornerLetter({
  subject='A note from Vamsi’s Corner',recipientName='there',
  eyebrow='A LETTER FROM THE CORNER',title='A little note, just for you.',
  quote='Some moments deserve a place of their own.',paragraphs=[],
  note='A small place to keep the things that matter.',
  noteLabel='FROM VAMSI’S HEART',actionUrl=BASE,actionLabel='Visit Vamsi’s Corner',
  kind='welcome',supportEmail='connect@vamsimarripudi.me'
}={}){
  const name=normal(recipientName).slice(0,64)||'there';
  const greeting='Dear '+name+',';
  const url=actionLink(actionUrl);
  const isWelcome=kind==='welcome';
  const reason=isWelcome
    ? 'This is a personal welcome letter preview from Vamsi’s Corner.'
    : 'This is an account-related message. If you did not request this action, you may ignore this email.';
  const body=paragraphs.slice(0,4).map(x=>normal(x).slice(0,1500)).filter(Boolean);
  const text=[
    normal(subject),'',greeting,'“'+normal(quote)+'”','',
    ...body.flatMap(x=>[x,'']),
    normal(actionLabel)+': '+url,'',normal(noteLabel),normal(note),'',
    '— Vamsi','Vamsi’s Corner · '+BASE,'',reason,'Contact: '+supportEmail
  ].join('\n');
  const padding='padding:40px 44px;';
  const html=[
    '<!doctype html><html lang="en"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<meta name="color-scheme" content="light"><title>',escapeHtml(subject),'</title>',
    '<style>@media screen and (max-width:620px){.outer{padding:14px 10px!important}.body-pad{padding:29px 24px!important}.hero-pad{padding:32px 24px!important}.hero-title{font-size:34px!important}.footer-pad{padding:26px 24px!important}.footer-right{text-align:left!important;padding-top:12px!important}}@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}</style></head>',
    '<body style="margin:0;padding:0;width:100%;background:',PAPER,';font-family:',FONT,';color:',INK,';-webkit-text-size-adjust:100%">',
    '<div style="display:none!important;max-height:0;overflow:hidden;opacity:0;line-height:0;font-size:1px">',
      escapeHtml(isWelcome?'A personal welcome letter from Vamsi’s heart.':subject),
    '</div>',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="',PAPER,'" style="border-collapse:collapse;background:',PAPER,'">',
    '<tr><td align="center" class="outer" style="padding:34px 18px 40px">',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;border-collapse:separate;border-spacing:0">',
    '<tr><td style="padding:10px 6px 23px">',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>',
    '<td width="52" valign="middle" style="width:52px"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td bgcolor="',INK,'" align="center" style="width:43px;height:43px;line-height:43px;border-radius:13px;background:',INK,';color:',WHITE,';font-size:30px;font-family:',SERIF,'">✳</td></tr></table></td>',
    '<td valign="middle" style="padding-left:7px"><div style="font-size:17px;letter-spacing:-.6px;font-weight:800;color:',INK,'">Vamsi’s Corner<span style="color:#b57152">.</span></div>',
    '<div style="margin-top:5px;font-size:9px;letter-spacing:1.45px;color:',MUTED,';font-weight:700">THOUGHTS &nbsp;·&nbsp; UPDATES &nbsp;·&nbsp; CELEBRATIONS</div></td>',
    '<td align="right" valign="middle" style="font-size:10px;font-weight:700;color:',MUTED,';letter-spacing:1.1px;white-space:nowrap">THE CORNER ↗</td>',
    '</tr></table></td></tr>',
    '<tr><td bgcolor="',INK,'" class="hero-pad" style="background:',INK,';padding:43px 44px 36px;border-radius:26px 26px 0 0">',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td valign="top" style="font-size:10px;line-height:1.3;letter-spacing:2px;color:#d1b69f;font-weight:800">',
    escapeHtml(eyebrow),'</td><td align="right" valign="top" style="font-family:',SERIF,';font-size:30px;color:',WHITE,';line-height:1">✳</td></tr></table>',
    '<h1 class="hero-title" style="font-family:',SERIF,';font-size:41px;line-height:1.13;letter-spacing:-1.4px;color:',WHITE,';font-weight:400;margin:23px 0 0">',
    escapeHtml(title),'</h1><div style="width:60px;height:2px;margin-top:28px;background:',COPPER,'"></div>',
    '</td></tr>',
    '<tr><td bgcolor="',WHITE,'" class="body-pad" style="padding:41px 45px 32px;background:',WHITE,';color:',INK,';border-left:1px solid #e8e2d9;border-right:1px solid #e8e2d9">',
    '<h2 style="font-family:',SERIF,';font-weight:400;font-size:26px;letter-spacing:-.6px;line-height:1.3;margin:0 0 22px;color:',INK,'">',
    escapeHtml(greeting),'</h2>',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 31px"><tr><td width="4" bgcolor="',INK,'" style="width:4px;background:',INK,';border-radius:3px">&nbsp;</td>',
    '<td bgcolor="#f7f4f0" style="background:#f7f4f0;border-radius:0 13px 13px 0;padding:20px 19px;color:',INK,';font-family:',SERIF,';font-size:21px;font-style:italic;line-height:1.52">',
    '“',escapeHtml(quote),'”</td></tr></table>',
    ...body.map(p=>'<p style="margin:0 0 20px;color:'+INK+';font-family:'+FONT+';font-size:15px;line-height:1.82">'+escapeHtml(p)+'</p>'),
    '<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:26px 0"><tr><td bgcolor="',INK,'" style="background:',INK,';border-radius:12px">',
    '<a href="',escapeHtml(url),'" style="display:inline-block;padding:15px 24px;color:',WHITE,';font-size:13px;line-height:1.4;font-family:',FONT,';font-weight:700;text-decoration:none">',
    escapeHtml(actionLabel),' &nbsp; ↗</a></td></tr></table>',
    '<div style="height:1px;background:#e9e2d7;margin:29px 0"></div>',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f7f3ee" style="background:#f7f3ee;border-radius:15px"><tr><td style="padding:23px 24px">',
    '<div style="font-family:',FONT,';font-size:10px;font-weight:800;letter-spacing:1.7px;color:',MUTED,';margin-bottom:13px">',
    escapeHtml(noteLabel),'</div>',
    '<div style="font-family:',SERIF,';font-size:18px;font-style:italic;line-height:1.6;color:',INK,'">',escapeHtml(note),'</div>',
    '<div style="font-family:',SERIF,';font-size:23px;font-style:italic;color:',INK,';margin-top:15px">— Vamsi</div>',
    '</td></tr></table>',
    '</td></tr>',
    '<tr><td bgcolor="',INK,'" class="footer-pad" style="padding:29px 44px 32px;background:',INK,';border-radius:0 0 25px 25px">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>',
    '<td style="font-family:',FONT,';font-size:11px;line-height:1.75;color:',WHITE,';font-weight:700">VAMSI’S CORNER <span style="color:',COPPER,'">✳</span>',
    '<br><span style="font-weight:400;color:#c3beb6">A little space for things worth keeping.</span></td>',
    '<td align="right" class="footer-right" style="font-family:',FONT,';font-size:11px;line-height:1.75;color:#c3beb6">',
    '<a href="',escapeHtml(BASE),'" style="color:',WHITE,';text-decoration:underline">Visit the Corner ↗</a><br>',
    '<a href="mailto:',escapeHtml(supportEmail),'" style="color:#c3beb6;text-decoration:none">',escapeHtml(supportEmail),'</a></td>',
    '</tr></table></td></tr>',
    '<tr><td align="center" style="padding:20px 15px 0;font-family:',FONT,';font-size:10px;line-height:1.7;color:',MUTED,'">',
    escapeHtml(reason),'<br>© ',String(new Date().getUTCFullYear()),' Vamsi’s Corner · A personal space by Vamsi',
    '</td></tr>',
    '</table></td></tr></table></body></html>'
  ].join('');
  return {subject:normal(subject),html,text};
}
export function welcomeLetterFor(profileOrName, { actionUrl = BASE } = {}) {
 const source = typeof profileOrName === 'string'
   ? profileOrName
   : profileOrName?.display_name ?? profileOrName?.displayName ?? profileOrName?.name;
 const name = normal(source).replace(/\s+/g,' ').slice(0,60) || 'there';
 return renderCornerLetter({
   kind:'welcome',recipientName:name,
   subject:'A letter for '+name+' — from Vamsi’s heart | Vamsi’s Corner',
   eyebrow:'A PERSONAL WELCOME · LETTER NO. 01',
   title:'Some things are worth keeping.',
   quote:'Every meaningful beginning starts with a small, honest thought.',
   paragraphs:[
     'Welcome to my little corner of the internet — a quiet place for ideas, stories, things I build, and moments worth celebrating.',
     'I wanted this space to feel less like a feed and more like opening a familiar notebook. Come by whenever you like; there is always room for another thoughtful moment.'
   ],
   noteLabel:'FROM VAMSI’S HEART',
   note:'May we keep noticing the little things that make a day meaningful. Every small step belongs to the story.',
   actionUrl,actionLabel:'Step into the Corner'
 });
}
export const welcomePreviewFor = (name) => welcomeLetterFor({displayName:name});
const actions={
 'verify-email':{eyebrow:'YOUR PRIVATE CORNER · EMAIL VERIFICATION',title:'A place to begin.',
   quote:'Every little beginning deserves a moment of welcome.',
   paragraphs:['One quick step will make this space yours. Confirm your email address to activate your private Corner account.','This link can be used only once and expires after 30 minutes.'],
   actionLabel:'Verify my email',noteLabel:'A QUIET REMINDER',note:'If you did not request an account, no action is required.'},
 'reset-password':{eyebrow:'ACCOUNT SECURITY · PRIVATE LETTER',title:'A fresh start, simply.',
   quote:'A small reset can make room for a fresh beginning.',
   paragraphs:['We received a request to reset the password for your Corner account. Use the secure link below to choose a new password.','For your security, this link expires after 20 minutes and works only once.'],
   actionLabel:'Reset my password',noteLabel:'A QUIET REMINDER',note:'If you did not request this reset, you can safely ignore this message.'},
 'confirm-email':{eyebrow:'YOUR ACCOUNT · EMAIL UPDATE',title:'One detail, kept safe.',
   quote:'Even small changes deserve a little care.',
   paragraphs:['Confirm your new email address to complete your Corner account update.','This one-time verification link expires after 20 minutes.'],
   actionLabel:'Confirm new email',noteLabel:'A QUIET REMINDER',note:'If this was not your request, leave the link unopened and contact us.'},
 'admin/register':{eyebrow:'PRIVATE STUDIO · INVITATION',title:'A seat at the studio.',
   quote:'The best things are built with people we trust.',
   paragraphs:['You have been invited to help care for Vamsi’s Corner. This invitation is personal and single-use.','Accept it within 48 hours. Studio access also requires an authenticator.'],
   actionLabel:'Accept studio invitation',noteLabel:'A PERSONAL NOTE',note:'Thank you for bringing care and attention to the little details.'}
};
export function transactionalCornerEmail({subject,recipientName='there',actionUrl,flow}){
 return renderCornerLetter({kind:'security',subject,recipientName,actionUrl,...(actions[flow]||actions['verify-email'])});
}
