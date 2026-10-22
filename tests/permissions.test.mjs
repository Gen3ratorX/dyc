import assert from 'node:assert/strict';
const base='http://127.0.0.1:8787';
const headers=(email,id)=>({'oai-authenticated-user-email':email,'oai-authenticated-user-id':id,'Content-Type':'application/json',Origin:base});
async function get(email='seedy@sites.test',id='local_seedy'){const r=await fetch(base+'/api/camp',{headers:headers(email,id)});return{status:r.status,data:await r.json()};}
async function post(email,id,type,payload,warrior){const c={id:crypto.randomUUID(),type,payload,warrior,actor:id,createdAt:new Date().toISOString()};const r=await fetch(base+'/api/command',{method:'POST',headers:headers(email,id),body:JSON.stringify(c)});return {status:r.status,data:await r.json()};}
for(const role of ['mentor','nurse','coordinator','analyst','administrator']){const r=await post('seedy@sites.test','local_seedy','members',{email:`${role}@pilot.test`,role,groups:['Group A']});assert.equal(r.status,200,JSON.stringify(r.data));}
let m=await get('mentor@pilot.test','test_mentor');assert.equal(m.status,200);assert(m.data.warriors.length>0);assert(m.data.warriors.every(w=>w.group_name==='Group A'));assert.equal(m.data.regimens.length,0);
const at=new Date(Date.now()-60000).toISOString(),day=new Date(Date.parse(at)-6*3600000).toISOString().slice(0,10);
const p={value:5.9,unit:'mmol/L',method:'Finger-prick glucometer',slot:'Unscheduled',measuredAt:at,careDay:day};
assert.equal((await post('mentor@pilot.test','test_mentor','reading',p,'DYC-002')).status,403);
assert.equal((await post('mentor@pilot.test','test_mentor','reading',p,'DYC-001')).status,200);
assert.equal((await post('mentor@pilot.test','test_mentor','regimen',{medicine:'Test',dose:'Test',instructions:'Test',baseVersion:0},'DYC-001')).status,403);
assert.equal((await post('nurse@pilot.test','test_nurse','exception',{...p,slot:'3 a.m.',status:'Not required',note:'Test'},'DYC-001')).status,403);
const coord=(await get('coordinator@pilot.test','test_coordinator')).data;assert.equal(coord.entries.length,0);assert(!('allergies'in coord.warriors[0]));
const analyst=(await get('analyst@pilot.test','test_analyst')).data;assert(analyst.warriors.every(w=>!w.contact&&!w.guardian));assert(analyst.entries.every(e=>!e.author&&!e.payload.note));
const admin=(await get('administrator@pilot.test','test_admin')).data;assert.equal(admin.warriors.length,0);
assert.equal((await get('unknown@pilot.test','test_unknown')).status,403);
const owner=(await get()).data;assert.equal(owner.entries.filter(e=>e.payload.note==='Synthetic outage rehearsal — queue must survive reload.').length,1);
console.log('Server permission checks passed: assigned-group isolation, mentor prescribing blocked, nurse exception limits, coordinator clinical-value exclusion, analyst field filtering, administrator isolation, unlisted account denied, offline replay stored once.');
