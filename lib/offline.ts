import type {Command} from './domain';
// The original synthetic pilot store is deliberately left untouched. Production
// uses a new, account-scoped encrypted store; no plaintext camp is copied over.
const DATABASE='dyc-secure-v1';
const ITERATIONS=310000;
type Envelope={iv:number[];cipher:ArrayBuffer};
type Vault={actor:string;label:string;salt:number[];iterations:number;check:Envelope};
let session:{actor:string;key:CryptoKey;epoch:number}|null=null;
let epoch=0;
async function open(){return new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open(DATABASE,1);r.onupgradeneeded=()=>r.result.createObjectStore('data');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function get<T>(key:string):Promise<T|undefined>{const db=await open();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('data','readonly'),r=tx.objectStore('data').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}finally{db.close();}}
async function put(key:string,value:unknown){const db=await open();try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction('data','readwrite');tx.objectStore('data').put(value,key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Device storage did not complete.'));});}finally{db.close();}}
async function keys(prefix:string):Promise<string[]>{const db=await open();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('data','readonly'),r=tx.objectStore('data').getAllKeys();r.onsuccess=()=>resolve(r.result.map(String).filter(key=>key.startsWith(prefix)));r.onerror=()=>reject(r.error);});}finally{db.close();}}
export async function listVaults(){const all=await keys('vault:');return Promise.all(all.map(async key=>{const v=(await get<Vault>(key))!;return {actor:v.actor,label:v.label};}));}
export async function hasVault(actor:string){return Boolean(await get('vault:'+actor));}
async function derive(passphrase:string,salt:Uint8Array,iterations:number){const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(passphrase),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt:salt as Uint8Array<ArrayBuffer>,iterations,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);}
export async function seal(key:CryptoKey,actor:string,name:string,value:unknown):Promise<Envelope>{const iv=crypto.getRandomValues(new Uint8Array(12));const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(actor+':'+name)},key,new TextEncoder().encode(JSON.stringify(value)));return {iv:Array.from(iv),cipher};}
export async function unseal<T>(key:CryptoKey,actor:string,name:string,value:Envelope):Promise<T>{const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(value.iv),additionalData:new TextEncoder().encode(actor+':'+name)},key,value.cipher);return JSON.parse(new TextDecoder().decode(plain));}
export async function createVault(actor:string,email:string,passphrase:string){
 if(passphrase.length<12)throw Error('Use a device passphrase of at least 12 characters.');
 if(await hasVault(actor))throw Error('This staff account already has protected records on this device. Unlock them instead.');
 const salt=crypto.getRandomValues(new Uint8Array(16)),key=await derive(passphrase,salt,ITERATIONS);
 const check=await seal(key,actor,'check',{actor,version:1});
 await put('vault:'+actor,{actor,label:email.replace(/^(.).*(@.*)$/,'$1•••$2'),salt:Array.from(salt),iterations:ITERATIONS,check} satisfies Vault);
 session={actor,key,epoch:++epoch};
}
export async function unlockVault(actor:string,passphrase:string){const vault=await get<Vault>('vault:'+actor);if(!vault)throw Error('Sign in online to set up this device.');try{const key=await derive(passphrase,new Uint8Array(vault.salt),vault.iterations);const check=await unseal<{actor:string}>(key,actor,'check',vault.check);if(check.actor!==actor)throw Error();session={actor,key,epoch:++epoch};}catch{throw Error('The device passphrase is incorrect, or these records could not be decrypted.');}}
export function lockVault(){epoch++;session=null;}
export function vaultActor(){return session?.actor;}
export async function read<T>(name:string):Promise<T|undefined>{const active=session;if(!active)throw Error('Unlock this device first.');const stored=await get<Envelope>('record:'+active.actor+':'+name);if(!stored)return undefined;const result=await unseal<T>(active.key,active.actor,name,stored);if(session?.epoch!==active.epoch)throw Error('Device locked.');return result;}
export async function write(name:string,value:unknown){const active=session;if(!active)throw Error('Unlock this device first.');const stored=await seal(active.key,active.actor,name,value);if(session?.epoch!==active.epoch)throw Error('Device locked.');await put('record:'+active.actor+':'+name,stored);}
export async function enqueue(command:Command){if(command.actor!==vaultActor())throw Error('This entry belongs to a different staff account.');await write('command:'+command.id,command);}
export async function queue():Promise<Command[]>{const actor=vaultActor();if(!actor)return [];const prefix='record:'+actor+':command:';const all=await keys(prefix);const result=await Promise.all(all.map(key=>read<Command>(key.slice(('record:'+actor+':').length))));return result.filter((c):c is Command=>Boolean(c)).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));}
export async function dequeue(id:string){const actor=vaultActor();if(!actor)throw Error('Device locked.');const db=await open();try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction('data','readwrite');tx.objectStore('data').delete('record:'+actor+':command:'+id);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Device storage did not complete.'));});}finally{db.close();}}
