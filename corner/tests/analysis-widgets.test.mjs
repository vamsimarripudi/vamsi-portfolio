import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const file=name=>readFileSync(new URL('../public/'+name,import.meta.url),'utf8');
const scope={window:{}};runInNewContext(file('analysis-widgets.js'),scope);
const {cards,ring,topPages}=scope.window.CornerAnalyticsWidgets;

test('device/source donuts use complete counts only, never reconstruct a suppressed percentage',()=>{
 const full=ring([{label:'Mobile',value:5},{label:'Desktop',value:15}],'Devices');assert.match(full,/25\.0%/);assert.match(full,/75\.0%/);assert.match(full,/conic-gradient/);
 const hidden=ring([{label:'Mobile',value:null},{label:'Desktop',value:15}],'Devices');assert.doesNotMatch(hidden,/conic-gradient|100\.0%/);assert.match(hidden,/percentages are not calculated/);
 assert.doesNotMatch(ring([{label:'Mobile',value:0}],'Devices'),/conic-gradient/);
 assert.doesNotMatch(ring([{label:'<img src=x onerror=alert(1)>',value:5}],'Devices'),/<img/);
});
test('summary uses supplied metrics and never invents people, engagement or averages',()=>{
 const report={metrics:[],exploration:{totals:{visits:40,stories:30,medianSeconds:20,completion:{value:null}}}};
 const html=cards(report);assert.match(html,/40/);assert.match(html,/30/);assert.match(html,/0m 20s/);assert.match(html,/Reading rate/);assert.match(html,/Not unique people/);assert.doesNotMatch(html,/0\.0%|Avg\.|Engagement|Alex|Sneha/);
 assert.match(topPages({exploration:{content:[]}}),/No published story meets/);
 const content=topPages({exploration:{content:[{title:'<script>unsafe</script>',visits:5}]}});assert.doesNotMatch(content,/<script>/);assert.match(content,/&lt;script&gt;/);
});
test('popups have accessible icon names, native modality, Escape/focus restoration and no new data collection',()=>{
 const js=file('analysis-widgets.js'),css=file('analysis-widgets.css');
 assert.match(js,/aria-haspopup="dialog"/);assert.match(js,/aria-controls="au-popup"/);assert.match(js,/popup\.showModal\(\)/);assert.match(js,/aria-labelledby','au-popup-title'/);assert.match(js,/opener\.focus/);assert.match(js,/listeners\.abort\(\)/);
 assert.doesNotMatch(js,/fetch\(|sendBeacon|gtag\(|localStorage\.setItem/);
 assert.match(js,/No named-visitor leaderboard/);assert.match(js,/data-sources/);
 assert.match(css,/min-height:44px/);assert.match(css,/prefers-reduced-motion:reduce/);assert.match(css,/max-height:calc\(100dvh - 24px\)/);
 assert.ok(Buffer.byteLength(js)<16000);assert.ok(Buffer.byteLength(css)<15000);
});
test('top-level analytics removes Google shortcut, preserves existing report lifecycle, scopes the approved dark rail',()=>{
 const ui=file('analysis-explore.js'),css=file('analysis-widgets.css');
 assert.doesNotMatch(ui,/<a class="ax-google"/);assert.match(ui,/widgets\.isOpen\(\)/);assert.match(ui,/widgets\.destroy\(\)/);
 assert.match(css,/\[data-analytics-look\] \.admin-sidebar/);assert.doesNotMatch(css,/^\.admin-sidebar\{/m);
});
