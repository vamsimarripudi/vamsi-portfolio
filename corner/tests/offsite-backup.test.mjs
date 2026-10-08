import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { once } from 'node:events';
import { Store } from '../src/store.mjs';
import { S3Bucket } from '../src/s3-client.mjs';
import { createVerifiedOffsiteBackup, pruneOldBackups, startOffsiteScheduler } from '../src/offsite-backup.mjs';

async function fixture(t) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'corner-offsite-qa-'));
  t.after(() => fs.rmSync(temp, {recursive:true, force:true}));
  const data = path.join(temp, 'data');
  fs.mkdirSync(path.join(data, 'uploads'), {recursive:true});
  const database = new Store(path.join(data, 'corner.sqlite'));
  t.after(() => database.close());
  const post = database.createPost({type:'moment', title:'Synthetic recovery test', body:'Verify that both the story and its media survive recovery.'}, 'qa-owner');
  database.publish(post.id, 'qa-owner');
  const bytes = Buffer.from('SYNTHETIC_MEDIA_BYTES');
  fs.writeFileSync(path.join(data, 'uploads', 'test.png'), bytes);
  database.addMedia({id:'qa-media',ownerId:post.id,storageKey:'test.png',mimeType:'image/png',size:bytes.length,alt:'Synthetic'});
  const objects = new Map();
  const calls = [];
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://' + req.headers.host);
    assert.match(req.headers.authorization || '', /^AWS4-HMAC-SHA256 Credential=TESTKEY\//);
    assert.equal(req.headers['x-amz-content-sha256']?.length, 64);
    const key = decodeURIComponent(url.pathname.replace(/^\/test-bucket\/?/, ''));
    calls.push({method:req.method,key});
    if (req.method === 'GET' && url.searchParams.get('list-type') === '2') {
      const prefix = url.searchParams.get('prefix') || '';
      const names = [...objects.keys()].filter(name => name.startsWith(prefix));
      res.writeHead(200, {'content-type':'application/xml'});
      return res.end('<ListBucketResult><IsTruncated>false</IsTruncated>' + names.map(name => '<Contents><Key>' + encodeURIComponent(name) + '</Key></Contents>').join('') + '</ListBucketResult>');
    }
    if (req.method === 'PUT') {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      objects.set(key, Buffer.concat(chunks));
      res.writeHead(200); return res.end();
    }
    if (req.method === 'GET') {
      if (!objects.has(key)) {res.writeHead(404); return res.end();}
      res.writeHead(200); return res.end(objects.get(key));
    }
    if (req.method === 'DELETE') {objects.delete(key);res.writeHead(204);return res.end();}
    res.writeHead(405);res.end();
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const storage = new S3Bucket({endpoint:'http://127.0.0.1:' + server.address().port, bucket:'test-bucket', urlStyle:'path',region:'auto',accessKeyId:'TESTKEY',secretAccessKey:'FAKE',allowHttp:true});
  return {storage,objects,calls,data};
}

test('offsite backup round trips SQLite and media, rehearses independent restore, and publishes verified manifest last', async (t) => {
  const {storage,objects,calls,data} = await fixture(t);
  const now = new Date('2026-10-08T12:03:04.123Z');
  const result = await createVerifiedOffsiteBackup({storage,dataDir:data,at:now,now:()=>now});
  assert.equal(result.ok, true);
  assert.equal(result.restoreRehearsed,true);
  assert.equal(result.files,2);
  assert.ok(objects.has(result.backupPrefix+'corner.sqlite'));
  assert.ok(objects.has(result.backupPrefix+'uploads/test.png'));
  assert.ok(objects.has(result.backupPrefix+'manifest.json'));
  assert.equal(calls.filter(x=>x.method==='PUT').at(-1).key,result.backupPrefix+'manifest.json');
  assert.equal((await storage.list('backups/')).length,3);
});

test('backup refuses to mark corrupted offsite objects as complete', async(t) => {
  const {storage,objects,data} = await fixture(t);
  const get = storage.get.bind(storage);
  storage.get = async (key) => key.endsWith('corner.sqlite') ? Buffer.from('bad data') : get(key);
  await assert.rejects(createVerifiedOffsiteBackup({storage,dataDir:data,at:new Date('2026-10-08T12:03:04.123Z')}), /checksum mismatch/);
  assert.equal([...objects.keys()].some(k=>k.endsWith('manifest.json')),false);
});

test('retention deletes only expired complete snapshots and always keeps the newest two',async(t)=>{
  const {storage,objects}=await fixture(t);
  for (const day of ['2025-01-01','2025-02-01','2025-03-01','2026-10-01']) {
    await storage.put('backups/'+day+'T03-00-00-000Z/corner.sqlite', Buffer.from('db'));
    await storage.put('backups/'+day+'T03-00-00-000Z/manifest.json', Buffer.from('manifest'));
  }
  await storage.put('unrelated/safe.txt', Buffer.from('preserve'));
  assert.equal(await pruneOldBackups(storage,{now:new Date('2026-10-08T12:00:00Z'),retainDays:30}),4);
  assert.equal(objects.has('unrelated/safe.txt'),true);
  assert.equal((await storage.list('backups/')).length,4);
});

test('scheduler respects UTC threshold and never replays a successful day', async(t) => {
  let now = new Date('2026-10-08T02:29:00Z');
  const settings = new Map();
  const fakeStore = { setting:(key,d)=>settings.has(key)?settings.get(key):d, saveSetting:(key,v)=>settings.set(key,v) };
  let count = 0;
  const stop = startOffsiteScheduler(fakeStore,{
    env:{CORNER_BACKUP_ENABLED:'1',CORNER_BACKUP_UTC_HOUR:'2',CORNER_BACKUP_UTC_MINUTE:'30'},
    now:()=>now, startupDelayMs:5,intervalMs:20,makeStorage:()=>({}),
    runBackup:async()=>{count+=1;return{ok:true,verified:true,restoreRehearsed:true}},log:{info:()=>{},error:()=>{}},
  });
  t.after(stop);
  await new Promise(resolve=>setTimeout(resolve,60));
  assert.equal(count,0);
  now = new Date('2026-10-08T02:31:00Z');
  await new Promise(resolve=>setTimeout(resolve,75));
  assert.equal(count,1);
  assert.match(settings.get('backup.lastSuccess'),/^2026-10-08/);
  await new Promise(resolve=>setTimeout(resolve,50));
  assert.equal(count,1);
});

test('credentials and object keys fail closed',async(t)=>{
  const {storage}=await fixture(t);
  assert.throws(()=>storage.urlFor('../escape'),/Unsafe/);
  assert.throws(()=>new S3Bucket({endpoint:'http://example.com',bucket:'bucket',accessKeyId:'x',secretAccessKey:'y'}),/HTTPS/);
  await assert.rejects(pruneOldBackups(storage,{retainDays:2}),/Retention/);
});
