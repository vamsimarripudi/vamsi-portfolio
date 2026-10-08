import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { Store } from '../src/store.mjs';

const appRoot = fileURLToPath(new URL('../', import.meta.url));
const run = (script, args, directory) => JSON.parse(execFileSync(process.execPath, ['--no-warnings', script, ...args], {
  cwd: appRoot,
  encoding: 'utf8',
  timeout: 15000,
  env: { ...process.env, NODE_ENV: 'test', DATA_DIR: directory, DB_PATH: path.join(directory, 'corner.sqlite') },
}));

test('verified backup and isolated restore preserve live WAL database and uploaded media', async (t) => {
  const workspace = mkdtempSync(path.join(tmpdir(), 'corner-backup-regression-'));
  t.after(() => rmSync(workspace, { recursive: true, force: true }));
  const original = path.join(workspace, 'original');
  const restored = path.join(workspace, 'restored');
  const archive = path.join(workspace, 'verified-snapshot');
  mkdirSync(path.join(original, 'uploads'), { recursive: true });
  const owner = new Store(path.join(original, 'corner.sqlite'));
  try {
    const draft = owner.createPost({ type: 'moment', title: 'Durable archive QA story', body: 'The original media and story must survive restore.' }, 'qa-owner');
    owner.publish(draft.id, 'qa-owner');
    const bytes = Buffer.from('binary media snapshot test payload', 'utf8');
    writeFileSync(path.join(original, 'uploads', 'qa-image.png'), bytes);
    owner.addMedia({ id: 'qa-media', ownerId: draft.id, storageKey: 'qa-image.png', mimeType: 'image/png', size: bytes.length, alt: 'A synthetic test fixture' });
    const snapshot = run('scripts/backup.mjs', [archive], original);
    assert.equal(snapshot.ok, true);
    assert.equal(snapshot.verified, true);
    assert.equal(snapshot.files, 2);
    const manifest = JSON.parse(readFileSync(path.join(archive, 'manifest.json'), 'utf8'));
    assert.equal(manifest.format, 'vamsis-corner-backup-v1');
    assert.ok(manifest.files['uploads/qa-image.png']);
    assert.ok(manifest.files['corner.sqlite']);
    const recovery = run('scripts/restore.mjs', [archive, '--confirm'], restored);
    assert.equal(recovery.ok, true);
    assert.equal(existsSync(path.join(restored, 'uploads', 'qa-image.png')), true);
    assert.deepEqual(readFileSync(path.join(restored, 'uploads', 'qa-image.png')), bytes);
    const copy = new Store(path.join(restored, 'corner.sqlite'));
    try {
      assert.equal(copy.getFeed().items.length, 1);
      assert.equal(copy.getFeed().items[0].slug, draft.slug);
      assert.equal(copy.listMedia(draft.id).length, 1);
      assert.equal(copy.listMedia(draft.id)[0].alt_text, 'A synthetic test fixture');
    } finally { copy.close(); }
  } finally { owner.close(); }
});
