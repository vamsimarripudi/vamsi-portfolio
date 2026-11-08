import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {validTrackPf3Envelope,validPf3Finance,verifyTrackPf3Envelope} from '../server/pf3-track-handler.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const body={eventId:'fdd59eb1-b109-4661-bb0a-ced88b14dbef',eventType:'message.drafted',role:'freelancer',
 workspaceRef:'a'.repeat(24),occurredAt:'2026-11-08T08:00:00.000Z',schemaVersion:1,source:'pakkafollow'};
const secret='s'.repeat(48);
const sign=(payload,t)=>createHmac('sha256',secret).update(String(t)+'.'+JSON.stringify(payload)).digest('hex');
test('Track accepts only signed allowlisted operational metadata',()=>{
 const timestamp=Date.now();
 assert.equal(validTrackPf3Envelope(body),true);
 assert.equal(verifyTrackPf3Envelope(body,timestamp,sign(body,timestamp),secret,timestamp),true);
 assert.equal(verifyTrackPf3Envelope({...body,customerEmail:'secret@example.com'},timestamp,sign({...body,customerEmail:'secret@example.com'},timestamp),secret,timestamp),false);
 assert.equal(verifyTrackPf3Envelope({...body,eventType:'invoice.full_document'},timestamp,sign(body,timestamp),secret,timestamp),false);
 assert.equal(verifyTrackPf3Envelope(body,timestamp-400000,sign(body,timestamp-400000),secret,timestamp),false);
 assert.equal(verifyTrackPf3Envelope(body,timestamp,'0'.repeat(64),secret,timestamp),false);
 assert.equal(verifyTrackPf3Envelope(body,timestamp,sign(body,timestamp),'short',timestamp),false);
});
test('the owner dashboard reports financial unknowns and never fabricates revenue',()=>{
 const server=read('server/pf3-track-handler.js'),ui=read('src/TrackPf3Operations.jsx'),api=read('api/track/metrics.js');
 assert.match(server,/requireOwner\(req,res\)/);
 assert.match(server,/ON CONFLICT\(event_id\) DO NOTHING/);
 assert.match(server,/source:'awaiting_verified_events'/);
 assert.match(server,/source:'pakkafollow_verified_payment_ids'/);
 assert.match(server,/vendorCostsMinor:null,taxLiabilityMinor:null/);
 assert.match(api,/view==='pf3-ingest'/);
 assert.match(api,/view==='pf3-ops'/);
 assert.match(ui,/No signed events have been received/);
 assert.match(ui,/Provider accepted/);
 assert.match(ui,/Not reconciled/);
 assert.match(ui,/Net collections/);
 assert.match(ui,/Snapshot stale/);
 assert.match(ui,/Customer invoices are excluded/);
});
test('document events show only safe counts, never customer invoice amounts',()=>{
 const event={...body,eventType:'document.finalized'};
 const timestamp=Date.now();
 assert.equal(validTrackPf3Envelope(event),true);
 assert.equal(verifyTrackPf3Envelope(event,timestamp,sign(event,timestamp),secret,timestamp),true);
 assert.equal(validTrackPf3Envelope({...event,invoiceAmount:99900}),false);
 assert.match(read('server/pf3-track-handler.js'),/document_finalized/);
 assert.match(read('src/TrackPf3Operations.jsx'),/Customer-owned documents, not platform revenue/);
});
test('owner console provides filterable safe event sections and no invented AI totals',()=>{
 const jsx=read('src/TrackPf3Operations.jsx');
 for(const label of ['Revenue','Invoices','Communications','Workflows','AI','Monitoring','Event logs'])assert.ok(jsx.includes(label));
 assert.ok(jsx.includes('Export safe CSV'));
 assert.ok(jsx.includes('not instrumented in this event feed'));
 assert.ok(jsx.includes('Signed events report a product activity stream'));
 assert.ok(!jsx.includes('client_email'));
});
test('final document emails use allowlisted metadata only, not recipient or PDF content',()=>{
 const event={...body,eventType:'document.provider_accepted'},timestamp=Date.now();
 assert.equal(validTrackPf3Envelope(event),true);
 assert.equal(verifyTrackPf3Envelope(event,timestamp,sign(event,timestamp),secret,timestamp),true);
 assert.equal(validTrackPf3Envelope({...event,recipient:'client@example.com'}),false);
 assert.ok(read('server/pf3-track-handler.js').includes('document_provider_accepted'));
 assert.ok(read('src/TrackPf3Operations.jsx').includes('Provider accepted, not proof of inbox delivery'));
});
test('internal reminder events remain metadata-only and cannot reveal client contents',()=>{
 const event={...body,eventType:'automation.task_created'},now=Date.now();
 assert.equal(validTrackPf3Envelope(event),true);
 assert.equal(verifyTrackPf3Envelope(event,now,sign(event,now),secret,now),true);
 assert.equal(validTrackPf3Envelope({...event,followupBody:'private content'}),false);
 assert.ok(read('server/pf3-track-handler.js').includes('internal_tasks_created'));
});
test('editorial activity reports privacy-safe drafts and reviews without publishing claims',()=>{
 const event={...body,eventType:'content.reviewed'},timestamp=Date.now();
 assert.equal(validTrackPf3Envelope(event),true);
 assert.equal(verifyTrackPf3Envelope(event,timestamp,sign(event,timestamp),secret,timestamp),true);
 assert.equal(validTrackPf3Envelope({...event,subscriberEmail:'subscriber@example.com'}),false);
 const code=read('src/TrackPf3Operations.jsx');
 assert.match(code,/Editorial approval is not publishing or marketing delivery/);
 assert.match(code,/content\.drafted/);
});
test('Track routes remain private and retain existing support/analytics',()=>{
 const route=read('src/Track.jsx'),vercel=JSON.parse(read('vercel.json'));
 assert.match(route,/PakkaFollow support/);
 assert.match(route,/PakkaFollow 3\.0/);
 assert.match(route,/TrackPf3Operations/);
 for(const p of ['/api/track/pakkafollow/events','/api/track/pakkafollow/operations','/track/pakkafollow/operations'])
  assert.ok(vercel.rewrites.some(r=>r.source===p));
 assert.ok(vercel.headers.some(r=>r.source==='/track/:path*'&&r.headers.some(h=>h.key==='X-Robots-Tag')));
});

test('Track verifies signed collection snapshots and rejects customer invoice contents',()=>{
 const finance={capturedMinor:99900,refundedMinor:0,paymentCount:1,currency:'INR',periodStart:'2026-10-09T10:00:00.000Z',periodEnd:'2026-11-08T10:00:00.000Z'};
 const event={...body,eventType:'billing.snapshot',role:'other',occurredAt:finance.periodEnd,finance};
 const timestamp=Date.now(),signature=sign(event,timestamp);
 assert.equal(validPf3Finance(finance),true);
 assert.equal(validTrackPf3Envelope(event),true);
 assert.equal(verifyTrackPf3Envelope(event,timestamp,signature,secret,timestamp),true);
 assert.equal(validTrackPf3Envelope({...event,finance:{...finance,clientEmail:'client@example.com'}}),false);
 assert.equal(validTrackPf3Envelope({...event,finance:{...finance,refundedMinor:100000}}),false);
 assert.equal(verifyTrackPf3Envelope({...event,finance:{...finance,capturedMinor:0}},timestamp,signature,secret,timestamp),false);
});
