import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { ROOT, config } from './config.mjs';
import { bucketFromEnv, sha256 } from './s3-client.mjs';

const exec = promisify(execFile);
const stamp = (time) => time.toISOString().replace(/[:.]/g, '-');
const safeEntry = (name) => typeof name === 'string' && !name.startsWith('/') && !name.includes('\\') && !name.split('/').includes('..');

async function runScript(script, args, dataDir) {
  const result = await exec(process.execPath, ['--no-warnings', path.join(ROOT, 'scripts', script), ...args], {
    cwd: ROOT, timeout: 150000, maxBuffer: 1048576,
    env: {...process.env, NODE_ENV:'test', DATA_DIR:dataDir, DB_PATH:path.join(dataDir, 'corner.sqlite')},
  });
  return JSON.parse(result.stdout.trim());
}

export async function createVerifiedOffsiteBackup({ storage = bucketFromEnv(), dataDir = path.dirname(config.dbPath), at = new Date(), retainDays = 30, now = () => new Date() } = {}) {
  if (!(at instanceof Date) || Number.isNaN(at.valueOf())) throw new Error('Invalid backup date');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'corner-offsite-'));
  const snapshot = path.join(temp, 'snapshot');
  const downloaded = path.join(temp, 'downloaded');
  const isolated = path.join(temp, 'isolated-restore');
  const prefix = 'backups/' + stamp(at) + '/';
  let byteCount = 0;
  try {
    const local = await runScript('backup.mjs', [snapshot], dataDir);
    if (!local.ok || !local.verified) throw new Error('Local SQLite snapshot invalid');
    const manifestBytes = fs.readFileSync(path.join(snapshot, 'manifest.json'));
    const manifest = JSON.parse(manifestBytes.toString());
    if (manifest.format !== 'vamsis-corner-backup-v1') throw new Error('Unsupported snapshot manifest');
    const names = Object.keys(manifest.files).sort();
    if (!names.includes('corner.sqlite')) throw new Error('Database missing from snapshot');
    for (const name of names) {
      if (!safeEntry(name)) throw new Error('Unsafe backup filename');
      const original = fs.readFileSync(path.join(snapshot, name));
      if (sha256(original) !== manifest.files[name]) throw new Error('Local backup integrity mismatch');
      await storage.put(prefix + name, original);
      const fetched = await storage.get(prefix + name);
      if (sha256(fetched) !== manifest.files[name]) throw new Error('Offsite checksum mismatch');
      const dest = path.join(downloaded, name);
      fs.mkdirSync(path.dirname(dest), {recursive:true});
      fs.writeFileSync(dest, fetched, {flag:'wx'});
      byteCount += original.length;
    }
    fs.writeFileSync(path.join(downloaded, 'manifest.json'), manifestBytes, {flag:'wx'});
    const restored = await runScript('restore.mjs', [downloaded, '--confirm'], isolated);
    if (!restored.ok) throw new Error('Isolated restore failed');
    const db = new DatabaseSync(path.join(isolated, 'corner.sqlite'));
    try {
      if (db.prepare('PRAGMA integrity_check').get()?.integrity_check !== 'ok') throw new Error('Restored SQLite database is invalid');
    } finally { db.close(); }
    // The remote manifest is the completion marker; incomplete backups cannot be treated as valid.
    await storage.put(prefix + 'manifest.json', manifestBytes);
    if (sha256(await storage.get(prefix + 'manifest.json')) !== sha256(manifestBytes)) throw new Error('Remote manifest verification failed');
    let pruned = 0;
    try { pruned = await pruneOldBackups(storage, {now:now(), retainDays}); }
    catch (e) { console.warn(JSON.stringify({event:'corner.backup.retention_error', reason:String(e?.message||'Unknown').slice(0,120)})); }
    return {ok:true, verified:true, restoreRehearsed:true, backupPrefix:prefix, files:names.length, bytes:byteCount, pruned};
  } finally { fs.rmSync(temp, {recursive:true, force:true}); }
}

export async function pruneOldBackups(storage, {now = new Date(), retainDays = 30} = {}) {
  if (!Number.isInteger(retainDays) || retainDays < 7 || retainDays > 365) throw new Error('Retention must be between 7 and 365 days');
  const keys = await storage.list('backups/');
  const complete = keys.filter((name) => /^backups\/\d{4}-\d{2}-\d{2}T[\d-]+Z\/manifest\.json$/.test(name)).sort().reverse();
  // Always preserve at least two verified copies, irrespective of age.
  if (complete.length < 3) return 0;
  const cutoff = now.getTime() - retainDays * 86400000;
  let pruned = 0;
  for (const marker of complete.slice(2)) {
    const folder = marker.slice(0, -'manifest.json'.length);
    const stampText = folder.slice(8, -1).replace(/(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, '$1:$2:$3.$4Z');
    const date = new Date(stampText);
    if (Number.isNaN(date.valueOf()) || date.valueOf() >= cutoff) continue;
    for (const key of keys.filter((item) => item.startsWith(folder))) { await storage.delete(key); pruned += 1; }
  }
  return pruned;
}

/** Public, non-sensitive backup freshness for external availability monitoring. */
export function backupFresh(store, { env = process.env, at = new Date(), maxAgeHours = 26 } = {}) {
  if (env.CORNER_BACKUP_ENABLED !== '1') return false;
  if (!(at instanceof Date) || !Number.isFinite(at.valueOf())) return false;
  if (!(Number.isFinite(maxAgeHours) && maxAgeHours > 0)) return false;
  const lastSuccess = Date.parse(store.setting('backup.lastSuccess', '') || '');
  const age = at.valueOf() - lastSuccess;
  return Number.isFinite(age) && age >= 0 && age < maxAgeHours * 60 * 60 * 1000;
}

export function startOffsiteScheduler(store, {env = process.env, now = () => new Date(), intervalMs = 60000, log = console, runBackup = createVerifiedOffsiteBackup, makeStorage = bucketFromEnv, startupDelayMs = 16000} = {}) {
  if (env.CORNER_BACKUP_ENABLED !== '1') return () => {};
  const hour = Number(env.CORNER_BACKUP_UTC_HOUR ?? 2);
  const minute = Number(env.CORNER_BACKUP_UTC_MINUTE ?? 30);
  const retention = Number(env.CORNER_BACKUP_RETENTION_DAYS ?? 30);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59) throw new Error('Invalid backup schedule');
  let running = false, stopped = false;
  const tick = async () => {
    const at = now();
    if (stopped || running || at.getUTCHours() * 60 + at.getUTCMinutes() < hour * 60 + minute) return;
    if ((store.setting('backup.lastSuccess', '') || '').slice(0, 10) === at.toISOString().slice(0, 10)) return;
    const lastAttempt = Date.parse(store.setting('backup.lastAttempt', '') || '');
    if (Number.isFinite(lastAttempt) && at.valueOf() - lastAttempt < 1800000) return;
    running = true;
    store.saveSetting('backup.lastAttempt', at.toISOString());
    try {
      const result = await runBackup({storage:makeStorage(env), dataDir:path.dirname(config.dbPath), at, retainDays:retention, now});
      if (!stopped) { store.saveSetting('backup.lastSuccess', at.toISOString()); store.saveSetting('backup.lastError', null); }
      log.info?.(JSON.stringify({event:'corner.backup.verified', ...result}));
    } catch (err) {
      const message = String(err?.message || 'Backup failed').slice(0, 160);
      if (!stopped) store.saveSetting('backup.lastError', message);
      log.error?.(JSON.stringify({event:'corner.backup.failed', reason:message}));
    } finally { running = false; }
  };
  const startup = setTimeout(() => { void tick(); }, startupDelayMs);
  const interval = setInterval(() => { void tick(); }, intervalMs);
  return () => { stopped = true; clearTimeout(startup); clearInterval(interval); };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await createVerifiedOffsiteBackup();
  console.log(JSON.stringify({event:'corner.backup.manual', ...result}));
}
