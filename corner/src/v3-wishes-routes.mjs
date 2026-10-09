import {httpError} from './domain.mjs';
const id=/^post_[0-9a-f-]{36}$/i;
export function wishesRoutes({wishes,delivery,readJSON,ok,requireOwner,limit}){
 return async(req,res,path)=>{
  if(!path.startsWith('/api/admin/v3/wishes'))return false;
  if(!wishes.enabled())throw httpError(404,'Wishes Studio unavailable.','FEATURE_DISABLED');
  const method=req.method||'GET';
  const actor=requireOwner(req,'/api/admin/posts',method);
  wishes.requireOwner(actor);
  if(method!=='GET')limit(req,'v3-wishes-write',45,3600);
  if(path==='/api/admin/v3/wishes/delivery'&&method==='GET'){ok(res,delivery.snapshot(actor));return true}
  if(path==='/api/admin/v3/wishes/preview'&&method==='POST'){
   ok(res,wishes.preview(actor,await readJSON(req,12000)));return true;
  }
  if(path==='/api/admin/v3/wishes'){
   if(method==='GET'){ok(res,wishes.list(actor));return true}
   if(method==='POST'){ok(res,wishes.create(actor,await readJSON(req,12000)));return true}
   throw httpError(405,'Method not allowed.','METHOD_NOT_ALLOWED');
  }
  const found=path.match(/^\/api\/admin\/v3\/wishes\/(post_[0-9a-f-]{36})(?:\/(schedule|publish|archive|duplicate|notify))?$/i);
  if(!found||!id.test(found[1]))throw httpError(404,'Wish not found.','WISH_NOT_FOUND');
  const [,key,action]=found;
  if(!action&&method==='GET'){ok(res,wishes.get(actor,key));return true}
  if(!action&&method==='PATCH'){ok(res,wishes.update(actor,key,await readJSON(req,12000)));return true}
  if(action==='notify'&&method==='POST'){ok(res,delivery.enqueue(actor,key,await readJSON(req,3000)));return true}
  if(action==='schedule'&&method==='POST'){ok(res,wishes.schedule(actor,key,await readJSON(req,6000)));return true}
  if(action==='publish'&&method==='POST'){ok(res,wishes.publish(actor,key));return true}
  if(action==='archive'&&method==='POST'){ok(res,wishes.archive(actor,key));return true}
  if(action==='duplicate'&&method==='POST'){ok(res,wishes.duplicate(actor,key));return true}
  throw httpError(405,'Method not allowed.','METHOD_NOT_ALLOWED');
 };
}
