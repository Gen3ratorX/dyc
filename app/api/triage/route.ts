import {context} from '../../../lib/camp-context';
import {careDay,validDay} from '../../../lib/domain';
import {RequestError,secureHeaders,rateLimit,failure} from '../../../lib/server-security';

export const dynamic='force-dynamic';

export async function GET(request:Request){try{
 const {db,user,role,owner}=await context();
 if(!owner&&!['administrator','medical_lead'].includes(role))throw new RequestError('403:Only camp administrators and medical leads can view triage status.');
 await rateLimit(db,user.userId,'read',60);
 const today=careDay(new Date().toISOString());
 const requestedDay=new URL(request.url).searchParams.get('day')||today;
 if(!validDay(requestedDay))throw new RequestError('400:Choose a valid care day.');
 const readings=(await db.prepare("SELECT e.id,e.warrior_id,e.payload,e.measured_at,w.name,w.group_name,w.room FROM entries e JOIN warriors w ON w.id=e.warrior_id WHERE e.kind='reading' AND e.care_day=? ORDER BY e.measured_at DESC LIMIT 10000").bind(requestedDay).all()).results as any[];
 const reviews=(await db.prepare('SELECT r.id,r.warrior_id,r.status,r.owner,r.proposed_owner,r.created_at,r.updated_at,w.name,w.group_name,w.room FROM reviews r JOIN warriors w ON w.id=r.warrior_id ORDER BY r.updated_at DESC LIMIT 5000').all()).results as any[];
 const latestFlags=new Map<string,{reading:any;flag:'HI'|'LO'}>();
 for(const reading of readings){
  if(latestFlags.has(reading.warrior_id))continue;
  let payload:any;try{payload=typeof reading.payload==='string'?JSON.parse(reading.payload):reading.payload;}catch{continue;}
  const flag=typeof payload?.value==='string'?payload.value.trim().toUpperCase():'';if(flag==='HI'||flag==='LO')latestFlags.set(reading.warrior_id,{reading,flag});
 }
 const cases:any[]=[];const linkedReviews=new Set<string>();
 const reviewsByWarrior=new Map<string,any[]>();for(const review of reviews){const rows=reviewsByWarrior.get(review.warrior_id);if(rows)rows.push(review);else reviewsByWarrior.set(review.warrior_id,[review]);}
 for(const {reading,flag} of latestFlags.values()){
  const related=(reviewsByWarrior.get(reading.warrior_id)||[]).find(review=>new Date(review.updated_at||review.created_at).getTime()>=new Date(reading.measured_at).getTime());
  if(related)linkedReviews.add(related.id);
  cases.push({id:`meter-${reading.id}`,kind:'meter_flag',flag,status:related?.status==='Reopened'||!related?'Needs clinician':related.status,owner:related?.owner||'',proposed_owner:related?.proposed_owner||null,created_at:reading.measured_at,name:reading.name,group_name:reading.group_name,room:reading.room});
 }
 for(const review of reviews){
  const active=review.status!=='Resolved';
  const matchesDay=careDay(review.created_at)===requestedDay;
  if((requestedDay===today?!active:!matchesDay)||linkedReviews.has(review.id))continue;
  cases.push({id:`review-${review.id}`,kind:'staff_request',status:review.status,owner:review.owner,proposed_owner:review.proposed_owner,created_at:review.created_at,name:review.name,group_name:review.group_name,room:review.room});
 }
 cases.sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at)));
 return Response.json({cases:cases.slice(0,500),careDay:requestedDay,currentCareDay:today},{headers:secureHeaders});
}catch(error){return failure(error);}}
