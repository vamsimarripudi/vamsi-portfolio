import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import {passwordHash} from '../src/auth.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

// Fetch the exact stylesheet URL rendered into the served HTML. A test that
// requests /corner/command-center.css directly misses a double-prefix bug in
// the HTML, which was why the live Command screen lost all of its styling.
for(const basePath of ['', '/corner']){
  test(`Command's rendered stylesheet loads with ${basePath||'root'} deployment`,{timeout:20000},async t=>{
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'command-studio-assets-'));
    const password=crypto.randomBytes(24).toString('base64url');
    const email='owner@command-assets.test';
    let port=null;
    const diagnostics=[];
    const child=spawn(process.execPath,['--no-warnings','src/server.mjs'],{
      cwd:root,
      env:{...process.env,NODE_ENV:'test',HOST:'127.0.0.1',PORT:'0',DATA_DIR:dir,
        DB_PATH:path.join(dir,'corner.sqlite'),SITE_URL:'http://fixture.test'+basePath,
        CORNER_BASE_PATH:basePath,ADMIN_EMAIL:email,ADMIN_PASSWORD_HASH:passwordHash(password),
        SESSION_SECRET:crypto.randomBytes(48).toString('hex'),DEMO_CONTENT:'0',
        CORNER_COMMAND_AI:'0',CORNER_BACKUP_ENABLED:'0',OPENAI_API_KEY:''},
      stdio:['ignore','pipe','pipe'],
    });
    child.stdout.on('data',chunk=>{
      const text=String(chunk);diagnostics.push(text);
      const match=text.match(/running at http:\/\/[^:]+:(\d+)/);
      if(match)port=Number(match[1]);
    });
    child.stderr.on('data',chunk=>diagnostics.push(String(chunk)));
    t.after(async()=>{
      if(child.exitCode===null){
        const exited=once(child,'exit');child.kill('SIGTERM');
        await Promise.race([exited,wait(1500)]);
        if(child.exitCode===null){child.kill('SIGKILL');await exited;}
      }
      fs.rmSync(dir,{recursive:true,force:true});
    });
    for(let attempt=0;attempt<100&&!port&&child.exitCode===null;attempt++)await wait(50);
    assert.ok(port,'Fixture did not bind: '+diagnostics.join('').slice(-600));
    const origin='http://127.0.0.1:'+port;
    const login=await fetch(origin+basePath+'/api/admin/login',{
      method:'POST',headers:{'content-type':'application/json',origin},
      body:JSON.stringify({email,password}),
    });
    assert.equal(login.status,200);
    const cookie=login.headers.get('set-cookie')?.split(';')[0];
    assert.ok(cookie);
    const response=await fetch(origin+basePath+'/admin',{headers:{cookie}});
    assert.equal(response.status,200);
    assert.match(response.headers.get('cache-control'),/private.*no-store/);
    const html=await response.text();
    assert.doesNotMatch(html,/studio-section-(?:select|picker)/,'Studio renders no duplicate Section selector at either mount');
    assert.match(html,/<nav class="admin-nav" aria-label="Studio sections">/,'The labeled Studio navigation remains in the served page');
    const styles=[...html.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"/g)]
      .map(match=>match[1]);
    const command=styles.filter(href=>href.includes('command-center.css'));
    assert.equal(command.length,1,'Load one Command stylesheet');
    const theme=styles.filter(href=>href.includes('studio-theme.css'));
    assert.equal(theme.length,1,'Load one private Studio theme stylesheet');
    assert.ok(styles.indexOf(theme[0])>styles.indexOf(command[0]),'Theme overrides load after Command presentation');
    assert.match(html,/corner-studio-theme/,'Theme preference is resolved before private Studio paint');
    assert.match(html,/<script src="[^"]*studio-theme\.js\?v=1" defer><\/script>/,'Private Studio loads the appearance controller');
    const stylesheet=new URL(command[0],origin);
    assert.equal(stylesheet.pathname,basePath+'/command-center.css','Use the configured deployment prefix exactly once');
    assert.ok(styles.indexOf(command[0])>styles.findIndex(href=>href.includes('/studio.css')),
      'Command presentation follows the shared Studio stylesheet');
    const css=await fetch(stylesheet);
    assert.equal(css.status,200,'The asset URL in the real HTML must resolve');
    assert.match(css.headers.get('content-type'),/^text\/css/,'A successful HTML fallback is not a stylesheet');
    assert.match(await css.text(),/\.command-summary-strip/);
    const themeCss=await fetch(new URL(theme[0],origin));
    assert.equal(themeCss.status,200);assert.match(themeCss.headers.get('content-type'),/^text\/css/);
    assert.match(await themeCss.text(),/data-studio-theme=\"dark\"/);
    const publicPage=await fetch(origin+basePath+'/');
    const publicHtml=await publicPage.text();
    assert.doesNotMatch(publicHtml,/studio-theme\.(?:css|js)/,'Public Corner is not forced into the private Studio appearance preference');
  });
}
