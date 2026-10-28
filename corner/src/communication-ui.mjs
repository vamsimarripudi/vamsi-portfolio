import {basePage,escapeHtml} from './ui.mjs';
import {studioFrame} from './studio-ui.mjs';
import {CATEGORIES,CATEGORY_THEMES} from './communication-templates.mjs';
const e=escapeHtml;
export function communicationsPage(actor){
 if(actor?.role!=='owner')throw Object.assign(Error('Owner access required'),{code:'OWNER_REQUIRED',status:403});
 const categories=CATEGORIES.map(name=>'<span class="comm-category" style="--cat-accent:'+e(CATEGORY_THEMES[name].accent)+'" aria-label="'+e(name)+' template">'+e(CATEGORY_THEMES[name].symbol)+' &nbsp;'+e(name)+'</span>').join('');
 const page=`<main id="content" class="shell comm-page" data-communications>
 <header class="comm-hero"><a href="/admin" class="comm-back">← Studio</a><p class="comm-overline">VAMSI’S CORNER / PRIVATE COMMUNICATIONS</p><h1>Communication<span>.</span></h1><p>Know what happened. Decide what gets sent. Respect every reader’s choice.</p>
 <div class="comm-live" role="status" aria-live="polite" data-comm-state>Checking the private activity ledger…</div></header>
 <nav class="comm-subnav" aria-label="Communication sections"><a href="#comm-activity">Activity & logs</a><a href="#comm-members">Registered accounts</a><a href="#comm-campaigns">Email studio</a><a href="#comm-delivery">Delivery status</a></nav>
 <section class="comm-section" id="comm-activity"><div class="comm-head"><div><p class="comm-overline">READ-ONLY INTELLIGENCE</p><h2>Activity, not surveillance.</h2></div><button type="button" data-comm-refresh>Refresh activity ↻</button></div>
 <div class="comm-kpis" data-comm-kpis><p>Loading authentic counts…</p></div>
 <div class="comm-panels"><section class="comm-surface"><h3>Who commented</h3><p class="comm-muted">A displayed name is supplied by the commenter; it is not proof of identity.</p><div data-comm-comments><p>Loading comments…</p></div><a class="comm-link" href="/admin#comments">Open moderation queue ↗</a></section>
 <section class="comm-surface"><h3>What was read</h3><p class="comm-muted">Anonymous views are aggregate observations, not personal identities. Only consented reading data is counted.</p><div data-comm-views><p>Loading visits…</p></div></section></div>
 <section class="comm-surface"><h3>Application audit ledger</h3><p class="comm-muted">Recent recorded operations, not the complete Railway or Vercel HTTP log stream.</p><div class="comm-scroll" data-comm-audit>Loading audit events…</div></section></section>
 <section class="comm-section" id="comm-members"><div class="comm-head"><div><p class="comm-overline">VERIFIED PRIVATE ACCOUNTS</p><h2>Registered people.</h2></div><label class="comm-toggle"><input type="checkbox" data-comm-show-email> Show private email addresses</label></div><p class="comm-muted">Only authenticated owners can access these records. Showing the list does not subscribe anyone to emails.</p><div class="comm-surface comm-scroll" data-comm-members>Loading accounts…</div></section>
 <section class="comm-section" id="comm-campaigns"><p class="comm-overline">REUSABLE · CATEGORY-SPECIFIC</p><h2>The email studio.</h2><p class="comm-muted">Six independent visual identities, one shared trusted delivery path. Preview is private. New posts and editorial updates never send automatically; publication requires a separate consent-aware campaign.</p><div class="comm-categories">${categories}</div>
 <div class="comm-panels"><form class="comm-surface comm-compose" data-comm-form><h3>Prepare an update</h3>
 <label>Delivery format<select name="kind"><option value="story">New published story · instant subscribers</option><option value="update">Updated published story · instant subscribers</option><option value="digest">Weekly digest · weekly subscribers</option></select></label>
 <label>Category<select name="category">${CATEGORIES.map(name=>'<option value="'+e(name)+'">'+e(name)+'</option>').join('')}</select></label>
 <fieldset class="comm-story-picker"><legend>Published stories</legend><div data-comm-story-choices><p class="comm-muted">Loading published stories…</p></div></fieldset>
 <p class="comm-muted">Select one story for an instant update, or up to eight for a weekly digest. Only previously published content is available.</p>
 <div class="comm-actions"><button type="button" data-comm-preview>Preview · no email sent</button><button type="button" data-comm-queue disabled>Review recipients & queue</button></div>
 <p role="status" aria-live="polite" data-comm-form-state>No campaign is queued.</p></form>
 <div class="comm-surface comm-preview-panel"><div class="comm-preview-heading"><h3>Email preview</h3><span data-comm-preview-badge>PRIVATE PREVIEW</span></div><div class="comm-preview-empty" data-comm-preview-empty>Choose an existing published story and select Preview to see exactly what the recipient would receive.</div><iframe title="Private Corner email preview" sandbox="" data-comm-iframe hidden></iframe><small>Images and external content are intentionally absent. No email is transmitted during preview.</small></div></div></section>
 <section class="comm-section" id="comm-delivery"><div class="comm-head"><div><p class="comm-overline">TRUST & DELIVERABILITY</p><h2>Delivery history.</h2></div></div>
 <div class="comm-surface" data-comm-delivery>Checking the outbox…</div><p class="comm-muted">Sent means accepted by the configured sender, not necessarily delivered. Delivery/complaint/bounce states require verified provider callbacks. Every campaign needs active double opt-in consent and explicit owner confirmation. Unsubscribe and suppression are rechecked before each send.</p>
 </section></main>`;
 return basePage({title:'Communications Studio',path:'/admin/communications',content:studioFrame(actor,'communications',page),initial:{page:'communications'},noindex:true});
}
