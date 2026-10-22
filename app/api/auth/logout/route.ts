import { authClient } from '../../../../lib/staff-auth';
import { failure, requireSameOrigin, runtime, secureHeaders } from '../../../../lib/server-security';
import { revokeStaffSession } from '../../../../lib/staff-sessions';
export async function POST(request:Request){try{
  requireSameOrigin(request);
  const config=runtime();
  await revokeStaffSession();
  const client=await authClient();const {error}=await client.auth.signOut({scope:'local'});if(error)throw error;
  return Response.json({ok:true,next:'/'},{headers:secureHeaders});
}catch(error){return failure(error);}}
