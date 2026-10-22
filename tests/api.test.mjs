import assert from 'node:assert/strict';
const base='http://127.0.0.1:5173';
const login=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});const cookie=login.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');
assert(cookie,'Local sign-in must set a test cookie.');
async function data(){const r=await fetch(base+'/api/camp',{headers:{Cookie:cookie}});assert.equal(r.status,200);return r.json();}
let camp=await data();assert.equal(camp.user.role,'medical_lead');
async function command(type,payload,warrior='DYC-001',extra={}){const body={id:crypto.randomUUID(),actor:camp.user.id,type,payload,warrior,createdAt:new Date().toISOString(),...extra};const res=await fetch(base+'/api/command',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json',Origin:base},body:JSON.stringify(body)});return {status:res.status,data:await res.json(),body};}
const measuredAt=new Date(Date.now()-60000).toISOString(),careDay=new Date(Date.parse(measuredAt)-6*3600000).toISOString().slice(0,10);
if(!camp.warriors.length){const s=await command('seed',{},undefined);assert.equal(s.status,200);camp=await data();}
assert.equal(camp.warriors.length,250);
const p={value:6.2,unit:'mmol/L',slot:'Waking',method:'Finger-prick glucometer',measuredAt,careDay,note:'Synthetic integration test'};
const saved=await command('reading',p);assert.equal(saved.status,200,JSON.stringify(saved.data));const retry=await command('reading',p,'DYC-001',saved.body);assert.equal(retry.status,200);assert.equal(retry.data.duplicate,true);
assert.equal((await data()).entries.filter(e=>e.id===saved.body.id).length,1);
assert.equal((await command('reading',{...p,unit:'mg/dL'})).status,400);
assert.equal((await command('reading',p,'DYC-001',{actor:'wrong-account'})).status,403);
const review=await command('review',{reason:'Synthetic test review'});assert.equal(review.status,200);
let r=(await data()).reviews.find(r=>r.id===review.body.id);
assert.equal((await command('transition',{reviewId:r.id,version:r.version,status:'Resolved',outcome:'No acknowledgement'})).status,409);
assert.equal((await command('transition',{reviewId:r.id,version:r.version,status:'Acknowledged'})).status,200);
assert.equal((await command('transition',{reviewId:r.id,version:r.version,status:'Acknowledged'})).status,409);
r=(await data()).reviews.find(r=>r.id===review.body.id);
assert.equal((await command('transition',{reviewId:r.id,version:r.version,status:'Resolved',outcome:''})).status,400);
assert.equal((await command('transition',{reviewId:r.id,version:r.version,status:'Resolved',outcome:'Synthetic rehearsal completed'})).status,200);
const prior=(await data()).regimens.find(r=>r.warrior_id==='DYC-001');
const reg=await command('regimen',{medicine:'Synthetic insulin — TEST ONLY',dose:'Demo prescription',instructions:'Testing documentation only',baseVersion:prior?.version||0});assert.equal(reg.status,200);
assert.equal((await command('regimen',{medicine:'Synthetic',dose:'Demo',instructions:'Stale write',baseVersion:prior?.version||0})).status,409);
const admin=await command('administration',{medicine:'Synthetic insulin — TEST ONLY',regimenId:reg.body.id,dose:1,doseUnit:'test units',measuredAt,careDay,note:'No actual medicine was administered'});assert.equal(admin.status,200,JSON.stringify(admin.data));
const anonymous=await fetch(base+'/api/camp');assert.equal(anonymous.status,401);
console.log('API checks passed: authentication, 250-warrior seed, persisted reading, duplicate retry, actor mismatch, units, review lifecycle, stale versions, regimen versioning and distinct administration record.');
