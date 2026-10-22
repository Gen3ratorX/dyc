import { database, type ServerDatabase } from './postgres';
import { ValidationError } from './domain';

export const runtime = () => ({
  APP_MODE:'production', APP_AUTH_PROVIDER:'supabase',
  APP_ORIGIN:process.env.APP_ORIGIN,
  BOOTSTRAP_ADMIN_EMAIL:process.env.BOOTSTRAP_ADMIN_EMAIL,
  SUPABASE_URL:process.env.SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY:process.env.SUPABASE_PUBLISHABLE_KEY,
  DB:database(),
});
export class RequestError extends Error {
  status:number;
  constructor(message:string){const match=message.match(/^(\d{3}):(.*)$/);super(match?match[2]:message);this.status=match?Number(match[1]):400;}
}
export const secureHeaders = {
  'Cache-Control':'private, no-store, max-age=0',
  'Pragma':'no-cache', 'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'no-referrer', 'Vary':'Cookie, Authorization',
};
export function failure(error:unknown){
  const expected=error instanceof RequestError||error instanceof ValidationError;
  const status=error instanceof RequestError?error.status:error instanceof ValidationError?400:503;
  const requestId=crypto.randomUUID();
  if(!expected)console.error('Camp request failed',{requestId,kind:error instanceof Error?error.name:'Unknown'});
  return Response.json({error:expected?error.message:'The service could not complete this request. Try again or contact the camp administrator.',requestId},{status,headers:{...secureHeaders,...(status===429?{'Retry-After':'60'}:{})}});
}
export function requireSameOrigin(request:Request){
  const config=runtime();
  const expected=config.APP_ORIGIN?new URL(config.APP_ORIGIN).origin:new URL(request.url).origin;
  if(request.headers.get('origin')!==expected||request.headers.get('sec-fetch-site')==='cross-site')throw new RequestError('403:Open this action from the camp application.');
  if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw new RequestError('415:Use a JSON request.');
}
export async function rateLimit(db:ServerDatabase,actor:string,action:string,maximum:number){
  const minute=Math.floor(Date.now()/60000);
  const key=`${action}:${actor}:${minute}`;
  const row=await db.prepare('INSERT INTO request_buckets (id,requests,window) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET requests=request_buckets.requests+1 WHERE request_buckets.requests < ? RETURNING request_buckets.requests').bind(key,minute,maximum).first();
  if(!row)throw new RequestError('429:Too many requests. Wait one minute and try again.');
  // Bounded retention for rate-limit metadata; no clinical values are stored here.
  if(Math.random()<0.02)await db.prepare('DELETE FROM request_buckets WHERE window < ?').bind(minute-1440).run();
}
