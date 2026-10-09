import test from 'node:test';
import assert from 'node:assert/strict';

/* Vite does not bundle the serverless API routes. Resolve and import each one
   explicitly to catch broken relative module paths before production deploy. */
const routes = [
  ['auth/request', 'POST'],
  ['auth/verify', 'POST'],
  ['auth/session', 'GET'],
  ['auth/logout', 'POST'],
  ['metrics', 'GET'],
  ['enquiries/index', 'GET'],
  ['enquiries/[referenceId]', 'GET'],
  ['enquiries/[referenceId]/actions', 'POST'],
  ['enquiries/[referenceId]/reply', 'POST'],
  ['cron/followups', 'GET'],
];
const load = route => import(new URL('../api/track/' + route + '.js', import.meta.url));
const response = () => ({
  statusCode:0, payload:null, headers:{},
  status(value){this.statusCode=value;return this;},
  json(value){this.payload=value;return this;},
  setHeader(key,value){this.headers[key.toLowerCase()]=value;return this;},
});
for(const [route,allowed] of routes) {
  test('tracker route imports and rejects unsupported methods: ' + route, async()=>{
    const mod=await load(route);
    assert.equal(typeof mod.default,'function');
    const res=response();
    await mod.default({method:allowed==='GET'?'POST':'GET',headers:{},query:{},body:{}},res);
    assert.equal(res.statusCode,405,route);
    assert.equal(res.payload?.ok,false);
  });
}
for(const route of ['auth/session','metrics','enquiries/index','enquiries/[referenceId]']) {
  test('private tracker returns 401 without session: '+route,async()=>{
    const mod=await load(route),res=response();
    await mod.default({method:'GET',headers:{},query:{}},res);
    assert.equal(res.statusCode,401,route);
    assert.equal(res.payload?.ok,false);
  });
}
test('scheduled follow-up job denies unauthenticated access',async()=>{
  const job=await load('cron/followups'),res=response();
  await job.default({method:'GET',headers:{}},res);
  assert.equal(res.statusCode,401);
});
