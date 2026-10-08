import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { passwordHash, passwordVerify, freshToken } from './auth.mjs';
import { uid, now, sha, pureText, httpError } from './domain.mjs';

const schema=fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'identity-schema.sql'),'utf8');
const EMAIL=/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const staffRoles=new Set(['owner','admin','editor','moderator']);
const invitableRoles=new Set(['admin','editor','moderator']);
const safe=(v)=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const normalizedEmail=(input)=>{
  const value=String(input??'').trim().toLowerCase();
  if(value.length>254||!EMAIL.test(value))throw httpError(400,'Enter a valid email address.','INVALID_EMAIL');
  return value;
};
const nameOf=(value)=>{
  const name=pureText(value,80).replace(/\s+/g,' ');
  if(name.length<2||name.length>60)throw httpError(400,'Use a name of 2–60 characters.','INVALID_NAME');
  return name;
};
const strongPassword=(value)=>{
  if(typeof value!=='string'||value.length<12||value.length>128||/\u0000/.test(value)||/password|123456|qwerty/i.test(value))
    throw httpError(400,'Choose a strong password of 12–128 characters.','WEAK_PASSWORD');
  return value;
};
const tokenDigest=(token)=>sha('corner:identity:v2:'+String(token));
const stepMillis=30000;
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const base32encode=(bytes)=>{let out='',value=0,bits=0;for(const byte of bytes){value=(value<<8)|byte;bits+=8;while(bits>=5){out+=alphabet[(value>>>(bits-=5))&31]}}if(bits)out+=alphabet[(value<<(5-bits))&31];return out};
const base32decode=(input)=>{let value=0,bits=0,out=[];for(const char of String(input).replace(/\s|-/g,'').toUpperCase()){const number=alphabet.indexOf(char);if(number<0)throw httpError(400,'Invalid authenticator key.');value=(value<<5)|number;bits+=5;if(bits>=8){out.push((value>>>(bits-=8))&255)}}return Buffer.from(out)};
function totpAt(secret,step){const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(step));const hmac=crypto.createHmac('sha1',base32decode(secret)).update(counter).digest();const offset=hmac[hmac.length-1]&15;const code=(hmac.readUInt32BE(offset)&0x7fffffff)%1000000;return String(code).padStart(6,'0')}
function matchingTotp(secret,code,nowMs=Date.now(),lastStep=-1){if(!/^\d{6}$/.test(String(code)))return null;const current=Math.floor(nowMs/stepMillis);for(const step of [current-1,current,current+1]){if(step<=lastStep)continue;const candidate=totpAt(secret,step);if(crypto.timingSafeEqual(Buffer.from(candidate),Buffer.from(String(code))))return step}return null}
function keyFrom(env){const secret=String(env.SESSION_SECRET||'');if(secret.length<32)throw httpError(503,'Authenticator setup unavailable.','MFA_UNAVAILABLE');return crypto.createHash('sha256').update('corner-mfa-v1:'+secret).digest()}
const encrypt=(secret,env)=>{const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',keyFrom(env),iv);const bytes=Buffer.concat([cipher.update(secret,'utf8'),cipher.final()]);return ['v1',iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),bytes.toString('base64url')].join('.')};
const decrypt=(encoded,env)=>{const [version,viv,vtag,vbody]=String(encoded).split('.');if(version!=='v1')throw Error('Invalid MFA key version');const decipher=crypto.createDecipheriv('aes-256-gcm',keyFrom(env),Buffer.from(viv,'base64url'));decipher.setAuthTag(Buffer.from(vtag,'base64url'));return decipher.update(Buffer.from(vbody,'base64url'),undefined,'utf8')+decipher.final('utf8')};
const expiry=(minutes)=>new Date(Date.now()+minutes*60000).toISOString();

/** Never return provider keys, password hashes, MFA secrets or raw token hashes through API. */
export class IdentityService{
  constructor(store,{env=process.env,sendEmail}={}){
    this.store=store;
    this.env=env;
    this.sender=sendEmail || ((mail)=>this.sendResend(mail));
    store.db.exec(schema);
    const owner=store.owner();
    if(owner&&!store.one('SELECT user_id FROM identity_profiles WHERE user_id=?',owner.id)){
      store.exec('INSERT INTO identity_profiles(user_id,verified_at,created_at,updated_at) VALUES(?,?,?,?)',owner.id,owner.created_at,now(),now());
    }
  }
  canRegister(){return this.env.CORNER_AUTH_REGISTRATION_ENABLED==='1'&&this.emailReady()}
  emailReady(){return !!this.env.CORNER_AUTH_TEST_OUTBOX && this.env.NODE_ENV==='test' || !!(this.env.CORNER_AUTH_RESEND_API_KEY&&this.env.CORNER_AUTH_FROM_EMAIL)}
  async sendResend({to,subject,text,html,reference}){
    if(this.env.NODE_ENV==='test'&&this.env.CORNER_AUTH_TEST_OUTBOX){
      fs.appendFileSync(this.env.CORNER_AUTH_TEST_OUTBOX,JSON.stringify({to,subject,text,reference})+'\n',{mode:0o600});
      return;
    }
    if(!this.emailReady())throw httpError(503,'Account email is not configured.','EMAIL_UNAVAILABLE');
    const response=await fetch('https://api.resend.com/emails',{
      method:'POST',signal:AbortSignal.timeout(12000),
      headers:{authorization:'Bearer '+this.env.CORNER_AUTH_RESEND_API_KEY,'content-type':'application/json','idempotency-key':reference},
      body:JSON.stringify({from:this.env.CORNER_AUTH_FROM_EMAIL,to:[to],subject,text,html})
    });
    if(!response.ok)throw httpError(502,'Account email could not be delivered. Please try again.','EMAIL_DELIVERY_FAILED');
  }
  issueToken(userId,email,purpose,minutes){
    const token=freshToken(),created=now();
    this.store.transaction(()=>{
      this.store.exec('UPDATE identity_tokens SET consumed_at=? WHERE user_id=? AND purpose=? AND consumed_at IS NULL',created,userId,purpose);
      this.store.exec('INSERT INTO identity_tokens(id,user_id,email,purpose,token_hash,expires_at,created_at) VALUES(?,?,?,?,?,?,?)',uid('auth'),userId,email,purpose,tokenDigest(token),expiry(minutes),created);
    });
    return token;
  }
  async emailLink(to,subject,basePath,token,fragment,reference){
    const destination=(this.env.SITE_URL||'http://localhost:4141').replace(/\/$/,'')+'/'+basePath+'#token='+encodeURIComponent(token);
    const text=`${subject}\n\nOpen this secure link:\n${destination}\n\nThis link expires soon. If you did not request it, you can ignore this email.`;
    await this.sender({to,subject,text,html:`<p>${safe(subject)}</p><p><a href="${safe(destination)}">Continue to Vamsi's Corner</a></p><p>If you did not request this, ignore the message.</p>`,reference});
  }
  getProfile(userId){return this.store.one('SELECT * FROM identity_profiles WHERE user_id=?',userId)}
  account(userId){return this.store.one('SELECT * FROM users WHERE id=? AND disabled_at IS NULL',userId)}
  safeMe(user){
    if(!user)return null;
    const profile=this.getProfile(user.id),mfa=this.store.one('SELECT enabled_at FROM identity_mfa WHERE user_id=?',user.id);
    return {id:user.id,email:user.email,displayName:user.display_name,role:user.role,verified:!!profile?.verified_at,bio:profile?.bio||'',locale:profile?.locale||'en',emailUpdates:!!profile?.email_updates,visibility:'private',mfaEnabled:!!mfa?.enabled_at,createdAt:user.created_at||null,lastLoginAt:user.last_login_at||null};
  }
  findByEmail(email){return this.store.one('SELECT * FROM users WHERE email=? AND disabled_at IS NULL',email)}
  async registerMember(data){
    if(!this.canRegister())throw httpError(503,'Registration is not open yet.','REGISTRATION_DISABLED');
    const email=normalizedEmail(data.email),name=nameOf(data.name),password=strongPassword(data.password);
    let user=this.findByEmail(email);
    if(!user){
      const id=uid('usr'),stamp=now();
      this.store.transaction(()=>{
        this.store.exec('INSERT INTO users(id,email,display_name,role,password_hash,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',id,email,name,'member',passwordHash(password),stamp,stamp);
        this.store.exec('INSERT INTO identity_profiles(user_id,created_at,updated_at) VALUES(?,?,?)',id,stamp,stamp);
        this.store.audit(id,'account.registered','user',id);
      });
      user=this.account(id);
    }
    if(user.role==='member'&&!this.getProfile(user.id)?.verified_at){
      const token=this.issueToken(user.id,email,'verify-email',30);
      await this.emailLink(email,'Verify your Corner account','verify-email',token,'verify-email','corner-verify-'+user.id+'-'+Date.now());
    }
    return {accepted:true,message:'If eligible, a verification message is on its way.'};
  }
  async resendEmail(data){
    if(!this.canRegister())throw httpError(503,'Account email is not configured.','EMAIL_UNAVAILABLE');
    const email=normalizedEmail(data.email),user=this.findByEmail(email);
    if(user?.role==='member'&&!this.getProfile(user.id)?.verified_at){
      const token=this.issueToken(user.id,email,'verify-email',30);
      await this.emailLink(email,'Verify your Corner account','verify-email',token,'verify-email','corner-resend-'+user.id+'-'+Date.now());
    }
    return {accepted:true,message:'If eligible, a verification message is on its way.'};
  }
  consumeToken(raw,purpose){
    if(typeof raw!=='string'||raw.length<24||raw.length>255)throw httpError(400,'Invalid or expired link.','TOKEN_INVALID');
    const stamp=now(),hash=tokenDigest(raw);
    const row=this.store.one('SELECT * FROM identity_tokens WHERE token_hash=? AND purpose=? AND consumed_at IS NULL AND expires_at>?',hash,purpose,stamp);
    if(!row)throw httpError(400,'Invalid or expired link.','TOKEN_INVALID');
    this.store.exec('UPDATE identity_tokens SET consumed_at=? WHERE id=? AND consumed_at IS NULL',stamp,row.id);
    return row;
  }
  verifyEmail(data){
    let userId;
    this.store.transaction(()=>{
      const token=this.consumeToken(data.token,'verify-email');userId=token.user_id;
      this.store.exec('UPDATE identity_profiles SET verified_at=COALESCE(verified_at,?),updated_at=? WHERE user_id=?',now(),now(),userId);
      this.store.audit(userId,'email.verified','user',userId);
    });
    return {verified:true};
  }
  async forgotPassword(data){
    if(!this.emailReady())throw httpError(503,'Account email is not configured.','EMAIL_UNAVAILABLE');
    const email=normalizedEmail(data.email),user=this.findByEmail(email);
    if(user&&this.getProfile(user.id)?.verified_at){
      const token=this.issueToken(user.id,email,'reset-password',20);
      await this.emailLink(email,'Reset your Corner password','reset-password',token,'reset-password','corner-reset-'+user.id+'-'+Date.now());
    }
    return {accepted:true,message:'If an account exists, password reset instructions will arrive.'};
  }
  resetPassword(data){
    const pass=strongPassword(data.password);
    this.store.transaction(()=>{
      const token=this.consumeToken(data.token,'reset-password');
      this.store.exec('UPDATE users SET password_hash=?,updated_at=? WHERE id=?',passwordHash(pass),now(),token.user_id);
      this.store.exec('UPDATE sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL',now(),token.user_id);
      this.store.audit(token.user_id,'password.reset','user',token.user_id);
    });
    return {changed:true};
  }
  changePassword(user,data){
    const row=this.account(user.id);
    if(!row||!passwordVerify(data.currentPassword,row.password_hash))throw httpError(403,'Current password is incorrect.','INVALID_PASSWORD');
    const next=strongPassword(data.newPassword);
    this.store.transaction(()=>{
      this.store.exec('UPDATE users SET password_hash=?,updated_at=? WHERE id=?',passwordHash(next),now(),user.id);
      this.store.exec('UPDATE sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL',now(),user.id);
      this.store.audit(user.id,'password.changed','user',user.id);
    });
    return {changed:true,allSessionsRevoked:true};
  }
  async requestEmailChange(actor,data){
    if(!this.emailReady())throw httpError(503,'Account email is not configured.','EMAIL_UNAVAILABLE');
    if(actor.role==='owner')throw httpError(409,'Owner email changes require a coordinated Railway configuration update.','OWNER_EMAIL_MANAGED');
    const row=this.account(actor.id);
    if(!row||!passwordVerify(data.currentPassword,row.password_hash))throw httpError(403,'Current password is incorrect.','INVALID_PASSWORD');
    const email=normalizedEmail(data.newEmail);
    if(email===row.email)return {accepted:true,message:'The address is already up to date.'};
    if(this.store.one('SELECT 1 FROM users WHERE email=?',email))throw httpError(409,'That email address cannot be used.','EMAIL_CONFLICT');
    const token=this.issueToken(row.id,email,'change-email',20);
    await this.emailLink(email,'Confirm your new Corner email','confirm-email',token,'change-email','corner-email-change-'+row.id+'-'+Date.now());
    this.store.audit(actor.id,'email.change.requested','user',actor.id);
    return {accepted:true,message:'Check the new email address to confirm the change.'};
  }
  confirmEmailChange(data){
    let changed;
    this.store.transaction(()=>{
      const token=this.consumeToken(data.token,'change-email');
      const account=this.account(token.user_id);
      if(!account||account.role==='owner')throw httpError(409,'This email change cannot be completed.','EMAIL_CHANGE_UNAVAILABLE');
      if(this.store.one('SELECT 1 FROM users WHERE email=? AND id<>?',token.email,account.id))throw httpError(409,'That email address cannot be used.','EMAIL_CONFLICT');
      this.store.exec('UPDATE users SET email=?,updated_at=? WHERE id=?',token.email,now(),account.id);
      this.store.exec('UPDATE identity_profiles SET verified_at=?,updated_at=? WHERE user_id=?',now(),now(),account.id);
      this.store.exec('UPDATE sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL',now(),account.id);
      this.store.audit(account.id,'email.changed','user',account.id);
      changed=token.email;
    });
    return {changed:true,email:changed,allSessionsRevoked:true};
  }
  loginMember(data,ip='',agent=''){
    const email=normalizedEmail(data.email),user=this.findByEmail(email);
    if(!user||user.role!=='member'||!passwordVerify(String(data.password||''),user.password_hash))throw httpError(401,'Email or password not recognized.','AUTH_FAILED');
    if(!this.getProfile(user.id)?.verified_at)throw httpError(403,'Verify your email before signing in.','EMAIL_NOT_VERIFIED');
    const token=freshToken(),expires=this.store.createSession(user,token,ip,agent,24*7);
    return {token,expires,user:this.safeMe(this.account(user.id))};
  }
  async invite(actor,data){
    if(actor.role!=='owner')throw httpError(403,'Owner authorization required.','OWNER_REQUIRED');
    if(!this.store.one('SELECT 1 FROM identity_mfa WHERE user_id=? AND enabled_at IS NOT NULL',actor.id))
      throw httpError(403,'Enable owner authenticator verification before inviting collaborators.','MFA_REQUIRED');
    if(!this.emailReady())throw httpError(503,'Account email is not configured.','EMAIL_UNAVAILABLE');
    const email=normalizedEmail(data.email),role=String(data.role||'');
    if(!invitableRoles.has(role))throw httpError(400,'Invalid staff role.','ROLE_INVALID');
    if(this.findByEmail(email))throw httpError(409,'This email already has an account.','ACCOUNT_EXISTS');
    const token=freshToken(),id=uid('invite'),stamp=now();
    this.store.exec('INSERT INTO identity_invitations(id,email,role,token_hash,invited_by,expires_at,created_at) VALUES(?,?,?,?,?,?,?)',id,email,role,tokenDigest(token),actor.id,expiry(48*60),stamp);
    await this.emailLink(email,'Your private Corner studio invitation','admin/register',token,'admin-invite','corner-invite-'+id);
    this.store.audit(actor.id,'staff.invited','identity_invitation',id,{role});
    return {sent:true,expiresInHours:48};
  }
  registerStaff(data){
    const email=normalizedEmail(data.email),name=nameOf(data.name),pass=strongPassword(data.password),token=String(data.token||'');
    if(token.length<24||token.length>255)throw httpError(400,'Invitation is invalid or expired.','INVITE_INVALID');
    const invite=this.store.one('SELECT * FROM identity_invitations WHERE token_hash=? AND accepted_at IS NULL AND expires_at>?',tokenDigest(token),now());
    if(!invite||invite.email!==email||!invitableRoles.has(invite.role))throw httpError(400,'Invitation is invalid or expired.','INVITE_INVALID');
    if(this.findByEmail(email))throw httpError(409,'Account already registered.','ACCOUNT_EXISTS');
    const id=uid('usr'),stamp=now();
    this.store.transaction(()=>{
      const claimed=this.store.exec('UPDATE identity_invitations SET accepted_at=? WHERE id=? AND accepted_at IS NULL',stamp,invite.id);
      if(claimed.changes!==1)throw httpError(409,'Invitation already used.','INVITE_USED');
      this.store.exec('INSERT INTO users(id,email,display_name,role,password_hash,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',id,email,name,invite.role,passwordHash(pass),stamp,stamp);
      this.store.exec('INSERT INTO identity_profiles(user_id,verified_at,created_at,updated_at) VALUES(?,?,?,?)',id,stamp,stamp,stamp);
      this.store.audit(id,'staff.invitation.accepted','user',id,{role:invite.role});
    });
    return {created:true,mfaSetupRequired:true};
  }
  beginChallenge(userId){const token=freshToken(),id=uid('mfach'),stamp=now();this.store.exec('INSERT INTO identity_challenges(id,user_id,challenge_hash,purpose,expires_at,created_at) VALUES(?,?,?,?,?,?)',id,userId,tokenDigest(token),'mfa-enrol',expiry(10),stamp);return token}
  challenge(raw){if(typeof raw!=='string'||raw.length<24||raw.length>255)throw httpError(401,'MFA setup session expired.','CHALLENGE_EXPIRED');const row=this.store.one('SELECT * FROM identity_challenges WHERE challenge_hash=? AND purpose=? AND expires_at>? AND consumed_at IS NULL',tokenDigest(raw),'mfa-enrol',now());if(!row)throw httpError(401,'MFA setup session expired.','CHALLENGE_EXPIRED');return row}
  loginAdmin(data,ip='',agent=''){
    const email=normalizedEmail(data.email),user=this.findByEmail(email);
    if(!user||!staffRoles.has(user.role)||!passwordVerify(String(data.password||''),user.password_hash))throw httpError(401,'Email or password not recognized.','AUTH_FAILED');
    if(user.role!=='owner'&&!this.getProfile(user.id)?.verified_at)throw httpError(403,'Verify your email.','EMAIL_NOT_VERIFIED');
    const factor=this.store.one('SELECT * FROM identity_mfa WHERE user_id=?',user.id);
    if(!factor?.enabled_at&&user.role!=='owner')return {mfaSetupRequired:true,challenge:this.beginChallenge(user.id)};
    if(factor?.enabled_at){
      if(!data.code)throw httpError(428,'Enter your authenticator or recovery code.','MFA_REQUIRED');
      if(!this.checkMfa(user.id,data.code))throw httpError(401,'Invalid or already used authenticator code.','MFA_INVALID');
    }
    const token=freshToken(),expires=this.store.createSession(user,token,ip,agent);
    return {token,expires,user:this.safeMe(this.account(user.id))};
  }
  beginMfa({challenge,actor}){
    const pending=challenge?this.challenge(challenge):null;
    if(!pending&&(!actor||!staffRoles.has(actor.role)))throw httpError(401,'Privileged sign-in required.','AUTH_REQUIRED');
    const userId=pending?.user_id||actor.id;
    const existing=this.store.one('SELECT * FROM identity_mfa WHERE user_id=?',userId);
    if(existing?.enabled_at)throw httpError(409,'MFA already enabled.','MFA_ENABLED');
    const setupToken=pending?challenge:this.beginChallenge(userId);
    const secret=base32encode(crypto.randomBytes(20));
    this.store.exec('INSERT INTO identity_mfa(user_id,secret_ciphertext,created_at,enabled_at,last_step) VALUES(?,?,?,NULL,-1) ON CONFLICT(user_id) DO UPDATE SET secret_ciphertext=excluded.secret_ciphertext,created_at=excluded.created_at,enabled_at=NULL,last_step=-1',userId,encrypt(secret,this.env),now());
    const user=this.account(userId);
    const issuer='VamsisCorner',uri='otpauth://totp/'+encodeURIComponent(issuer+':'+user.email)+'?secret='+encodeURIComponent(secret)+'&issuer='+issuer+'&algorithm=SHA1&digits=6&period=30';
    return {challenge:setupToken,secret,otpauth:uri};
  }
  activateMfa(data,ip='',agent=''){
    const pending=this.challenge(data.challenge),user=this.account(pending.user_id);
    if(!user||!staffRoles.has(user.role))throw httpError(403,'Privileged account required.','ROLE_FORBIDDEN');
    const factor=this.store.one('SELECT * FROM identity_mfa WHERE user_id=?',user.id);
    if(!factor||factor.enabled_at)throw httpError(400,'Authenticator setup is unavailable.','MFA_NOT_READY');
    const step=matchingTotp(decrypt(factor.secret_ciphertext,this.env),data.code);
    if(step===null)throw httpError(401,'Authenticator code is incorrect.','MFA_INVALID');
    const codes=Array.from({length:8},()=>crypto.randomBytes(8).toString('hex').toUpperCase().match(/.{1,4}/g).join('-'));
    this.store.transaction(()=>{
      const claimed=this.store.exec('UPDATE identity_challenges SET consumed_at=? WHERE id=? AND consumed_at IS NULL',now(),pending.id);
      if(claimed.changes!==1)throw httpError(401,'Authenticator setup expired.','CHALLENGE_EXPIRED');
      this.store.exec('UPDATE identity_mfa SET enabled_at=?,last_step=? WHERE user_id=?',now(),step,user.id);
      // Earlier sessions did not present a second factor. Invalidate them
      // before minting a new MFA-verified session.
      this.store.exec('UPDATE sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL',now(),user.id);
      for(const code of codes)this.store.exec('INSERT INTO identity_mfa_recovery(user_id,code_hash,created_at) VALUES(?,?,?)',user.id,tokenDigest(code),now());
      this.store.audit(user.id,'mfa.enabled','user',user.id);
    });
    const token=freshToken(),expires=this.store.createSession(user,token,ip,agent);
    return {token,expires,recoveryCodes:codes,user:this.safeMe(this.account(user.id))};
  }
  checkMfa(userId,raw){
    const factor=this.store.one('SELECT * FROM identity_mfa WHERE user_id=? AND enabled_at IS NOT NULL',userId);
    if(!factor)return false;
    const code=String(raw||'').trim();
    if(/^\d{6}$/.test(code)){
      const step=matchingTotp(decrypt(factor.secret_ciphertext,this.env),code,Date.now(),factor.last_step);
      if(step===null)return false;
      const updated=this.store.exec('UPDATE identity_mfa SET last_step=? WHERE user_id=? AND last_step<?',step,userId,step);
      return updated.changes===1;
    }
    if(!/^[0-9A-F]{4}(?:-[0-9A-F]{4}){3}$/i.test(code))return false;
    const used=this.store.exec('UPDATE identity_mfa_recovery SET used_at=? WHERE user_id=? AND code_hash=? AND used_at IS NULL',now(),userId,tokenDigest(code.toUpperCase()));
    return used.changes===1;
  }
  updateProfile(actor,data){
    const name=nameOf(data.displayName),bio=pureText(data.bio??'',280),locale=String(data.locale||'en');
    if(!['en','te','hi'].includes(locale))throw httpError(400,'Choose a supported language.','INVALID_LOCALE');
    const emailUpdates=data.emailUpdates===true?1:0;
    this.store.transaction(()=>{
      this.store.exec('UPDATE users SET display_name=?,updated_at=? WHERE id=?',name,now(),actor.id);
      this.store.exec('UPDATE identity_profiles SET bio=?,locale=?,email_updates=?,updated_at=? WHERE user_id=?',bio,locale,emailUpdates,now(),actor.id);
      this.store.audit(actor.id,'profile.updated','user',actor.id);
    });
    return this.safeMe(this.account(actor.id));
  }
  sessions(actor){return this.store.all('SELECT id,created_at,expires_at,revoked_at FROM sessions WHERE user_id=? ORDER BY created_at DESC LIMIT 50',actor.id)}
  revokeSession(actor,sessionId){const affected=this.store.exec('UPDATE sessions SET revoked_at=? WHERE id=? AND user_id=? AND revoked_at IS NULL',now(),sessionId,actor.id);return {revoked:affected.changes===1}}
  bookmarks(actor){return this.store.all("SELECT posts.id,posts.slug,posts.title,posts.type,identity_bookmarks.created_at AS saved_at FROM identity_bookmarks JOIN posts ON posts.id=identity_bookmarks.post_id WHERE identity_bookmarks.user_id=? AND posts.state='published' ORDER BY identity_bookmarks.created_at DESC LIMIT 200",actor.id)}
  addBookmark(actor,postId){const post=this.store.getPostById(postId);if(!post)throw httpError(404,'Published post not found.');this.store.exec('INSERT OR IGNORE INTO identity_bookmarks(user_id,post_id,created_at) VALUES(?,?,?)',actor.id,postId,now());return {saved:true,postId}}
  removeBookmark(actor,postId){this.store.exec('DELETE FROM identity_bookmarks WHERE user_id=? AND post_id=?',actor.id,postId);return {saved:false,postId}}
  requestPrivacy(actor,type){if(!['export','deletion'].includes(type))throw httpError(400,'Unsupported privacy request.');const row=this.store.one("SELECT id FROM identity_privacy_requests WHERE user_id=? AND request_type=? AND state IN ('requested','reviewing')",actor.id,type);if(row)return {requestId:row.id,state:'requested'};const id=uid('rights');this.store.exec('INSERT INTO identity_privacy_requests(id,user_id,request_type,requested_at) VALUES(?,?,?,?)',id,actor.id,type,now());this.store.audit(actor.id,'privacy.'+type+'.requested','user',actor.id);return {requestId:id,state:'requested'}}
  exportData(actor){const user=this.safeMe(this.account(actor.id));return {account:user,bookmarks:this.bookmarks(actor),sessions:this.sessions(actor),privacyRequests:this.store.all('SELECT id,request_type,state,requested_at,completed_at FROM identity_privacy_requests WHERE user_id=?',actor.id)}}
}

export function staffPermission(role,pathName,method='GET'){
  if(role==='owner'||role==='admin')return true;
  if(role==='editor')return /^\/api\/admin\/(posts(?:\/|$)|media(?:\/|$)|status$)/.test(pathName);
  if(role==='moderator')return /^\/api\/admin\/comments(?:\/|$)/.test(pathName);
  return false;
}
export function privilegedRole(role){return staffRoles.has(role)}
export const identityInternals={normalizedEmail,strongPassword,totpAt,matchingTotp,base32encode,base32decode,tokenDigest};
