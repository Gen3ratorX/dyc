import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { ChatGPTUser } from '../app/chatgpt-auth';
import { RequestError, runtime } from './server-security';
import { verifyStaffSession } from './staff-sessions';

export async function authClient(){
  const config=runtime();
  if(!config.SUPABASE_URL||!config.SUPABASE_PUBLISHABLE_KEY)throw new RequestError('503:Staff sign-in has not been configured. Contact the camp administrator.');
  const provider=new URL(config.SUPABASE_URL);
  if(provider.protocol!=='https:')throw new RequestError('503:Staff sign-in requires a secure authentication provider.');
  const jar=await cookies();
  return createServerClient(config.SUPABASE_URL,config.SUPABASE_PUBLISHABLE_KEY,{
    cookieOptions:{httpOnly:true,secure:true,sameSite:'lax',path:'/'},
    cookies:{getAll:()=>jar.getAll(),setAll:items=>{for(const {name,value,options} of items)jar.set(name,value,{...options,httpOnly:true,secure:true,sameSite:'lax',path:'/'});}},
  });
}
export async function getStaffUser():Promise<ChatGPTUser|null>{
  const config=runtime();
  const client=await authClient();
  // Never authorize using an unverified cookie payload or getSession().
  const {data,error}=await client.auth.getUser();
  if(error||!data.user?.email||!data.user.email_confirmed_at||!await verifyStaffSession(data.user.id))return null;
  return {userId:data.user.id,email:data.user.email.toLowerCase(),displayName:String(data.user.user_metadata?.full_name||data.user.email),fullName:null};
}
