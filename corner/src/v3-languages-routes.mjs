import {httpError} from './domain.mjs';
export function languageRoutes({languages,requireOwner,readJSON,ok,limit}){
 return async(req,res,path,url)=>{
  if(!path.startsWith('/api/admin/v3/languages'))return false;
  const actor=requireOwner(req,'/api/admin/settings',req.method||'GET');
  languages.owner(actor);
  const method=req.method||'GET';
  if(method!=='GET')limit(req,'v3-language-write',35,3600);
  if(path==='/api/admin/v3/languages'){
   if(method==='GET'){ok(res,languages.list(actor));return true}
   if(method==='POST'){ok(res,languages.save(actor,await readJSON(req,16000)));return true}
  }
  if(path==='/api/admin/v3/languages/preview'&&method==='POST'){
   ok(res,languages.preview(actor,await readJSON(req,16000)));return true;
  }
  const match=path.match(/^\/api\/admin\/v3\/languages\/(post_[0-9a-f-]{36})\/(te|hi)\/(publish|revoke)$/i);
  if(match&&method==='POST'){
   const body=await readJSON(req,2000);
   ok(res,languages.review(actor,match[1],match[2],{confirm:body.confirm,publish:match[3]==='publish'}));return true;
  }
  throw httpError(405,'Language operation not permitted.','METHOD_NOT_ALLOWED');
 };
}
