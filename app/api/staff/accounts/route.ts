import {context} from '../../../../lib/camp-context';
import {authClient} from '../../../../lib/staff-auth';
import {staffSessionDigest} from '../../../../lib/staff-sessions';
import {accountInput,canManageStaff,StaffInputError} from '../../../../lib/staff-account-input';
import {failure,rateLimit,RequestError,requireSameOrigin,runtime,secureHeaders} from '../../../../lib/server-security';
export async function POST(request:Request){try{
 requireSameOrigin(request);const actor=await context();
 if(!canManageStaff(actor))throw new RequestError('403:Only a camp administrator can create staff accounts.');
 await rateLimit(actor.db,actor.user.userId,'account-create',10);
 const text=await request.text();if(text.length>8192)throw new RequestError('413:Account details are too large.');
 let body;try{body=JSON.parse(text);}catch{throw new RequestError('400:Enter valid account details.');}
 const input=accountInput(body),client=await authClient();
 const {data,error}=await client.auth.getSession(),sessionId=await staffSessionDigest();
 if(error||!data.session?.access_token||!sessionId)throw new RequestError('401:Sign in again before creating accounts.');
 const config=runtime();
 const response=await fetch(`${config.SUPABASE_URL}/functions/v1/dyc-staff-accounts`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${data.session.access_token}`,apikey:config.SUPABASE_PUBLISHABLE_KEY!,'x-dyc-staff-session':sessionId},body:JSON.stringify(input),cache:'no-store'});
 const result=await response.json().catch(()=>null) as {error?:string;account?:{id:string;email:string;role:string;groups:string[]}}|null;
 if(!response.ok){const expected=[400,401,403,409,413,429,503].includes(response.status);throw new RequestError(`${expected?response.status:503}:${expected&&typeof result?.error==='string'?result.error:'Account creation is temporarily unavailable.'}`);}
 return Response.json({ok:true,account:result?.account},{status:201,headers:secureHeaders});
}catch(error){return failure(error instanceof StaffInputError?new RequestError('400:'+error.message):error);}}
