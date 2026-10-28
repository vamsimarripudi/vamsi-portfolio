import {templateCatalog} from './communication-templates.mjs';
export function communicationRoutes({center,requireOwner,readJSON,ok,limit}){
 return async(req,res,path)=>{
  if(!path.startsWith('/api/admin/communications'))return false;
  const method=req.method||'GET';
  // The existing owner authorization and Origin protections remain authoritative.
  const actor=requireOwner(req,'/api/admin/settings',method);
  if(actor.role!=='owner')throw Object.assign(Error('Owner only'),{status:403,code:'OWNER_REQUIRED'});
  if(method!=='GET')limit(req,'communication-write',10,3600);
  if(path==='/api/admin/communications/status'&&method==='GET'){ok(res,center.status(actor));return true}
  if(path==='/api/admin/communications/templates'&&method==='GET'){ok(res,templateCatalog());return true}
  if(path==='/api/admin/communications/preview'&&method==='POST'){
   ok(res,center.preview(actor,await readJSON(req,5000)));return true;
  }
  if(path==='/api/admin/communications/campaigns'&&method==='POST'){
   ok(res,center.enqueue(actor,await readJSON(req,5000)));return true;
  }
  throw Object.assign(Error('Communication operation not permitted'),{status:405,code:'METHOD_NOT_ALLOWED'});
 };
}
