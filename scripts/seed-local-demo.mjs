import { DatabaseSync } from 'node:sqlite';
import { readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
const directory = path.resolve('.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
if (!existsSync(directory)) throw Error('Initialise the local database first.');
let database;
for (const file of readdirSync(directory).filter(name=>name.endsWith('.sqlite')&&name!=='metadata.sqlite')) {
  const candidate = new DatabaseSync(path.join(directory,file));
  if (candidate.prepare("SELECT name FROM sqlite_master WHERE name='warriors'").get()) { database=candidate; break; }
  candidate.close();
}
if (!database) throw Error('Local camp tables were not found.');
const given=['Ama','Kojo','Akua','Yaw','Efua','Kwame','Abena','Kofi','Esi','Kwaku','Adwoa','Yaa'];
const surnames=['Mensah','Owusu','Asare','Boateng','Osei','Addo','Amoah','Arthur','Sarpong','Aidoo','Appiah','Darko','Ansah','Badu','Opoku','Quaye','Adjei','Nkrumah','Frimpong','Acquah','Antwi'];
const today=new Date().toISOString().slice(0,10),now=Date.now();
const insertWarrior=database.prepare('INSERT OR IGNORE INTO warriors (id,name,age,group_name,room,guardian,contact,allergies,version) VALUES (?,?,?,?,?,?,?,?,1)');
const updateName=database.prepare("UPDATE warriors SET name=?,guardian=?,contact=? WHERE id=? AND name LIKE 'Demo Warrior %'");
const insertReading=database.prepare('INSERT INTO entries (id,warrior_id,kind,care_day,measured_at,payload,author,author_id,received_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload');
const insertReview=database.prepare("INSERT OR IGNORE INTO reviews (id,warrior_id,reason,status,owner,version,created_at,updated_at,outcome) VALUES (?,?,?,'Open','Medical lead',1,?,?,'')");
const times=[['Waking',7,0],['Before lunch',12,0],['Before dinner',18,0],['Bedtime',21,0],['3 a.m.',3,0]];
let inserted=0;
database.exec('BEGIN IMMEDIATE');
try {
  for(let i=0;i<250;i++) {
    const id=`DYC-${String(i+1).padStart(3,'0')}`,name=`${given[i%given.length]} ${surnames[Math.floor(i/given.length)%surnames.length]}`;
    insertWarrior.run(id,name,8+i%18,`Group ${String.fromCharCode(65+i%20)}`,String(1+Math.floor(i/4)),`Demo guardian · ${name}`,'Test contact · no real number','Unknown — verify at arrival');
    updateName.run(name,`Demo guardian · ${name}`,'Test contact · no real number',id);
    for(let daysAgo=2;daysAgo>=0;daysAgo--) {
      const day=new Date(today+'T00:00:00Z');day.setUTCDate(day.getUTCDate()-daysAgo);const careDate=day.toISOString().slice(0,10);
      for(let s=0;s<times.length;s++) {
        const [slot,hour]=times[s],at=new Date(day);if(slot==='3 a.m.')at.setUTCDate(at.getUTCDate()+1);at.setUTCHours(hour,i%24,0,0);if(at.getTime()>now-300000)continue;
        const value=Number((4.5+((i*11+s*7+daysAgo*9)%63)/10).toFixed(1));
        inserted+=insertReading.run(`local-demo-${id}-${careDate}-${s}`,id,'reading',careDate,at.toISOString(),JSON.stringify({value,unit:'mmol/L',slot,method:'Finger-prick glucometer',note:'Synthetic demonstration reading',measuredAt:at.toISOString(),careDay:careDate}),'Demo nurse','local-demo-nurse',at.toISOString()).changes;
      }
    }
  }
  for(const [i,id] of ['DYC-001','DYC-041','DYC-002','DYC-003','DYC-004'].entries()) {
    const at=new Date(now-(i+1)*900000).toISOString();
    insertReview.run(`local-demo-review-${today}-${i}`,id,['Please review the repeated observations and document an assessment.','Guardian information needs clinical verification before the next handover.','Staff requested a review of the latest care notes.','Please confirm the recorded care instructions with the group nurse.','Review requested during the group handover.'][i],at,at);
  }
  database.exec('COMMIT');
} catch(error) { database.exec('ROLLBACK'); throw error; }
console.log(`Local synthetic camp ready: 250 warriors, ${inserted} demo reading fixtures prepared. Existing user-created records preserved.`);
database.close();
