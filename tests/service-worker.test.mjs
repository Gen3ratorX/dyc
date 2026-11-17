import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const handlers={},added=[],deleted=[],matches=[];
vm.runInNewContext(readFileSync('public/sw.js','utf8'),{
 URL,Response,fetch:async()=>{throw Error('Offline');},location:{origin:'https://camp.test'},
 self:{addEventListener:(type,handler)=>{handlers[type]=handler;},skipWaiting:async()=>{},clients:{claim:async()=>{}}},
 caches:{open:async()=>({add:async url=>{added.push(url);}}),match:async key=>{matches.push(key);return new Response('Empty shell');},keys:async()=>['dyc-shell-v2','dyc-shell-v3','dyc-shell-v4','other-app-cache'],delete:async key=>{deleted.push(key);}},
});
let pending;
handlers.message({data:{type:'CACHE_SHELL',urls:['https://camp.test/_next/static/app.js','https://camp.test/fonts/body.woff2','https://camp.test/dyc-logo-light.png','https://camp.test/api/camp','https://camp.test/auth/login','https://camp.test/clinical-export.csv','https://attacker.test/_next/static/app.js']},waitUntil:p=>{pending=p;}});
await pending;
assert.deepEqual(added,['https://camp.test/_next/static/app.js','https://camp.test/fonts/body.woff2','https://camp.test/dyc-logo-light.png']);
handlers.activate({waitUntil:p=>{pending=p;}});await pending;
assert.deepEqual(deleted,['dyc-shell-v2','dyc-shell-v3']);
for(const url of ['https://camp.test/api/camp','https://camp.test/api/exports','https://camp.test/patient-photo.png','https://attacker.test/script.js']){
 let intercepted=false;
 handlers.fetch({request:{method:'GET',url,mode:'cors'},respondWith:()=>{intercepted=true;}});
 assert.equal(intercepted,false,url);
}
console.log('Service worker checks passed: static shell allowlist, API and clinical-file exclusion, cross-origin exclusion, unrelated caches preserved.');

for(const [path,fallback] of [['/','/'],['/register','/'],['/login','/overview'],['/check-in','/overview'],['/rooms-teams','/overview']]){
 let response;handlers.fetch({request:{method:'GET',url:'https://camp.test'+path,mode:'navigate'},respondWith:p=>{response=p;}});assert.equal((await response).status,200);assert.equal(matches.at(-1),fallback);
}
console.log('Offline navigation uses the public welcome shell for participants and the staff shell for staff routes.');
