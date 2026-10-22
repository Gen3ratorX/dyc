import {runtime,secureHeaders} from '../../../lib/server-security';
import {databaseFailureCode} from '../../../lib/database-health';
export async function GET(){try{
 const config=runtime();
 const required={DATABASE_URL:Boolean(config.DB),SUPABASE_URL:Boolean(config.SUPABASE_URL),SUPABASE_PUBLISHABLE_KEY:Boolean(config.SUPABASE_PUBLISHABLE_KEY),BOOTSTRAP_ADMIN_EMAIL:Boolean(config.BOOTSTRAP_ADMIN_EMAIL),APP_ORIGIN:Boolean(config.APP_ORIGIN)};
 const missing=Object.entries(required).filter(([,present])=>!present).map(([key])=>key);
 if(missing.length)return Response.json({ok:false,code:'CONFIGURATION_INCOMPLETE',missing},{status:503,headers:secureHeaders});
 await config.DB!.prepare('SELECT 1 FROM members LIMIT 1').first();
 return Response.json({ok:true},{headers:secureHeaders});
}catch(error){
 // Report the failure category only. Connection strings, credentials, provider
 // errors and clinical data must never appear in this public response.
 return Response.json({ok:false,code:databaseFailureCode(error)},{status:503,headers:secureHeaders});
}}
