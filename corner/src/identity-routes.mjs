import { httpError } from './domain.mjs';
import { privilegedRole } from './identity.mjs';

const safeCookie=(cookies,name)=>{try{return decodeURIComponent(cookies[name]||'')}catch{return ''}};
const cookieFor=(name,token,seconds,basePath,production)=>{
  const attrs=[`${name}=${encodeURIComponent(token||'')}`,`Path=${basePath||'/'}`,'HttpOnly','SameSite=Strict',`Max-Age=${seconds}`];
  if(production)attrs.push('Secure');
  return attrs.join('; ');
};
export const isIdentityPath=(path)=>path==='/api/admin/invitations'||path==='/api/auth/session'||path.startsWith('/api/auth/')||path==='/api/me'||path.startsWith('/api/me/');

/**
 * Private account endpoints run before the existing owner Studio API. No route can
 * elevate a member role from a request body, cookie name, or API version alias.
 * Registration is feature-gated until the email provider has been verified.
 */
export function identityRoutes({ identity,store,config,readJSON,ok,json,limit,sourceIp,cookieHeader }){
  const fail=(status,message,code)=>{throw httpError(status,message,code)};
  const memberCookie=(token='',seconds=0)=>cookieFor('corner_member_session',token,seconds,config.basePath,config.prod);
  const staffCookie=(token='',seconds=0)=>cookieFor('corner_session',token,seconds,config.basePath,config.prod);
  const current=(req)=>{
    const cookies=cookieHeader(req),admin=store.session(safeCookie(cookies,'corner_session'));
    if(admin&&privilegedRole(admin.role))return {actor:admin,type:'admin',token:safeCookie(cookies,'corner_session')};
    const member=store.session(safeCookie(cookies,'corner_member_session'));
    if(member&&member.role==='member'&&identity.getProfile(member.id)?.verified_at)return {actor:member,type:'member',token:safeCookie(cookies,'corner_member_session')};
    return null;
  };
  const requireUser=(req)=>current(req)||fail(401,'Sign in to continue.','AUTH_REQUIRED');
  const staffOwner=(req)=>{
    const result=current(req);
    if(!result||result.type!=='admin')fail(401,'Owner sign-in required.','AUTH_REQUIRED');
    if(result.actor.role!=='owner')fail(403,'Only the owner can invite administrators.','OWNER_REQUIRED');
    return result.actor;
  };
  const jsonResult=(res,data,status=200,headers={})=>json(res,{data,meta:{}},status,headers);
  return async function handle(req,res,path){
    if(!isIdentityPath(path))return false;
    const method=req.method||'GET';
    if(path==='/api/auth/session'&&method==='GET'){
      const user=current(req);
      return jsonResult(res,{authenticated:!!user,scope:user?.type||null,user:user?identity.safeMe(identity.account(user.actor.id)):null});
    }
    if(path==='/api/auth/register'&&method==='POST'){
      limit(req,'member-register',4,3600);const output=await identity.registerMember(await readJSON(req,6000));
      return jsonResult(res,output,202);
    }
    if(path==='/api/auth/email/resend'&&method==='POST'){
      limit(req,'verify-resend',3,1800);return jsonResult(res,await identity.resendEmail(await readJSON(req,1500)),202);
    }
    if(path==='/api/auth/email/verify'&&method==='POST'){
      limit(req,'verify-email',12,600);return jsonResult(res,identity.verifyEmail(await readJSON(req,2500)));
    }
    if(path==='/api/auth/login'&&method==='POST'){
      limit(req,'member-login',7,900);
      const result=identity.loginMember(await readJSON(req,4000),sourceIp(req),req.headers['user-agent']||'');
      res.setHeader('set-cookie',memberCookie(result.token,7*24*3600));
      return jsonResult(res,{authenticated:true,scope:'member',expires:result.expires,user:result.user});
    }
    if(path==='/api/auth/admin/login'&&method==='POST'){
      limit(req,'staff-login',7,900);
      const result=identity.loginAdmin(await readJSON(req,4000),sourceIp(req),req.headers['user-agent']||'');
      if(result.token){res.setHeader('set-cookie',staffCookie(result.token,8*3600));return jsonResult(res,{authenticated:true,scope:'admin',expires:result.expires,user:result.user})}
      return jsonResult(res,result);
    }
    if(path==='/api/admin/invitations'&&method==='POST'){
      limit(req,'admin-invite',8,3600);
      return jsonResult(res,await identity.invite(staffOwner(req),await readJSON(req,3500)),202);
    }
    if(path==='/api/auth/admin/register'&&method==='POST'){
      limit(req,'staff-register',5,3600);
      return jsonResult(res,identity.registerStaff(await readJSON(req,5000)),201);
    }
    if(path==='/api/auth/mfa/setup'&&method==='POST'){
      limit(req,'mfa-setup',6,900);const payload=await readJSON(req,3000),user=current(req);
      return jsonResult(res,identity.beginMfa({challenge:payload.challenge,actor:user?.type==='admin'?user.actor:null}));
    }
    if(path==='/api/auth/mfa/activate'&&method==='POST'){
      limit(req,'mfa-activate',7,900);
      const result=identity.activateMfa(await readJSON(req,3500),sourceIp(req),req.headers['user-agent']||'');
      res.setHeader('set-cookie',staffCookie(result.token,8*3600));
      return jsonResult(res,{authenticated:true,recoveryCodes:result.recoveryCodes,user:result.user});
    }
    if(path==='/api/auth/password/forgot'&&method==='POST'){
      limit(req,'forgot-password',4,3600);return jsonResult(res,await identity.forgotPassword(await readJSON(req,1400)),202);
    }
    if(path==='/api/auth/password/reset'&&method==='POST'){
      limit(req,'reset-password',5,900);return jsonResult(res,identity.resetPassword(await readJSON(req,4000)));
    }
    if(path==='/api/auth/email/change'&&method==='POST'){
      const user=requireUser(req);limit(req,'change-email',4,3600);
      return jsonResult(res,await identity.requestEmailChange(user.actor,await readJSON(req,4000)),202);
    }
    if(path==='/api/auth/email/confirm'&&method==='POST'){
      limit(req,'confirm-email-change',8,3600);
      return jsonResult(res,identity.confirmEmailChange(await readJSON(req,3000)));
    }
    if(path==='/api/auth/logout'&&method==='POST'){
      const cookies=cookieHeader(req),currentUser=current(req);
      for(const name of ['corner_member_session','corner_session']){
        const token=safeCookie(cookies,name);if(token)store.revokeSession(token);
      }
      res.setHeader('set-cookie',[memberCookie(),staffCookie()]);
      return jsonResult(res,{authenticated:false,scope:currentUser?.type||null});
    }
    if(path==='/api/auth/password/change'&&method==='POST'){
      limit(req,'change-password',6,900);const user=requireUser(req);
      const result=identity.changePassword(user.actor,await readJSON(req,5000));
      res.setHeader('set-cookie',[memberCookie(),staffCookie()]);
      return jsonResult(res,result);
    }
    if(path==='/api/me'&&method==='GET'){
      const user=requireUser(req);return jsonResult(res,identity.safeMe(identity.account(user.actor.id)));
    }
    if(path==='/api/me'&&method==='PATCH'){
      const user=requireUser(req);limit(req,'profile-update',30,3600);
      return jsonResult(res,identity.updateProfile(user.actor,await readJSON(req,5500)));
    }
    if(path==='/api/me/preferences'&&method==='GET'){
      const user=requireUser(req),profile=identity.safeMe(identity.account(user.actor.id));
      return jsonResult(res,{locale:profile.locale,emailUpdates:profile.emailUpdates,visibility:'private'});
    }
    if(path==='/api/me/preferences'&&method==='PATCH'){
      const user=requireUser(req),data=await readJSON(req,1500),profile=identity.safeMe(identity.account(user.actor.id));
      return jsonResult(res,identity.updateProfile(user.actor,{displayName:profile.displayName,bio:profile.bio,locale:data.locale??profile.locale,emailUpdates:data.emailUpdates??profile.emailUpdates}));
    }
    if(path==='/api/me/sessions'&&method==='GET'){
      const user=requireUser(req);return jsonResult(res,identity.sessions(user.actor));
    }
    const sessionId=path.match(/^\/api\/me\/sessions\/([A-Za-z0-9_-]+)$/);
    if(sessionId&&method==='DELETE'){
      const user=requireUser(req);return jsonResult(res,identity.revokeSession(user.actor,sessionId[1]));
    }
    if(path==='/api/me/bookmarks'&&method==='GET'){
      const user=requireUser(req);return jsonResult(res,identity.bookmarks(user.actor));
    }
    if(path==='/api/me/bookmarks'&&method==='POST'){
      const user=requireUser(req),data=await readJSON(req,1000);
      return jsonResult(res,identity.addBookmark(user.actor,String(data.postId||'')));
    }
    const bookmark=path.match(/^\/api\/me\/bookmarks\/([A-Za-z0-9_-]+)$/);
    if(bookmark&&method==='DELETE'){
      const user=requireUser(req);return jsonResult(res,identity.removeBookmark(user.actor,bookmark[1]));
    }
    if(path==='/api/me/export'&&method==='POST'){
      const user=requireUser(req);limit(req,'account-export',3,3600);
      identity.requestPrivacy(user.actor,'export');return jsonResult(res,identity.exportData(user.actor));
    }
    if(path==='/api/me/deletion'&&method==='POST'){
      const user=requireUser(req);limit(req,'account-delete',3,3600);
      return jsonResult(res,identity.requestPrivacy(user.actor,'deletion'),202);
    }
    fail(405,'Method not allowed.','METHOD_NOT_ALLOWED');
  };
}
