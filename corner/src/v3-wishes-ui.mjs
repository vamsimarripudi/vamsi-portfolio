import {basePage,header,footer,escapeHtml} from './ui.mjs';
const e=escapeHtml;
const item=(p,deliveryAvailable=false)=>'<article class="v3w-item"><div><span class="v3w-state">'+e(p.state)+'</span><h3>'+e(p.title)+'</h3><small>'+e(p.scheduled_at||p.published_at||'Not scheduled')+'</small></div><div class="v3w-item-actions">'+
 '<button type="button" data-v3w-edit="'+e(JSON.stringify(p))+'" aria-label="Edit '+e(p.title)+'">Edit</button>'+
 '<button type="button" data-v3w-duplicate="'+e(p.id)+'">Copy</button>'+
 (p.state==='draft'||p.state==='scheduled'?'<button type="button" data-v3w-publish="'+e(p.id)+'">Publish</button>':'')+
 (p.state==='published'&&deliveryAvailable?'<button type="button" data-v3w-notify="'+e(p.id)+'">Notify opt-ins</button>':'')+
 (p.state!=='archived'?'<button type="button" data-v3w-archive="'+e(p.id)+'">Archive</button>':'')+'</div></article>';
export function wishesStudioPage(wishes,actor,delivery=null){
 wishes.requireOwner(actor);
 const deliveryAvailable=!!delivery?.enabled(),records=wishes.list(actor),drafts=records.filter(p=>p.state==='draft').length;
 const scheduled=records.filter(p=>p.state==='scheduled').length;
 const live=records.filter(p=>p.state==='published').length;
 const editor='<form class="v3w-form" data-v3w-form><h2>Compose a wish</h2>'+
  '<input type="hidden" name="id" value=""><input type="hidden" name="version" value="">'+
  '<label>Title<input name="title" required maxlength="140" minlength="2" placeholder="A little moment to celebrate"></label>'+
  '<label>Wish<textarea name="body" required minlength="3" maxlength="5000" rows="6" placeholder="A personal, thoughtful note"></textarea></label>'+
  '<label>Short summary<textarea name="excerpt" maxlength="300" rows="2" placeholder="One quiet sentence"></textarea></label>'+
  '<div class="v3w-pair"><label>Symbol<input name="emoji" maxlength="8" value="✳"></label>'+
  '<label>Time zone<input name="timezone" value="Asia/Kolkata" required></label></div>'+
  '<label class="v3w-check"><input type="checkbox" name="upcomingPublic">Show a teaser before publication</label>'+
  '<div class="v3w-actions"><button type="submit">Save draft ↗</button>'+
  '<button type="button" data-v3w-preview>Preview</button><button type="button" data-v3w-new>New</button></div>'+
  '<p class="v3w-feedback" role="status" aria-live="polite"></p></form>';
 const schedule='<form class="v3w-form" data-v3w-schedule><h2>Schedule</h2>'+
  '<p class="v3w-muted">Save a draft before scheduling. Times follow your chosen time zone.</p>'+
  '<label>Publish on<input type="datetime-local" name="localTime" required></label>'+
  '<label>Repeat<select name="recurrence"><option value="none">Once</option><option value="yearly">Every year</option></select></label>'+
  '<label>Final repeat year (optional)<input name="recurrenceEndYear" inputmode="numeric" pattern="[0-9]{4}" maxlength="4"></label>'+
  '<button type="submit">Schedule wish ↗</button><p role="status" aria-live="polite" class="v3w-feedback"></p></form>';
 const preview='<section class="v3w-panel v3w-preview" aria-label="Private wish preview"><span class="v3w-overline">PRIVATE PREVIEW</span>'+
  '<span data-v3w-emoji class="v3w-star" aria-hidden="true">✳</span><h2 data-v3w-title>A little space for a good wish.</h2>'+
  '<p data-v3w-excerpt></p><p data-v3w-body class="v3w-preview-body"></p>'+
  '<small>No preview or draft sends email. Publication is an explicit owner action.</small></section>';
 const list='<section class="v3w-panel"><div class="v3w-section-title"><div><span class="v3w-overline">EDITORIAL WORKFLOW</span>'+
  '<h2>Wish library</h2></div><span>'+records.length+' total</span></div>'+
  (records.length?records.map(p=>item(p,deliveryAvailable)).join(''):'<div class="v3w-empty"><span aria-hidden="true">✳</span><p>No wishes yet. Save your first draft.</p></div>')+'</section>';
 const body=header()+'<main id="content" class="shell v3w-page" data-wish-studio>'+
  '<a href="/admin" class="v3w-back">← Studio</a><div class="v3w-heading"><span class="v3w-overline">THE CORNER / PRIVATE STUDIO</span>'+
  '<h1>Wishes<span>.</span></h1><p>Write with intention. Schedule quietly. Publish when ready.</p></div>'+
  '<div class="v3w-statline"><span>'+drafts+' drafts</span><span>'+scheduled+' scheduled</span><span>'+live+' published</span><span>'+(deliveryAvailable?'OPT-IN MAIL READY':'EMAIL UPDATES OFF')+'</span></div>'+
  '<div class="v3w-grid"><div>'+editor+schedule+'</div>'+preview+'</div>'+list+'</main>'+footer();
 return basePage({title:'Wishes Studio',path:'/admin/v3/wishes',content:body,noindex:true,initial:{page:'wishes'}});
}
