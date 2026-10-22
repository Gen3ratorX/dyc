import { authClient } from '../../../../lib/staff-auth';
import { createStaffSession } from '../../../../lib/staff-sessions';
import { failure, rateLimit, RequestError, requireSameOrigin, runtime, secureHeaders } from '../../../../lib/server-security';
export async function POST(request:Request){try{
  requireSameOrigin(request);const config=runtime();
  if(!config.DB||!config.APP_ORIGIN)throw new RequestError('503:Staff sign-in is awaiting administrator setup.');
  const text=await request.text();if(text.length>4096)throw new RequestError('413:Request too large.');
  let body;try{body=JSON.parse(text);}catch{throw new RequestError('400:Enter a valid email address.');}
  if(!body||typeof body!=='object'||Array.isArray(body))throw new RequestError('400:Enter your staff email and password.');
  const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
  const password=typeof body.password==='string'?body.password:'';
  if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new RequestError('400:Enter a valid email address.');
  if(!password||password.length>1024)throw new RequestError('400:Enter your staff password.');
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(email)))).map(x=>x.toString(16).padStart(2,'0')).join('');
  await rateLimit(config.DB,digest,'login-email',5);
  await rateLimit(config.DB,request.headers.get('cf-connecting-ip')||'unknown','login-ip',30);
  const client=await authClient();
  const member=await config.DB.prepare('SELECT active FROM members WHERE email=?').bind(email).first<{active:number}>();
  const eligible=member?.active===1||email===config.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  // Accounts are provisioned by an administrator. Signing in never creates an
  // account or sends a verification message.
  const {data,error}=await client.auth.signInWithPassword({email,password});
  if(error||!data.user||!eligible){
    if(data.user)await client.auth.signOut({scope:'local'});
    throw new RequestError('401:Staff email or password is incorrect, or access has not been approved.');
  }
  await createStaffSession(data.user.id);
  return Response.json({ok:true,next:'/'},{headers:secureHeaders});
}catch(error){return failure(error);}}
