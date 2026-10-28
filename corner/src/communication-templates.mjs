/**
 * Vamsi's Corner / Domain-aligned email design system v2.
 *
 * Pure templates only. No network, no subscriber lookup, no automatic sending.
 * The existing permissioned and consent-aware communication worker decides when
 * a rendered email may be queued. All source text is HTML-escaped and all
 * first-party destinations are validated.
 *
 * Deliberately matches the website: VM. identity, warm ivory paper, ink-black
 * controls, terracotta rules, quiet editorial serif, small uppercase overlines.
 * Categories use different compositions, never unrelated brand palettes.
 */
export const TEMPLATE_VERSION = 'corner-communications-2.0-domain-aligned';
export const CORNER_URL = 'https://vamsimarripudi.me/corner';
export const BRAND_MARK_URL = CORNER_URL + '/email-vm-mark.png';
export const CATEGORIES = Object.freeze(['Latest','Wishes','Builds','Notes','Journal','Moments']);
const FONT='Arial,Helvetica,sans-serif';
const SERIF='Georgia,Times New Roman,serif';
const MONO='Courier New,Courier,monospace';
const P=Object.freeze({
 background:'#F8F6F3',white:'#FFFFFF',paper:'#F4F0EC',ink:'#211F20',
 muted:'#706961',copper:'#B86F55',border:'#E6DFD8',soft:'#FDFBF9',
 dark:'#201D1F',edge:'#D9D0C9',contrast:'#47352E'
});
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const plain=(v,n=260)=>String(v??'').replace(/[\x00-\x1f\x7f]/g,' ').replace(/\s+/g,' ').trim().slice(0,n);
const storyMeta=Object.freeze({
 Latest:{accent:'#B86F55',soft:'#F3E9E2',code:'01',tag:'THE LATEST FROM HERE',headline:'The Corner Dispatch',symbol:'✳',mode:'latest'},
 Wishes:{accent:'#B97A68',soft:'#F9EEEA',code:'02',tag:'GOOD THINGS WORTH CELEBRATING',headline:'A Little Wish',symbol:'♡',mode:'wishes'},
 Builds:{accent:'#976853',soft:'#F4EEE9',code:'03',tag:'THINGS I AM BUILDING',headline:'The Build Log',symbol:'↗',mode:'builds'},
 Notes:{accent:'#AA775D',soft:'#F8F0E8',code:'04',tag:'IDEAS WORTH REMEMBERING',headline:'Field Notes',symbol:'✎',mode:'notes'},
 Journal:{accent:'#836A5D',soft:'#F4F1ED',code:'05',tag:'NOTES FROM THE IN-BETWEEN',headline:'The Journal',symbol:'“',mode:'journal'},
 Moments:{accent:'#C4876B',soft:'#F7ECE5',code:'06',tag:'SCENES AND LITTLE MEMORIES',headline:'A Moment',symbol:'▧',mode:'moments'}
});
export const CATEGORY_THEMES=storyMeta;
export const templateCatalog=()=>[
 ...CATEGORIES.map(category=>({id:'post-'+category.toLowerCase(),category,kind:'story',label:category+' story alert',purpose:'Explicitly opted-in '+category+' subscribers'})),
 ...CATEGORIES.map(category=>({id:'update-'+category.toLowerCase(),category,kind:'update',label:category+' editorial update',purpose:'Manually reviewed substantive post changes for verified subscribers'})),
 {id:'weekly-dispatch',kind:'digest',label:'Weekly Corner Dispatch',purpose:'Verified subscribers who selected weekly delivery'},
 {id:'comment-moderation',kind:'moderation',label:'Comment awaiting review',purpose:'Private owner alert; never a marketing campaign'},
 {id:'comment-approved',kind:'moderation',label:'Comment approved',purpose:'Only to the comment author when contact and permission exist'},
 {id:'account-welcome',kind:'account',label:'Welcome letter',purpose:'One-time account service message'},
 {id:'newsletter-confirm',kind:'consent',label:'Confirm subscription',purpose:'Double opt-in verification'},
 {id:'newsletter-goodbye',kind:'consent',label:'Subscription ended',purpose:'One-time consent change confirmation'},
 {id:'security',kind:'account',label:'Account security',purpose:'Password, verification and other requested account actions'},
 {id:'operations',kind:'operations',label:'Operations digest',purpose:'Private owner-only summary; no identifiable readers'}
];
function checkedLink(value){
 const url=new URL(String(value||''),CORNER_URL+'/');
 if(url.protocol!=='https:' && !(url.protocol==='http:' && ['localhost','127.0.0.1'].includes(url.hostname)))throw Error('Email links must use HTTPS');
 if(url.hostname!=='vamsimarripudi.me' && !['localhost','127.0.0.1'].includes(url.hostname))throw Error('Links must point to the Corner site');
 if(!url.pathname.startsWith('/corner'))throw Error('Email links must stay inside the Corner site');
 return url.href;
}
function entry(post){
 if(!post||typeof post!=='object')throw Error('A real published post is required');
 const title=plain(post.title,155),excerpt=plain(post.excerpt||post.body,470);
 if(!title)throw Error('Post title is required');
 if(post.state && post.state!=='published')throw Error('Draft or archived posts cannot be emailed');
 const category=CATEGORIES.includes(post.category)?post.category:'Latest';
 const slug=String(post.slug||'');
 if(!/^[a-z0-9][a-z0-9-]{0,150}$/i.test(slug))throw Error('Invalid post slug');
 const date=post.published_at?new Date(post.published_at):null;
 const published=date&&Number.isFinite(date.getTime())?new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',day:'numeric',month:'short',year:'numeric'}).format(date):null;
 return {title,excerpt,category,published,url:checkedLink(CORNER_URL+'/post/'+encodeURIComponent(slug))};
}
function start(subject,preheader){
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(subject)}</title>
 <style type="text/css">
 @media only screen and (max-width:620px){
 .outer-pad{padding:12px 9px!important}.email-body{padding:27px 24px!important}
 .hero-headline{font-size:36px!important;line-height:1.17!important}
 .service-headline{font-size:36px!important}.email-foot{padding:25px 23px!important}
 .email-brand{font-size:17px!important}.desktop-meta{display:none!important}
 .mobile-stack{display:block!important;width:100%!important}.mobile-stack-pad{padding:16px 0 0!important}
 .email-stamp{font-size:12px!important}.digest-number{width:39px!important;font-size:24px!important}
 }
 @media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
 </style></head>
 <body style="margin:0;padding:0;width:100%;background:${P.background};color:${P.ink};font-family:${FONT};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%">
 <div style="display:none!important;visibility:hidden;mso-hide:all;max-height:0;max-width:0;opacity:0;overflow:hidden;color:transparent;font-size:1px;line-height:1px">${esc(plain(preheader,150))}</div>
 <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${P.background}" style="border-collapse:collapse;background:${P.background}"><tr><td class="outer-pad" align="center" style="padding:29px 14px 38px">
 <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;border-collapse:separate;border-spacing:0">
 <tr><td style="padding:9px 3px 20px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
 <td width="50" style="width:50px;vertical-align:middle"><a href="${esc(CORNER_URL)}" style="text-decoration:none;color:${P.ink}" aria-label="Vamsi's Corner"><img src="${esc(BRAND_MARK_URL)}" alt="VM." width="46" height="46" border="0" style="display:block;width:46px;height:46px;border-radius:12px;border:0;outline:none;line-height:46px;font-size:14px;font-weight:800;color:${P.ink}"></a></td>
 <td style="padding-left:9px;vertical-align:middle"><a href="${esc(CORNER_URL)}" style="text-decoration:none;color:${P.ink}"><strong class="email-brand" style="font-family:${FONT};font-size:18px;font-weight:800;letter-spacing:-.7px;line-height:1.25;color:${P.ink}">Vamsi’s Corner<span style="color:${P.copper}">.</span></strong></a><div style="font-family:${MONO};font-size:9px;font-weight:700;letter-spacing:1.15px;line-height:1.8;color:${P.muted}">NOTES FROM THE IN-BETWEEN</div></td>
 <td class="desktop-meta" align="right" style="vertical-align:middle;font-family:${MONO};font-weight:700;font-size:9px;letter-spacing:1.1px;line-height:1.5;color:${P.muted}">PERSONAL / EST. 2026</td>
 </tr></table></td></tr>
 <tr><td style="height:2px;background:${P.copper};font-size:1px;line-height:2px" height="2" bgcolor="${P.copper}">&nbsp;</td></tr>`;
}
function finish({marketing=false,unsubscribeUrl,preferencesUrl,reason='An account message you requested.'}={}){
 if(marketing&&!unsubscribeUrl)throw Error('Marketing templates require a working unsubscribe URL');
 const u=unsubscribeUrl?checkedLink(unsubscribeUrl):null;
 const p=preferencesUrl?checkedLink(preferencesUrl):null;
 return `<tr><td class="email-foot" bgcolor="${P.paper}" style="padding:29px 37px 25px;background:${P.paper};border:1px solid ${P.border};border-top:0;border-radius:0 0 19px 19px">
 <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="font-family:${SERIF};font-style:italic;font-size:20px;line-height:1.5;color:${P.ink}">A little space for things worth keeping<span style="color:${P.copper}">.</span></td></tr><tr><td style="padding-top:5px;font-family:${FONT};font-size:12px;font-weight:700;color:${P.ink}">— Vamsi</td></tr></table>
 <div style="height:1px;margin:21px 0 17px;background:${P.edge};font-size:1px;line-height:1px">&nbsp;</div>
 <p style="margin:0;color:${P.muted};font-family:${FONT};font-size:11px;line-height:1.75">${esc(reason)}</p>
 <p style="margin:11px 0 0;color:${P.ink};font-family:${FONT};font-size:12px;line-height:2.05">
 <a style="color:${P.ink};text-decoration:underline" href="${esc(CORNER_URL)}">Visit the Corner</a>
 ${p?`&nbsp; · &nbsp;<a style="color:${P.ink};text-decoration:underline" href="${esc(p)}">Preferences</a>`:''}
 ${u?`&nbsp; · &nbsp;<a style="color:${P.ink};text-decoration:underline" href="${esc(u)}">Unsubscribe</a>`:''}
 &nbsp; · &nbsp;<a style="color:${P.ink};text-decoration:underline" href="mailto:connect@vamsimarripudi.me">Say hello</a></p>
 </td></tr><tr><td style="padding:17px 16px 0;text-align:center;font-family:${FONT};font-size:10px;line-height:1.6;color:${P.muted}">vamsimarripudi.me/corner &nbsp; · &nbsp; © ${new Date().getUTCFullYear()} Vamsi Marripudi</td></tr>
 </table></td></tr></table></body></html>`;
}
function button(url,label){
 const href=checkedLink(url);
 return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="${P.dark}" style="background:${P.dark};border-radius:12px"><a href="${esc(href)}" style="display:inline-block;padding:15px 23px;text-decoration:none;font-family:${FONT};font-size:13px;font-weight:700;line-height:1.4;color:#FFFFFF">${esc(label)} &nbsp; ↗</a></td></tr></table>`;
}
function intro(category,{update=false,published}={}){
 const t=storyMeta[category];
 return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="font-family:${MONO};font-size:10px;font-weight:700;letter-spacing:1.1px;line-height:1.8;color:${P.copper}">${esc(update?'STORY UPDATE / '+category.toUpperCase():t.tag)}</td><td align="right" style="font-family:${MONO};font-size:10px;letter-spacing:1.2px;color:${P.muted}">${esc(t.code)} / 06</td></tr></table><div style="height:1px;background:${P.border};margin:17px 0 23px;font-size:1px;line-height:1px">&nbsp;</div>`;
}
function motif(p,category,{imageUrl=null}={}){
 const t=storyMeta[category];
 if(category==='Latest')return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${t.soft}" style="background:${t.soft};margin:0 0 23px;border-left:3px solid ${P.copper}"><tr><td style="padding:21px 22px"><div style="font-family:${MONO};font-size:10px;font-weight:700;letter-spacing:1.3px;color:${P.muted}">FROM THE NOTEBOOK</div><p style="font-family:${SERIF};font-size:22px;line-height:1.4;letter-spacing:-.4px;margin:9px 0 0;color:${P.ink}">A little of everything, one story at a time.</p></td></tr></table>`;
 if(category==='Wishes')return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${t.soft}" style="background:${t.soft};margin:0 0 22px;border:1px solid ${P.border};border-radius:17px"><tr><td align="center" style="padding:22px 26px 26px"><div style="font-family:${SERIF};font-size:42px;line-height:1.25;color:${P.copper}">♡</div><div style="font-family:${SERIF};font-size:20px;font-style:italic;line-height:1.5;color:${P.ink}">Good things are worth celebrating.</div><div style="width:52px;height:1px;margin:17px auto 0;background:${P.copper};font-size:1px">&nbsp;</div></td></tr></table>`;
 if(category==='Builds')return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 22px;border:1px solid ${P.border};background:#F9F7F4"><tr><td style="padding:19px 21px"><div style="font-family:${MONO};font-size:10px;font-weight:bold;letter-spacing:1px;color:${P.copper}">BUILD / NOTES FROM THE WORKBENCH</div><div style="font-family:${MONO};font-size:19px;line-height:1.3;color:${P.dark};margin:12px 0 10px">[ &nbsp;IDEA&nbsp; → &nbsp;BUILD&nbsp; → &nbsp;LEARN&nbsp; ]</div><div style="height:1px;background:${P.edge}"></div><div style="font-size:12px;line-height:1.6;color:${P.muted};margin-top:12px">Progress, experiments and the details behind them.</div></td></tr></table>`;
 if(category==='Notes')return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${t.soft}" style="margin:0 0 22px;background:${t.soft};border:1px solid ${P.border}"><tr><td style="width:24px;border-right:2px solid ${P.copper}" width="24">&nbsp;</td><td style="padding:19px 23px"><div style="font-family:${MONO};font-size:10px;letter-spacing:1.4px;font-weight:700;color:${P.copper}">FIELD NOTE / ${esc(t.code)}</div><div style="font-family:${SERIF};font-size:23px;line-height:1.4;margin:11px 0 14px;color:${P.ink}">One thought worth keeping.</div><div style="height:1px;background:${P.edge}"></div><div style="height:1px;background:${P.edge};margin-top:11px"></div></td></tr></table>`;
 if(category==='Journal')return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 22px;background:${t.soft};border-top:1px solid ${P.copper};border-bottom:1px solid ${P.edge}"><tr><td style="padding:27px 22px"><div style="font-family:${SERIF};font-size:23px;line-height:1.35;font-style:italic;color:${P.ink}">A letter from the in-between.</div><p style="margin:14px 0 0;font-family:${SERIF};font-size:16px;line-height:1.65;color:${P.muted}">${esc(p.excerpt||'Some moments deserve a little reflection.')}</p></td></tr></table>`;
 const src=imageUrl?checkedLink(imageUrl):null;
 return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${t.soft}" style="margin:0 0 22px;background:${t.soft};border:11px solid ${P.paper};outline:1px solid ${P.edge}"><tr><td align="center" style="padding:${src?'0':'31px 12px'};text-align:center">${src?`<img width="495" alt="Photograph accompanying: ${esc(p.title)}" src="${esc(src)}" style="display:block;width:100%;max-width:495px;height:auto;object-fit:contain;border:0">`:`<div style="font-family:${SERIF};font-size:56px;line-height:1;color:${P.copper}">✧</div><div style="font-family:${MONO};font-size:10px;letter-spacing:1.1px;color:${P.muted};margin-top:15px">ONE FRAME / ONE MEMORY</div>`}</td></tr></table>`;
}
function result({subject,preheader,html,text,kind,category,marketing=false,unsubscribeUrl}){
 const recommendedHeaders=marketing?{'List-ID':'Vamsis Corner Updates <vamsimarripudi.me>'}:{};
 // Existing unsubscribe links use a fragment token. Do not advertise them as
 // RFC 8058 one-click HTTP endpoints: the fragment is never sent over HTTP.
 if(marketing&&unsubscribeUrl&&!new URL(checkedLink(unsubscribeUrl)).hash)recommendedHeaders['List-Unsubscribe']='<'+checkedLink(unsubscribeUrl)+'>';
 return {templateVersion:TEMPLATE_VERSION,kind,category,subject:plain(subject,180),preheader:plain(preheader,160),html,text:String(text),marketing,...(marketing?{recommendedHeaders}:{})};
}
export function renderStoryAlert({post,category,recipientName='reader',unsubscribeUrl,preferencesUrl,update=false,coverImageUrl=null}={}){
 const p=entry(post),cat=category||p.category;
 if(!CATEGORIES.includes(cat))throw Error('Unknown category');
 if(!unsubscribeUrl)throw Error('Marketing templates require a working unsubscribe URL');
 const t=storyMeta[cat];
 const subject=update?'Story updated · '+p.title:(cat==='Latest'?'New at the Corner: '+p.title:({Wishes:'A little wish: ',Builds:'New build: ',Notes:'A new note: ',Journal:'Journal letter: ',Moments:'A moment to keep: '}[cat]+p.title));
 const preheader=update?'A published Corner story was updated. '+p.excerpt:(p.excerpt||'A new story is ready to read.');
 const greeting=esc(plain(recipientName,64)||'reader');
 const html=start(subject,preheader)+`<tr><td bgcolor="${P.white}" style="background:${P.white};border-left:1px solid ${P.border};border-right:1px solid ${P.border};border-radius:19px 19px 0 0"><div class="email-body" style="padding:34px 38px 35px">
 ${intro(cat,{update,published:p.published})}
 <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="vertical-align:top"><h1 class="hero-headline" style="font-family:${SERIF};font-weight:400;font-size:45px;line-height:1.14;letter-spacing:-1.3px;margin:0 0 16px;color:${P.ink}">${esc(p.title)}</h1></td></tr></table>
 <div style="font-family:${MONO};font-size:10px;letter-spacing:.8px;line-height:1.7;color:${P.muted};margin-bottom:25px">${esc(cat.toUpperCase())}${p.published?' &nbsp; / &nbsp; '+esc(p.published):''}</div>
 <p style="font-family:${FONT};font-size:14px;line-height:1.75;color:${P.ink};margin:0 0 23px">Hello ${greeting},<br>${update?'This published story has a meaningful update for you.':'A new story has found its place in the Corner.'}</p>
 ${motif(p,cat,{imageUrl:coverImageUrl})}
 ${cat==='Journal'?'':`<p style="font-family:${FONT};font-size:15px;line-height:1.75;color:${P.ink};margin:0 0 27px">${esc(p.excerpt||'A little note from the Corner, ready when you are.')}</p>`}
 ${button(p.url,update?'Read the updated story':'Read the story')}
 </div></td></tr>${finish({marketing:true,unsubscribeUrl,preferencesUrl,reason:'You subscribed to '+cat+' updates from Vamsi’s Corner.'})}`;
 const text=[subject,'','Hello '+plain(recipientName,64)+',',update?'A published story has an important update.':'A new story is ready to read.',p.title,p.excerpt,p.url,'','You subscribed to '+cat+' updates.','Unsubscribe: '+checkedLink(unsubscribeUrl),preferencesUrl?'Preferences: '+checkedLink(preferencesUrl):''].filter(Boolean).join('\n');
 return result({subject,preheader,html,text,kind:update?'update':'story',category:cat,marketing:true,unsubscribeUrl});
}
export function renderWeeklyDigest({posts=[],recipientName='reader',unsubscribeUrl,preferencesUrl,weekLabel='This week'}={}){
 if(!Array.isArray(posts)||!posts.length||posts.length>8)throw Error('Digest requires one to eight published stories');
 if(!unsubscribeUrl)throw Error('Marketing templates require a working unsubscribe URL');
 const items=posts.map(entry),subject='The Corner Dispatch · '+plain(weekLabel,64);
 const preheader=items.length+' stories from the Corner, collected in one quiet letter.';
 const rows=items.map((p,i)=>{
  const t=storyMeta[p.category];
  return `<tr><td style="padding:21px 0;border-top:1px solid ${P.border}"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td width="43" class="digest-number" style="width:43px;vertical-align:top;font-family:${SERIF};font-size:29px;line-height:1.1;color:${P.copper}">${String(i+1).padStart(2,'0')}</td><td style="padding-left:11px;vertical-align:top"><div style="font-family:${MONO};font-size:10px;font-weight:700;letter-spacing:1px;color:${P.copper}">${esc(p.category.toUpperCase())}</div><h2 style="font-family:${SERIF};font-size:24px;font-weight:400;line-height:1.3;letter-spacing:-.4px;color:${P.ink};margin:8px 0 7px">${esc(p.title)}</h2><p style="font-family:${FONT};font-size:13px;line-height:1.7;color:${P.muted};margin:0 0 10px">${esc(p.excerpt)}</p><a style="font-family:${FONT};font-size:12px;font-weight:700;color:${P.ink};text-decoration:underline" href="${esc(p.url)}">Read story ↗</a></td></tr></table></td></tr>`;
 }).join('');
 const html=start(subject,preheader)+`<tr><td bgcolor="${P.white}" style="background:${P.white};border-left:1px solid ${P.border};border-right:1px solid ${P.border};border-radius:19px 19px 0 0"><div class="email-body" style="padding:36px 38px 38px">
 <div style="font-family:${MONO};font-size:10px;font-weight:700;letter-spacing:1.5px;color:${P.copper}">THE CORNER / WEEKLY LETTER</div>
 <h1 class="hero-headline" style="font-family:${SERIF};font-size:47px;font-weight:400;line-height:1.1;letter-spacing:-1.6px;color:${P.ink};margin:19px 0 12px">The Corner<br>Dispatch<span style="color:${P.copper}">.</span></h1>
 <p style="font-family:${MONO};font-size:11px;line-height:1.7;letter-spacing:.7px;color:${P.muted};margin:0 0 30px">${esc(plain(weekLabel,64))} &nbsp; / &nbsp; ${items.length} STORIES</p>
 <p style="font-family:${FONT};font-size:14px;line-height:1.78;color:${P.ink};margin:0 0 27px">Hello ${esc(plain(recipientName,64)||'reader')},<br>A few new notes, projects, wishes and moments—collected in one place. Read what interests you and leave the rest for another day.</p>
 <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${rows}</table>
 <div style="padding-top:24px">${button(CORNER_URL,'Visit Vamsi’s Corner')}</div>
 </div></td></tr>${finish({marketing:true,unsubscribeUrl,preferencesUrl,reason:'You opted in to the weekly Corner Dispatch.'})}`;
 const text=[subject,'','Hello '+plain(recipientName,64)+',','A few new Corner stories, in one letter.','',...items.flatMap((p,i)=>[(i+1)+'. '+p.category+' — '+p.title,p.excerpt,p.url,'']),'Unsubscribe: '+checkedLink(unsubscribeUrl),preferencesUrl?'Preferences: '+checkedLink(preferencesUrl):''].filter(Boolean).join('\n');
 return result({subject,preheader,html,text,kind:'digest',category:'Latest',marketing:true,unsubscribeUrl});
}
function serviceTemplate({kind,subject,headline,eyebrow,details=[],actionLabel,actionUrl,recipientName='there',reason,paragraph}={}){
 const preheader=paragraph||subject;
 const formatted=details.filter(Boolean).slice(0,7).map(line=>`<tr><td style="border-bottom:1px solid ${P.border};padding:12px 0;font-family:${FONT};font-size:13px;line-height:1.65;color:${P.ink}">${esc(plain(line,750))}</td></tr>`).join('');
 const html=start(subject,preheader)+`<tr><td bgcolor="${P.white}" style="background:${P.white};border-left:1px solid ${P.border};border-right:1px solid ${P.border};border-radius:19px 19px 0 0"><div class="email-body" style="padding:35px 38px 39px">
 <div style="font-family:${MONO};font-size:10px;font-weight:700;line-height:1.7;letter-spacing:1.3px;color:${P.copper}">${esc(eyebrow)}</div>
 <h1 class="service-headline" style="font-family:${SERIF};font-size:42px;font-weight:400;line-height:1.13;letter-spacing:-1px;margin:19px 0 26px;color:${P.ink}">${esc(headline)}</h1>
 <div style="height:2px;background:${P.copper};width:54px;font-size:1px;line-height:2px;margin-bottom:25px">&nbsp;</div>
 <p style="font-family:${FONT};font-size:14px;line-height:1.8;color:${P.ink};margin:0 0 23px">Hello ${esc(plain(recipientName,64)||'there')},<br>${esc(paragraph||'A small update from the Corner.')}</p>
 ${formatted?`<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 23px">${formatted}</table>`:''}
 ${actionUrl?button(actionUrl,actionLabel||'Open the Corner'):''}
 </div></td></tr>${finish({reason:reason||'This is an account-related communication, not a marketing newsletter.'})}`;
 const text=[subject,'','Hello '+plain(recipientName,64)+',',paragraph||'',...details,actionUrl?(actionLabel||'Open the Corner')+': '+checkedLink(actionUrl):'',reason||''].filter(Boolean).join('\n');
 return result({subject,preheader,html,text,kind,category:'Latest'});
}
export function renderAccountNotice({type='welcome',recipientName='there',actionUrl,expiresIn,customDetails=[]}={}){
 const flows={
 welcome:{subject:'A little hello from Vamsi’s Corner',headline:'Welcome to your Corner.',eyebrow:'YOUR PRIVATE CORNER / WELCOME',paragraph:'Your private account is ready. Published stories and your saved shelf are here whenever you need them.',actionLabel:'Visit your Corner'},
 verify:{subject:'Confirm your Corner email',headline:'One quick confirmation.',eyebrow:'ACCOUNT / VERIFY EMAIL',paragraph:'Confirm this email address to activate your private account.',actionLabel:'Verify my email'},
 reset:{subject:'Reset your Corner password',headline:'A secure fresh start.',eyebrow:'ACCOUNT / SECURITY',paragraph:'A password-reset request was received. This link is single-use; ignore the email if you did not request it.',actionLabel:'Reset password'},
 security:{subject:'A security update to your Corner account',headline:'Keeping things safe.',eyebrow:'ACCOUNT / SECURITY',paragraph:'This notice is about a change to your account. If you did not make it, contact us.',actionLabel:'Review your account'},
 email:{subject:'Confirm your updated email',headline:'One detail, verified.',eyebrow:'ACCOUNT / EMAIL CHANGE',paragraph:'Confirm your new address to finish updating your private profile.',actionLabel:'Confirm email'}
 };
 const a=flows[type];if(!a)throw Error('Unknown account message');
 return serviceTemplate({kind:'account',recipientName,actionUrl:actionUrl||CORNER_URL+'/profile',reason:'Account-related message; no newsletter subscription is required.',...a,details:[...(expiresIn?['Link expiration: '+plain(expiresIn,40)]:[]),...customDetails]});
}
export function renderSubscriptionNotice({type='confirm',actionUrl,recipientName='reader',category='Latest'}={}){
 if(!['confirm','unsubscribed'].includes(type))throw Error('Unknown subscription notice');
 if(type==='confirm'&&!actionUrl)throw Error('Verification link required');
 return serviceTemplate({kind:'consent',recipientName,subject:type==='confirm'?'Confirm your Corner updates':'Your Corner updates are off',headline:type==='confirm'?'Only if you say yes.':'Your choice is respected.',eyebrow:'YOUR CORNER / EMAIL PREFERENCES',paragraph:type==='confirm'?'You requested '+plain(category,45)+' updates. Confirm your address to start receiving them. Nothing sends until you verify.':'You have unsubscribed from Corner email updates. No more newsletters will be sent to this subscription.',actionLabel:'Confirm subscription',actionUrl:type==='confirm'?actionUrl:null,reason:'One-time subscription confirmation, not a promotional email.'});
}
export function renderModerationNotice({type='new',storyTitle,commenterName,commentExcerpt,actionUrl,recipientName='Vamsi'}={}){
 const isNew=type==='new';if(!['new','approved'].includes(type))throw Error('Unknown moderation notice');
 return serviceTemplate({kind:'moderation',recipientName,subject:isNew?'Comment awaiting review · Vamsi’s Corner':'Your Corner comment was approved',eyebrow:isNew?'PRIVATE STUDIO / MODERATION':'A LITTLE CONVERSATION',headline:isNew?'A new voice in the Corner.':'Your words are now part of the story.',paragraph:isNew?'A comment is waiting in your private moderation queue. It is not public until you approve it.':'Your comment has been approved and is now visible on the published story.',details:[storyTitle?'Story: '+plain(storyTitle,150):'',commenterName?'Name entered by commenter: '+plain(commenterName,65):'',commentExcerpt?'Comment: '+plain(commentExcerpt,410):''].filter(Boolean),actionUrl:actionUrl||CORNER_URL+'/admin',actionLabel:isNew?'Review comment':'View discussion',reason:isNew?'Private owner notice. The commenter’s display name is self-entered.':'A response to your own comment, not a newsletter.'});
}
export function renderOperationsReport({metrics={},recipientName='Vamsi',actionUrl=CORNER_URL+'/admin'}={}){
 const allowed={published:'Published stories',pendingComments:'Comments awaiting moderation',registered:'Registered members',verified:'Verified members',subscribers:'Verified subscriptions',queued:'Emails queued',failed:'Delivery failures',backup:'Backup health'};
 const details=Object.entries(allowed).filter(([key])=>Object.hasOwn(metrics,key)).map(([key,label])=>label+': '+plain(metrics[key],80));
 return serviceTemplate({kind:'operations',recipientName,subject:'Your Corner operations summary',headline:'A little clarity, in one place.',eyebrow:'PRIVATE STUDIO / OPERATIONS',paragraph:'Your aggregate Corner activity summary is ready. It does not identify individual readers.',details,actionUrl,actionLabel:'Open Studio',reason:'Private owner operational notice; no tracking URLs, raw IPs or browsing identities.'});
}
