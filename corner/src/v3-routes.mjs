import { httpError } from './domain.mjs';
const parseCookie=(req,name)=>{
  const field=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='));
  if(!field)return '';
  try{return decodeURIComponent(field.slice(name.length+1))}catch{return ''}
};
export function v3Routes({v3,store,identity,readJSON,ok,limit}){
  const verifiedMember=(req)=>{
    const user=store.session(parseCookie(req,'corner_member_session'));
    if(!user||user.role!=='member'||!identity.getProfile(user.id)?.verified_at)throw httpError(401,'Verified member login required.','AUTH_REQUIRED');
    return user;
  };
  const permittedModerator=(req)=>{
    const user=store.session(parseCookie(req,'corner_session'));
    if(!user)throw httpError(401,'Studio session required.','AUTH_REQUIRED');
    if(!['owner','admin','moderator'].includes(user.role))throw httpError(403,'No moderation permission.','ROLE_FORBIDDEN');
    if(user.role!=='owner'&&!store.one('SELECT 1 FROM identity_mfa WHERE user_id=? AND enabled_at IS NOT NULL',user.id))throw httpError(403,'MFA required.','MFA_REQUIRED');
    return user;
  };
  return async(req,res,path,url)=>{
    const method=req.method;
    if(path==='/api/guestbook'){
      if(method==='GET'){ok(res,v3.listGuestbook({limit:url.searchParams.get('limit'),offset:url.searchParams.get('offset')}));return true;}
      if(method==='POST'){limit(req,'v3-guestbook',3,3600);const data=await readJSON(req,6000);const member=store.session(parseCookie(req,'corner_member_session'));ok(res,v3.submitGuestbook(data,member));return true;}
    }
    if(path==='/api/admin/v3/guestbook'&&method==='GET'){ok(res,v3.reviewQueue(permittedModerator(req)));return true;}
    const moderate=path.match(/^\/api\/admin\/v3\/guestbook\/([A-Za-z0-9_-]+)$/);
    if(moderate&&method==='PATCH'){limit(req,'v3-moderate',60,60);const user=permittedModerator(req);const payload=await readJSON(req,1500);ok(res,v3.manageGuestbook(user,{id:moderate[1],state:payload.state}));return true;}
    if(path==='/api/follow'&&method==='POST'){limit(req,'v3-follow',4,3600);const data=await readJSON(req,3500);ok(res,await v3.follow(data));return true;}
    if(path==='/api/follow/verify'&&method==='POST'){limit(req,'v3-verify',12,3600);const data=await readJSON(req,2000);ok(res,v3.verifyFollow(data.token));return true;}
    if(path==='/api/follow/unsubscribe/request'&&method==='POST'){limit(req,'v3-unsubscribe-request',4,3600);const data=await readJSON(req,2000);ok(res,await v3.requestUnsubscribe(data));return true;}
    if(path==='/api/follow/unsubscribe'&&method==='POST'){limit(req,'v3-unsubscribe',12,3600);const data=await readJSON(req,2000);ok(res,v3.unsubscribeFollow(data.token));return true;}
    const reading=path.match(/^\/api\/me\/reading\/([A-Za-z0-9_-]+)$/);
    if(reading&&['GET','PUT','DELETE'].includes(method)){
      const member=verifiedMember(req);
      if(method==='GET')ok(res,v3.reading(member,reading[1]));
      else if(method==='DELETE')ok(res,v3.reading(member,reading[1],null));
      else {limit(req,'v3-reading',60,60);const data=await readJSON(req,800);ok(res,v3.reading(member,reading[1],data.progress));}
      return true;
    }
    if(path==='/api/search/advanced'&&method==='GET'&&v3.enabled('SEARCH')){limit(req,'v3-search',60,60);ok(res,v3.search({
      q:url.searchParams.get('q')||'',category:url.searchParams.get('category')||'',
      year:url.searchParams.get('year')||'',tag:url.searchParams.get('tag')||'',
      limit:url.searchParams.get('limit')||20,offset:url.searchParams.get('offset')||0
    }));return true;}
    if(path==='/api/archive'&&method==='GET'){limit(req,'v3-archive',60,60);ok(res,v3.archive(url.searchParams.get('year')||''));return true;}
    return false;
  };
}
