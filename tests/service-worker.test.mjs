import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const handlers={},added=[],deleted=[];
vm.runInNewContext(readFileSync('public/sw.js','utf8'),{
 URL,Response,location:{origin:'https://camp.test'},
 self:{addEventListener:(type,handler)=>{handlers[type]=handler;},skipWaiting:async()=>{},clients:{claim:async()=>{}}},
 caches:{open:async()=>({add:async url=>{added.push(url);}}),keys:async()=>['dyc-shell-v2','dyc-shell-v3','other-app-cache'],delete:async key=>{deleted.push(key);}},
});
let pending;
handlers.message({data:{type:'CACHE_SHELL',urls:['https://camp.test/_next/static/app.js','https://camp.test/fonts/body.woff2','https://camp.test/dyc-logo-light.png','https://camp.test/api/camp','https://camp.test/auth/login','https://camp.test/clinical-export.csv','https://attacker.test/_next/static/app.js']},waitUntil:p=>{pending=p;}});
await pending;
assert.deepEqual(added,['https://camp.test/_next/static/app.js','https://camp.test/fonts/body.woff2','https://camp.test/dyc-logo-light.png']);
handlers.activate({waitUntil:p=>{pending=p;}});await pending;
assert.deepEqual(deleted,['dyc-shell-v2']);
for(const url of ['https://camp.test/api/camp','https://camp.test/api/exports','https://camp.test/patient-photo.png','https://attacker.test/script.js']){
 let intercepted=false;
 handlers.fetch({request:{method:'GET',url,mode:'cors'},respondWith:()=>{intercepted=true;}});
 assert.equal(intercepted,false,url);
}
console.log('Service worker checks passed: static shell allowlist, API and clinical-file exclusion, cross-origin exclusion, unrelated caches preserved.');
