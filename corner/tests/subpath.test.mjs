import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { passwordHash } from '../src/auth.mjs';

async function start(port, dir) {
  const child = spawn(process.execPath, ['--no-warnings', 'src/server.mjs'], {
    cwd: new URL('../', import.meta.url).pathname,
    env: { ...process.env, NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(port),
      SITE_URL: `http://127.0.0.1:${port}/corner`, CORNER_BASE_PATH: '/corner', DATA_DIR: dir,
      SESSION_SECRET: 'subpath-suite-secret-' + 'b'.repeat(50), ADMIN_EMAIL: 'owner@example.com',
      ADMIN_PASSWORD_HASH: passwordHash('a-VeryLongSyntheticTestPassword!2026'), DEMO_CONTENT: '0' },
    stdio: 'ignore',
  });
  for (let i = 0; i < 45; i++) {
    if (child.exitCode !== null) throw Error('service failed to start');
    try { let res = await fetch(`http://127.0.0.1:${port}/corner/api/health`); if (res.ok) return child; }
    catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  child.kill();throw Error('service timeout');
}

test('portfolio subpath: HTML, API, sessions, assets, private content, persistence', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'corner-subpath-'));
  const port = 19000 + Math.floor(Math.random() * 1000), host = `http://127.0.0.1:${port}`;
  let child;
  try {
    child = await start(port, dir);
    const home = await fetch(host + '/corner');
    const html = await home.text();
    assert.equal(home.status, 200);
    assert.match(html, /href="\/corner\/style\.css"/);
    assert.match(html, /src="\/corner\/app\.js"/);
    assert.match(html, /href="\/corner\/admin"/);
    assert.match(html, /href="\/corner\/category\/wishes"/);
    assert.match(html, /rel="canonical" href="http:\/\/127\.0\.0\.1:\d+\/corner\/"/);
    assert.doesNotMatch(html, /href="\/(?!corner\/|\/)/);
    for (const suffix of ['/corner/style.css', '/corner/app.js', '/corner/admin.js', '/corner/mark.svg', '/corner/og.svg', '/corner/robots.txt', '/corner/sitemap.xml']) {
      const r = await fetch(host + suffix);
      assert.equal(r.status, 200, suffix);
    }
    const nav = await fetch(host + '/corner/about'); assert.equal(nav.status, 200);
    const privatePage = await fetch(host + '/corner/admin'); assert.match(await privatePage.text(), /Welcome back\./);
    assert.equal((await fetch(host + '/api/health')).status, 404, 'API outside subpath is not exposed');
    const req = await fetch(host + '/corner/api/admin/login', { method: 'POST', headers: { 'content-type': 'application/json', Origin: host }, body: JSON.stringify({ email: 'owner@example.com', password: 'a-VeryLongSyntheticTestPassword!2026' }) });
    assert.equal(req.status, 200, 'private login permitted for correct owner');
    assert.match(req.headers.get('set-cookie'), /Path=\/corner;/);
    const sessionCookie = req.headers.get('set-cookie').split(';')[0];
    const metrics = await fetch(host + '/corner/api/admin/overview', { headers: { Cookie: sessionCookie } });
    assert.equal(metrics.status, 200, 'authenticated admin API');
    const outside = await fetch(host + '/corner/api/admin/overview');
    assert.equal(outside.status, 401, 'protected admin API');
    const noOrigin = await fetch(host + '/corner/api/admin/logout', { method: 'POST', headers: { Cookie: sessionCookie } });
    assert.equal(noOrigin.status, 403, 'reject CSRF without Origin');
    assert.equal((await fetch(host + '/corner/api/posts')).status, 200);
    child.kill('SIGTERM');await new Promise(r=>child.once('exit',r));
    child = await start(port, dir);
    const persisted = await fetch(host + '/corner/api/admin/overview', { headers: { Cookie: sessionCookie } });
    assert.equal(persisted.status, 200, 'session state survives service restart on persistent directory');
    console.log('PASS: /corner static, SSR, API, auth cookie scope, CSRF, restart persistence');
  } finally {
    if(child?.exitCode===null)child.kill('SIGKILL');
    rmSync(dir,{recursive:true,force:true});
  }
});
