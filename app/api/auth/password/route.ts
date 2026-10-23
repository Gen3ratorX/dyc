import {createClient} from '@supabase/supabase-js';
import {context} from '../../../../lib/camp-context';
import {authClient} from '../../../../lib/staff-auth';
import {revokeStaffSession} from '../../../../lib/staff-sessions';
import {changeOwnPassword,PasswordChangeError} from '../../../../lib/password-service';
import {StaffInputError} from '../../../../lib/staff-account-input';
import {failure,rateLimit,RequestError,requireSameOrigin,runtime,secureHeaders} from '../../../../lib/server-security';
export async function POST(request:Request){try{
 requireSameOrigin(request);const {db,user}=await context();
 await rateLimit(db,user.userId,'password-change',5);
 const text=await request.text();if(text.length>8192)throw new RequestError('413:Password details are too large.');
 let body;try{body=JSON.parse(text);}catch{throw new RequestError('400:Enter valid password details.');}
 const config=runtime();
 // Isolated verification client: a mistyped current password does not replace
 // the dashboard's cookies or sign the user into another account.
 const provider=createClient(config.SUPABASE_URL!,config.SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const result=await changeOwnPassword({id:user.userId,email:user.email},body,{
  provider,
  revokeSessions:async()=>{await db.prepare('UPDATE staff_sessions SET revoked=1 WHERE user_id=?').bind(user.userId).run();},
  clearSession:async()=>{await revokeStaffSession();const client=await authClient();await client.auth.signOut({scope:'local'});},
 });
 return Response.json(result,{headers:secureHeaders});
}catch(error){return failure(error instanceof PasswordChangeError?new RequestError(`${error.status}:${error.message}`):error instanceof StaffInputError?new RequestError('400:'+error.message):error);}}
