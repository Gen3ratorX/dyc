import {validatePassword} from './staff-account-input';
export class PasswordChangeError extends Error{constructor(readonly status:number,message:string){super(message);}}
type Provider={auth:{signInWithPassword:(input:{email:string;password:string})=>Promise<any>;updateUser:(input:{password:string;current_password:string})=>Promise<any>;signOut:(input:{scope:'global'|'local'})=>Promise<any>}};
export async function changeOwnPassword(actor:{id:string;email:string},value:unknown,deps:{provider:Provider;revokeSessions:()=>Promise<void>;clearSession:()=>Promise<void>}){
 if(!value||typeof value!=='object'||Array.isArray(value))throw new PasswordChangeError(400,'Enter your current and new passwords.');
 const body=value as Record<string,unknown>,current=body.currentPassword;
 if(typeof current!=='string'||!current||current.length>1024)throw new PasswordChangeError(400,'Enter your current password.');
 const password=validatePassword(body.newPassword);
 if(password!==body.confirmPassword)throw new PasswordChangeError(400,'The new passwords do not match.');
 if(password===current)throw new PasswordChangeError(400,'Choose a password different from your current password.');
 const verified=await deps.provider.auth.signInWithPassword({email:actor.email,password:current});
 if(verified.error||verified.data.user?.id!==actor.id)throw new PasswordChangeError(400,'Your current password is incorrect.');
 let updated=false;
 try{
  const result=await deps.provider.auth.updateUser({password,current_password:current});
  if(result.error)throw new PasswordChangeError(400,result.error.code==='weak_password'?'Choose a stronger new password.':'The password could not be updated. Try again.');
  updated=true;
  // Revoke app access immediately, independently of provider JWT expiry.
  let sessionsClosed=true;
  try{await deps.revokeSessions();}catch{sessionsClosed=false;}
  try{const closed=await deps.provider.auth.signOut({scope:'global'});if(closed.error)sessionsClosed=false;}catch{sessionsClosed=false;}
  try{await deps.clearSession();}catch{sessionsClosed=false;}
  return {ok:true,signInRequired:true,sessionsClosed};
 }finally{
  // Also close the short-lived verification session after a rejected update.
  if(!updated)await deps.provider.auth.signOut({scope:'local'}).catch(()=>{});
 }
}
