import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('all private Track sections share one stable shell',()=>{
 const track=source('src/Track.jsx');
 const css=source('src/TrackUnified.css');
 assert.match(track,/className="track-site-shell track-unified-shell"/);
 assert.doesNotMatch(track,/className=\{!location\.pathname\.startsWith\('\/track\/enquiries'\)/);
 for(const path of ['/track','/track/enquiries','/track/ev-surveys'])
   assert.ok(track.includes(path),'preserve existing route '+path);
 assert.match(track,/import '\.\/TrackUnified\.css'/);
 assert.match(css,/#root \.track-unified-shell \.track-workspace-nav/);
 assert.match(css,/#root \.track-unified-shell \.track-page\.evst-page/);
 assert.match(css,/@media\(max-width:767px\)/);
 assert.match(css,/\.ws-metrics article/);
});

test('website measurement remains opt-in and report never fabricates visitor counts',()=>{
 const script=source('public/website-analytics.js');
 const style=source('public/website-analytics.css');
 const report=source('src/WebsiteAnalytics.jsx');
 const backend=source('server/site-analytics-handler.js');
 assert.match(script,/function choicePrompt\(\)/);
 assert.match(script,/data-consent-allow/);
 assert.match(script,/data-consent-deny/);
 assert.match(script,/CONSENT_COOKIE\]\s*===\s*'allow'/);
 assert.match(script,/if\(!permitted\(\)/);
 assert.match(script,/catch\{journey=null/);
 assert.match(style,/\.website-analytics-consent/);
 assert.match(report,/report\.quality\.collectionEnabled/);
 assert.match(report,/report\.quality\.hasData/);
 assert.match(report,/No accepted observations in this selection/);
 assert.match(backend,/cookies\[CONSENT_COOKIE\]!=='allow'/);
 assert.match(backend,/cookies\.vm_track_session/);
 assert.match(backend,/req\.headers\.dnt==='1'/);
});
