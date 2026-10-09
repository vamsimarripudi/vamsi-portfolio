import { httpError } from './domain.mjs';
const id=/^[a-z]+_[0-9a-f-]{36}$/i;
export function memoriesRoutes({memories,readJSON,ok,limit,requireOwner}){
 const owner=(req,method)=>{
  const person=requireOwner(req,'/api/admin/settings',method);
  memories.owner(person);
  return person;
 };
 return async(req,res,path,url)=>{
  const method=req.method||'GET';
  const publicRoutes={
   '/api/memories/timeline':()=>memories.timeline({year:url.searchParams.get('year')||'',kind:url.searchParams.get('kind')||''}),
   '/api/memories/albums':()=>memories.albums(),
   '/api/memories/collections':()=>memories.collections(),
   '/api/memories/now/history':()=>memories.nowHistory()
  };
  if(Object.hasOwn(publicRoutes,path)&&method==='GET'){
   limit(req,'v3-memories',75,60);ok(res,publicRoutes[path]());return true;
  }
  const album=path.match(/^\/api\/memories\/albums\/([a-z0-9-]+)$/);
  if(album&&method==='GET'){limit(req,'v3-album',60,60);ok(res,memories.album(album[1]));return true;}
  const collection=path.match(/^\/api\/memories\/collections\/([a-z0-9-]+)$/);
  if(collection&&method==='GET'){limit(req,'v3-collection',60,60);ok(res,memories.collection(collection[1]));return true;}
  if(!path.startsWith('/api/admin/v3/memories')&&
     !path.startsWith('/api/admin/v3/milestones')&&
     !path.startsWith('/api/admin/v3/albums')&&
     !path.startsWith('/api/admin/v3/collections'))return false;
  const actor=owner(req,method);
  if(path==='/api/admin/v3/memories'&&method==='GET'){ok(res,{
   milestones:memories.adminMilestones(actor),albums:memories.adminAlbums(actor),
   collections:memories.adminCollections(actor),now:memories.adminNowHistory(actor)
  });return true;}
  const methods=[
   {prefix:'/api/admin/v3/milestones',name:'milestones',read:()=>memories.adminMilestones(actor),write:(data,key)=>memories.milestone(actor,data,key)},
   {prefix:'/api/admin/v3/albums',name:'albums',read:()=>memories.adminAlbums(actor),write:(data,key)=>memories.albumWrite(actor,data,key)},
   {prefix:'/api/admin/v3/collections',name:'collections',read:()=>memories.adminCollections(actor),write:(data,key)=>memories.collectionWrite(actor,data,key)}
  ];
  for(const entry of methods){
   if(path===entry.prefix&&method==='GET'){ok(res,entry.read());return true;}
   const key=path.startsWith(entry.prefix+'/')?path.slice(entry.prefix.length+1):'';
   if(path!==entry.prefix&&(!key||key.includes('/')||!id.test(key)))continue;
   if(method==='POST'&&path===entry.prefix || method==='PATCH'&&key || method==='DELETE'&&key){
     limit(req,'v3-memories-write',75,3600);
     const data=method==='DELETE'?{state:'archived'}:await readJSON(req,14000);
     ok(res,entry.write(data,key));return true;
   }
  }
  throw httpError(405,'Method not allowed.','METHOD_NOT_ALLOWED');
 };
}
