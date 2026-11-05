import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

// Prepare an owner-reviewable Vercel config; never write or deploy it automatically.
export function renderUnifiedCutover(source,{railwayOrigin,verifiedRailwayMaintenance=false}={}){
  if(!source||typeof source!=='object'||!Array.isArray(source.rewrites))throw Error('Invalid existing Vercel config');
  if(typeof railwayOrigin!=='string'||!/^https:\/\/[a-z0-9-]+\.up\.railway\.app$/i.test(railwayOrigin))
    throw Error('Expected a verified HTTPS Railway service origin');
  const routes=source.rewrites;
  const corner=routes.filter(route=>route.source==='/corner'||route.source==='/corner/:path*');
  if(corner.length!==2)throw Error('Current Corner proxy routes must be preserved');
  const other=routes.filter(route=>route.source!=='/corner'&&route.source!=='/corner/:path*'&&!route.source.startsWith('/api/'));
  const candidate={
    ...source,
    rewrites:[
      ...corner,
      {source:'/api/:path*',destination:railwayOrigin+'/api/:path*'},
      ...other
    ]
  };
  if(verifiedRailwayMaintenance){
    candidate.crons=(source.crons||[]).filter(job=>job.path!=='/api/track/cron/followups');
  }
  return candidate;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const origin=process.argv[2];
  const approved=process.argv.includes('--confirm-maintenance-verified');
  const existing=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
  const config=renderUnifiedCutover(existing,{railwayOrigin:origin,verifiedRailwayMaintenance:approved});
  process.stdout.write(JSON.stringify(config,null,2)+'\n');
}
