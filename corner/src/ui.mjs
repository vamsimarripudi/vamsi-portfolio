import {studioSidebar} from './studio-ui.mjs';
import { config } from './config.mjs';
import {seriesStoryBody,seriesChapterPrelude,seriesChapterFooter,seriesHubContent,getChapterTitle,journalSeriesUrl} from './journal-series-ui.mjs';
import { typeLabels, CATEGORIES, REACTIONS, statuses, now } from './domain.mjs';
export function escapeHtml(value=''){return String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;')}
const e=escapeHtml;
const dateLabel=(value)=>value?new Intl.DateTimeFormat('en-US',{dateStyle:'medium',timeZone:config.timezone}).format(new Date(value)):'';
const icon=(name)=>({arrow:'↗',right:'→',down:'↓',more:'···',search:'⌕',plus:'＋',close:'×'}[name]||name);
export const samples=()=>[
 {id:'sample-1',slug:'sample-a-small-new-beginning',type:'announcement',title:'A small new beginning.',excerpt:'A quiet space for what matters next.',body:'A place to collect short updates, ideas, and good things worth remembering. This is illustrative sample copy for local preview only.',emoji:'✳',published_at:new Date(Date.now()-2*3600000).toISOString(),featured:true,pinned:false,allow_comments:true,allow_reactions:true,version:1,tags:['Sample','Corner'],demo:true},
 {id:'sample-2',slug:'sample-here-is-to-good-news',type:'wish',title:'Here’s to good news. ✨',excerpt:'For the little wins, and all the ones still coming.',body:'A short example wish. Scheduling will automatically publi���q�^