import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(ROOT,'.env.local');
if (fs.existsSync(file)) for (const line of fs.readFileSync(file,'utf8').split(/\r?\n/)) {
  const match=line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if(match&&!Object.hasOwn(process.env,match[1])){
    let value=match[2].trim();
    if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'"))) value=value.slice(1,-1);
    process.env[match[1]]=value;
  }
}
export const config={
  port:Number(process.env.PORT||4141),host:process.env.HOST||'127.0.0.1',
  siteUrl:process.env.SITE_URL||'http://localhost:4141',
  siteTitle:process.env.SITE_TITLE||'Vamsi\'s Corner',
  timezone:process.env.SITE_TIMEZONE||'Asia/Kolkata',
  dbPath:path.resolve(process.env.DB_PATH||path.join(process.env.DATA_DIR||path.join(ROOT,'data'),'corner.sqlite')),
  uploads:path.resolve(process.env.DATA_DIR||path.join(ROOT,'data'),'uploads'),
  basePath:(process.env.CORNER_BASE_PATH||'').replace(/\/$/,'') ,
  adminEmail:(process.env.ADMIN_EMAIL||'').trim().toLowerCase(),
  adminHash:process.env.ADMIN_PASSWORD_HASH||'',
  sessionSecret:process.env.SESSION_SECRET||'',
  prod:process.env.NODE_ENV==='production',
  demo:process.env.DEMO_CONTENT==='1' && process.env.NODE_ENV!=='production',
  trustProxy:process.env.TRUST_PROXY==='1',
};
