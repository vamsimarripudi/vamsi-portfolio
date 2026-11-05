import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { once } from 'node:events';

async function availablePort() {
  const server=net.createServer();
  server.listen(0,'127.0.0.1');
  await once(server,'listening');
  const port=server.address().port;
  await new Promise(resolve=>server.close(resolve));
  return port;
}
async function waitFor(url,child,output){
  for(let i=0;i<75;i++){
    if(child.exitCode!==null)throw Error('Backend exited: '+output.join('').slice(-700));
    try{
      const r=await fetch(url,{signal:AbortSignal.timeout(1000)});
      if(r.ok)return;
    }catch{}
    await new Promise(resolve=>setTimeout(resolve,140));
  }
  throw Error('Backend never became ready: '+output.join('').slice(-700));
}
test('single real HTTP process serves Corner and portfolio routes, with safety gates', {timeout:30000}, async()=>{
  const port=await availablePort();
  const dataDir=await mkdtemp(path.join(tmpdir(),'unified-corner-'));
  const logs=[];
  const child=spawn(process.execPath,['src/server.mjs'],{
    cwd:new URL('../',import.meta.url),
    env:{
      ...process.env,NODE_ENV:'test',HOST:'127.0.0.1',PORT:String(port),
      CORNER_BASE_PATH:'/corner',SITE_URL:'http://127.0.0.1:'+port+'/corner',
      DATA_DIR:dataDir,UNIFIED_PORTFOLIO_API:'1',UNIFIED_MAINTENANCE_ENABLED:'0',
      CORNER_BACKUP_ENABLED:'0',CORNER_AUTH_REGISTRATION_ENABLED:'0',
      DEMO_CONTENT:'0',ADMIN_EMAIL:'',ADMIN_PASSWORD_HASH:'',
      DATABASE_URL:'',RESEND_API_KEY:'',TRACK_SESSION_SECRET:''
    },stdio:['ignore','pipe','pipe']
  });
  for(const stream of [child.stdout,child.stderr]){
    stream.on('data',buf=>{if(logs.length<200)logs.push(String(buf).slice(0,1000));});
  }
  const base='http://127.0.0.1:'+port;
  try{
    await waitFor(base+'/corner/api/health',child,logs);
    assert.equal((await fetch(base+'/corner')).status,200);
    const health=await fetch(base+'/api/unified/health');
    assert.equal(health.status,200);
    assert.equal((await health.json()).component,'gateway');
    const ready=await fetch(base+'/api/unified/ready');
    assert.equal(ready.status,503);
    const denied=await fetch(base+'/corner/api/admin/overview');
    assert.equal(denied.status,401);
    const hostile=await fetch(base+'/api/contact',{
      method:'POST',headers:{origin:'https://unrelated.example','content-type':'application/json'},
      body:JSON.stringify({message:'Do not send this'})
    });
    assert.equal(hostile.status,403);
    const track=await fetch(base+'/api/track/auth/session');
    assert.notEqual(track.status,404);
    assert.equal(track.headers.get('cache-control'),'no-store');
  }finally{
    if(child.exitCode===null){
      const exited=once(child,'exit');
      child.kill('SIGTERM');
      await Promise.race([exited,new Promise(resolve=>setTimeout(resolve,3000))]);
    }
    if(child.exitCode===null)child.kill('SIGKILL');
    await rm(dataDir,{force:true,recursive:true});
  }
});
