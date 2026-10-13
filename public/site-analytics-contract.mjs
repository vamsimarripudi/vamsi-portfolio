/** Public website measurement allowlist. Never accept arbitrary URLs or personal route IDs. */
export const WEBSITE = 'vamsimarripudi.me';
export const CONSENT_COOKIE = 'vm_site_analytics';
export const SITE_PAGES = Object.freeze({
 '/':'Home','/now':'Now','/work':'Work','/engineering':'Engineering','/lab':'Lab','/writing':'Writing','/journey':'About','/resume':'Resume','/uses':'Uses','/contact':'Contact','/faq':'FAQ','/changelog':'Changelog','/privacy':'Privacy','/terms':'Terms',
 '/work/event-management':'Event Management','/work/nxtwatch':'Nxtwatch','/work/jobby-app':'Jobby App','/work/backend-twitter-clone-db':'Backend Twitter Clone DB','/work/multistep-form':'Multistep Form','/work/quiz-game':'Quiz Game',
 '/writing/building-for-changing-context':'Building for changing context','/writing/auth-as-product-infrastructure':'Authentication as product infrastructure',
 '/corner':'Corner','/corner/post/:story':'Corner stories','/corner/category/:category':'Corner categories','/corner/memories':'Corner memories','/corner/wishes':'Corner wishes'
});
export const SECTIONS = ['main','hero','now','work','engineering','writing','contact','footer'];
export const ACTIONS = ['', 'contact_start', 'contact_success', 'contact_failed', 'resume_click', 'profile_click'];
export const SOURCES = ['direct','internal','search','social','referral'];
export function websitePath(value) {
 if(typeof value!=='string'||value.length>400||value.includes('?')||value.includes('#')||value.includes('%')||value.includes('\\'))return null;
 const p=value==='/'?'/':value.replace(/\/$/,'');
 if(Object.hasOwn(SITE_PAGES,p)&&!p.includes(':'))return p;
 if(/^\/corner\/post\/[a-z0-9][a-z0-9-]{0,159}$/.test(p))return '/corner/post/:story';
 if(/^\/corner\/category\/(wishes|builds|notes|journal|moments)$/.test(p))return '/corner/category/:category';
 return null;
}
export function validateWebsiteSignal(body) {
 if(!body||typeof body!=='object'||Array.isArray(body))throw Error('Invalid website event.');
 const keys=['v','view','journey','path','device','source','depth','activeMs','section','action','issue'];
 if(Object.keys(body).some(k=>!keys.includes(k)))throw Error('Unsupported website event fields.');
 const p={section:'main',action:'',issue:'',...body};
 if(p.v!==1||typeof p.view!=='string'||!/^[a-f0-9]{32}$/.test(p.view)||typeof p.journey!=='string'||!/^[a-f0-9]{32}$/.test(p.journey)||typeof p.path!=='string'||!Object.hasOwn(SITE_PAGES,p.path)||!['mobile','tablet','desktop'].includes(p.device)||!SOURCES.includes(p.source)||![0,25,50,75,90].includes(p.depth)||!Number.isSafeInteger(p.activeMs)||p.activeMs<0||p.activeMs>1800000||!SECTIONS.includes(p.section)||!ACTIONS.includes(p.action)||!['','request_failed','media_failed'].includes(p.issue))throw Error('Invalid website event.');
 if(p.action.startsWith('contact_')&&p.path!=='/contact')throw Error('Contact events require the contact page.');
 return p;
}
