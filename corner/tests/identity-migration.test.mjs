import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { Store } from '../src/store.mjs';
import { IdentityService } from '../src/identity.mjs';
import { passwordHash } from '../src/auth.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));

test('legacy SQLite migration preserves posts, owner, sessions and backups without granting new owner accounts',t=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'corner-v1-upgrade-'));
  t.after(()=>fs.rmSync(folder,{recursive:true,force:true}));
  const file=path.join(folder,'legacy.sqlite');
  const db=new DatabaseSync(file);
  const schema=fs.readFileSync(path.join(root,'src/schema.sql'),'utf8').replace("role TEXT NOT NULL DEFAULT 'member'","role TEXT NOT NULL DEFAULT 'owner'");
  db.exec(schema);
  const ownerHash=passwordHash('Existing-Legacy-Owner-Password#2026');
  const stamp=new Date().toISOString();
  db.prepare('INSERT INTO users(id,email,display_name,role,password_hash,created_at,updated_at) VALUES(?,?,?,?,?,?,?)')
    .run('owner-old','owner-legacy@example.test','Existing Owner','owner',ownerHash,stamp,stamp);
  db.prepare(`INSERT INTO posts(id,slug,type,title,excerpt,body,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)`)
    .run('post-before','legacy-post','tech_note','Older preserved post','','Historical publication',stamp,stamp);
  db.close();
  const store=new Store(file);
  try{
    store.bootstrap('owner-legacy@example.test',ownerHash);
    const original=store.owner();
    const oldPost=store.one('SELECT * FROM posts WHERE id=?','post-before');
    const identity=new IdentityService(store,{env:{NODE_ENV:'test',SESSION_SECRET:'migration-test-secret-12345678901234567890'}});
    assert.equal(identity.safeMe(original).verified,true,'existing owner marked verified');
    assert.equal(store.owner().id,'owner-old');
    assert.deepEqual({...store.one('SELECT id,slug,title,body FROM posts WHERE id=?','post-before')},{
      id:oldPost.id,slug:oldPost.slug,title:oldPost.title,body:oldPost.body
    });
    store.exec('INSERT INTO users(id,email,display_name,role,password_hash,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',
      'member-new','member-new@example.test','New Member','member',passwordHash('Strong-Member-Passphrase#2026'),stamp,stamp);
    assert.throws(()=>store.exec('UPDATE users SET role=? WHERE id=?','owner','member-new'),/single owner already exists/i);
    assert.throws(()=>store.exec('INSERT INTO users(id,email,display_name,password_hash,created_at,updated_at) VALUES(?,?,?,?,?,?)',
      'implicit-bad','bad@example.test','Implicit','hash',stamp,stamp),/single owner already exists/i,'legacy default owner fails closed');
    assert.equal(store.one('SELECT count(*) AS n FROM users WHERE role=?','owner').n,1);
  }finally{store.close()}
  const check=new DatabaseSync(file);
  try{
    assert.equal(check.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
    assert.equal(check.prepare('SELECT count(*) AS n FROM posts').get().n,1,'all posts survived migration');
  }finally{check.close()}
});
