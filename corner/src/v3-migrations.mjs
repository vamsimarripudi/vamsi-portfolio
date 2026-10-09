import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const schema=fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)),'v3-schema.sql'),'utf8');
const sha=(value)=>crypto.createHash('sha256').update(value).digest('hex');
const bookmarks="CREATE TABLE IF NOT EXISTS identity_bookmarks (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,created_at TEXT NOT NULL,PRIMARY KEY(user_id,post_id));";

/** Transactional, checked and strictly additive changes. Never erase content. */
export function applyV3Migrations(store){
  store.db.exec("CREATE TABLE IF NOT EXISTS v3_schema_migrations(version TEXT PRIMARY KEY,checksum TEXT NOT NULL,applied_at TEXT NOT NULL);");
  const migrations=[
    {version:'v3-0001-engagement',source:schema,apply:()=>store.db.exec(schema)},
    {version:'v3-0002-bookmark-progress',source:bookmarks+'|progress:INTEGER|progress_updated_at:TEXT',apply:()=>{
      store.db.exec(bookmarks);
      const columns=new Set(store.all('PRAGMA table_info(identity_bookmarks)').map(col=>col.name));
      if(!columns.has('progress'))store.db.exec('ALTER TABLE identity_bookmarks ADD COLUMN progress INTEGER CHECK(progress BETWEEN 0 AND 100)');
      if(!columns.has('progress_updated_at'))store.db.exec('ALTER TABLE identity_bookmarks ADD COLUMN progress_updated_at TEXT');
      store.db.exec("INSERT OR IGNORE INTO identity_bookmarks(user_id,post_id,created_at,progress,progress_updated_at) SELECT user_id,post_id,updated_at,progress,updated_at FROM v3_reading_positions");
      store.db.exec("UPDATE identity_bookmarks SET progress=(SELECT r.progress FROM v3_reading_positions r WHERE r.user_id=identity_bookmarks.user_id AND r.post_id=identity_bookmarks.post_id),progress_updated_at=(SELECT r.updated_at FROM v3_reading_positions r WHERE r.user_id=identity_bookmarks.user_id AND r.post_id=identity_bookmarks.post_id) WHERE progress IS NULL AND EXISTS(SELECT 1 FROM v3_reading_positions r WHERE r.user_id=identity_bookmarks.user_id AND r.post_id=identity_bookmarks.post_id)");
    }}
  ];
  for(const item of migrations){
    const fingerprint=sha(item.source);
    const applied=store.one('SELECT checksum FROM v3_schema_migrations WHERE version=?',item.version);
    if(applied){if(applied.checksum!==fingerprint)throw Error('V3 migration checksum mismatch: '+item.version);continue;}
    store.transaction(()=>{item.apply();store.exec('INSERT INTO v3_schema_migrations(version,checksum,applied_at) VALUES(?,?,?)',item.version,fingerprint,new Date().toISOString());});
  }
  return migrations.map(x=>x.version);
}
