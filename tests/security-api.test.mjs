// Run only against a fresh, isolated synthetic test database.
import assert from 'node:assert/strict';
const base=process.env.DYC_TEST_ORIGIN||'http://127.0.0.1:8793';
const staff=(email='seedy@sites.test',id='local_seedy')=>({email,id});
const owner=staff();
const headers=(user=owner)=>({'oai-authenticated-user-email':user.email,'oai-authenticated-user-id':user.id,'Content-Type':'application/json',Origin:base});
async function get(user=owner){const response=await fetch(base+'/api/camp',{headers:headers(user)});return {status:response.status,data:await response.json()};}
function command(type,payload,warrior,user=owner){return {id:crypto.randomUUID(),actor:user.id,type,payload,warrior,createdAt:new Date().toISOString()};}
async function send(body,user=owner,customHeaders={}){const response=await fetch(base+'/api/command',{method:'POST',headers:{...headers(user),...customHeaders},body:JSON.stringify(body)});return {status:response.status,data:await response.json()};}
async function post(type,payload,warrior,user=owner){return send(command(type,payload,warrior,user),user);}
assert.equal((await fetch(base+'/api/camp')).status,401);
let camp=(await get()).data;
assert.equal(camp.user.owner,true);
assert(camp.warriors.length===0||(process.env.DYC_TEST_RESUME==='1'&&camp.warriors.length===250),'Use an empty isolated database; never run this against a pilot or production database.');
if(!camp.warriors.length)assert.equal((await post('seed',{})).status,200);
const at=new Date(Date.now()-60000).toISOString(),day=new Date(Date.parse(at)-6*3600000).toISOString().slice(0,10);
const reading={value:6.2,unit:'mmol/L',method:'Finger-prick glucometer',slot:'Unscheduled',measuredAt:at,careDay:day};
for(const role of ['doctor','mentor','nurse','analyst','administrator'])assert.equal((await post('members',{email:role+'@test.invalid',role,groups:['Group A']})).status,200);
const doctor=staff('doctor@test.invalid','test_doctor'),mentor=staff('mentor@test.invalid','test_mentor');
assert.equal((await get(mentor)).status,200);
assert((await get(mentor)).data.warriors.every(w=>w.group_name==='Group A'));
assert.equal((await post('reading',reading,'DYC-002',mentor)).status,403);
assert.equal((await post('regimen',{medicine:'Synthetic',dose:'Test',instructions:'Test',baseVersion:0},'DYC-001',mentor)).status,403);
const body=command('reading',reading,'DYC-001',mentor);
assert.equal((await send(body,mentor)).status,200);
assert.equal((await send(body,mentor)).data.duplicate,true);
assert.equal((await send({...body,payload:{...reading,value:7}},mentor)).status,409);
assert.equal((await send(command('reading',reading,'DYC-001'),owner,{Origin:'https://attacker.invalid'})).status,403);
assert.equal((await send(command('reading',reading,'DYC-001'),owner,{'Content-Type':'text/plain'})).status,415);
assert.equal((await post('reading',{...reading,measuredAt:'2026-02-30T12:00:00Z'},'DYC-001')).status,400);
assert.equal((await post('reading',{...reading,note:'x'.repeat(4001)},'DYC-001')).status,400);
const exception={...reading,slot:'Bedtime',status:'Not required',note:'Synthetic concurrency test'};
const simultaneous=await Promise.all([post('exception',exception,'DYC-001',doctor),post('exception',exception,'DYC-001',doctor)]);
assert.deepEqual(simultaneous.map(r=>r.status).sort(),[200,409]);
const first=command('regimen',{medicine:'Synthetic medicine',dose:'Test dose',instructions:'Synthetic only',baseVersion:0},'DYC-001',doctor);
assert.equal((await send(first,doctor)).status,200);
assert.equal((await post('regimen',{...first.payload,baseVersion:1},'DYC-001',doctor)).status,200);
assert.equal((await post('administration',{...reading,medicine:'Synthetic medicine',regimenId:first.id,dose:1,doseUnit:'test units'},'DYC-001',doctor)).status,409);
const exported=await fetch(base+'/api/exports',{method:'POST',headers:headers(mentor),body:JSON.stringify({careDay:day,scope:'All groups'})});assert.equal(exported.status,403);
const analyst=staff('analyst@test.invalid','test_analyst');
const report=await fetch(base+'/api/exports',{method:'POST',headers:headers(analyst),body:JSON.stringify({careDay:day,scope:'All groups'})});
assert.equal(report.status,200);assert.match(report.headers.get('Cache-Control'),/no-store/);
const csv=await report.text();assert(!csv.includes('DYC-001'));assert(!csv.includes('seedy@sites.test'));
assert.equal((await post('members',{email:mentor.email,role:'mentor',groups:['Group A'],active:false})).status,200);
assert.equal((await get(mentor)).status,403);
assert.equal((await post('reading',reading,'DYC-001',mentor)).status,403);
for(let start=0;start<50;start+=10){const batch=await Promise.all(Array.from({length:10},(_,offset)=>post('register',{name:`Synthetic extra ${start+offset}`,age:12,group:'Group A'})));assert(batch.every(result=>result.status===200),JSON.stringify(batch));}
camp=(await get()).data;assert.equal(camp.warriors.length,300);
const started=performance.now(),parallel=await Promise.all(Array.from({length:15},()=>get()));
assert(parallel.every(result=>result.status===200&&result.data.warriors.length===300));
console.log(`Security API checks passed: group and role isolation, replay integrity, cross-origin rejection, input bounds, concurrent status guard, stale medicine regimen, export restrictions, suspension, 300 warriors and 15 concurrent reads (${Math.round(performance.now()-started)} ms locally).`);
