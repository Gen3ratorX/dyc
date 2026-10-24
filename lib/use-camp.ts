'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { validate, type Camp, type Command } from './domain';
import { read, write, queue, enqueue, dequeue, createVault,unlockVault,lockVault,vaultActor,listVaults,hasVault } from './offline';
class AuthenticationError extends Error { constructor(message:string,readonly status?:number){super(message);} }
export function useCamp(){
 const [camp,setCamp]=useState<Camp|null>(null),[loading,setLoading]=useState(true),[online,setOnline]=useState(true);
 const [pending,setPending]=useState<Command[]>([]),[syncErrors,setSyncErrors]=useState<Record<string,string>>({});
 const [syncProblem,setSyncProblem]=useState('');
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[syncing,setSyncing]=useState(false);
 const [gate,setGate]=useState<'signed-out'|'setup'|'locked'|'ready'>('signed-out');
 const [vaults,setVaults]=useState<{actor:string;label:string}[]>([]),[deviceActor,setDeviceActor]=useState('');
 const syncErrorRef=useRef('');
 const current=useRef<Camp|null>(null),syncLock=useRef(false),lastActivity=useRef(Date.now());
 const forget=useCallback(()=>{const actor=vaultActor();lockVault();current.current=null;setCamp(null);setPending([]);setSyncErrors({});setGate(actor?'locked':'signed-out');if(actor)setDeviceActor(actor);},[]);
 const fetchCamp=useCallback(async()=>{
  const response=await fetch('/api/camp',{cache:'no-store'});const result=await response.json() as Camp&{error?:string};
  if(!response.ok){if([401,403].includes(response.status)){try{if(vaultActor())await write('camp',null);}finally{forget();setGate('signed-out');}throw new AuthenticationError(result.error||'Sign in to continue.',response.status);}throw Error(result.error||'We could not load the camp record. Check your connection and try again.');}
  return result;
 },[forget]);
 const refresh=useCallback(async()=>{const fresh=await fetchCamp();if(!vaultActor()){current.current=fresh;setCamp(fresh);return fresh;}if(vaultActor()!==fresh.user.id){forget();throw new AuthenticationError('The signed-in account changed. Unlock the correct staff account.');}current.current=fresh;await write('camp',fresh);if(vaultActor()===fresh.user.id)setCamp(fresh);return fresh;},[fetchCamp,forget]);
 const sync=useCallback(async()=>{
  if(syncLock.current||!navigator.onLine)return;syncLock.current=true;setSyncing(true);if(!vaultActor()){try{await refresh();setSyncProblem('');const priorSyncError=syncErrorRef.current;syncErrorRef.current='';if(priorSyncError)setError(currentError=>currentError===priorSyncError?'':currentError);setOnline(true);}catch(err){syncErrorRef.current=(err as Error).message;setSyncProblem(syncErrorRef.current);if(err instanceof TypeError)setOnline(false);else setError((err as Error).message);}finally{syncLock.current=false;setSyncing(false);}return;}
  try{const fresh=await refresh();setSyncProblem('');const priorSyncError=syncErrorRef.current;syncErrorRef.current='';if(priorSyncError)setError(currentError=>currentError===priorSyncError?'':currentError);setOnline(true);for(const command of await queue()){
   if(!vaultActor()||command.actor!==fresh.user.id)break;
   try{const response=await fetch('/api/command',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(command)});const result=await response.json() as {error?:string;message?:string;next?:string};
    if([401,403].includes(response.status)){await refresh();}
    if(!response.ok){setSyncErrors(previous=>({...previous,[command.id]:result.error||'This entry has not synced. Open it here to check the details.'}));if(response.status===429)break;continue;}
    await dequeue(command.id);setSyncErrors(previous=>{const next={...previous};delete next[command.id];return next;});
   }catch(err){if(err instanceof AuthenticationError)throw err;setOnline(false);break;}
  }if(vaultActor()){setPending(await queue());await refresh();}}
  catch(err){syncErrorRef.current=(err as Error).message;setSyncProblem(syncErrorRef.current);if(err instanceof TypeError)setOnline(false);else setError((err as Error).message);}
  finally{syncLock.current=false;setSyncing(false);}
 },[refresh]);
 useEffect(()=>{
  async function boot(){setOnline(navigator.onLine);let available:{actor:string;label:string}[]=[];try{available=await listVaults();setVaults(available);}catch{setVaults([]);}
   try{const fresh=await fetchCamp();current.current=fresh;setDeviceActor(fresh.user.id);setCamp(fresh);setGate('ready');lastActivity.current=Date.now();}
   catch(err){if(err instanceof TypeError&&available.length){setOnline(false);setDeviceActor(available[0].actor);setGate('locked');}else if(!(err instanceof AuthenticationError&&err.status===401))setError((err as Error).message);}
   finally{setLoading(false);}
  }void boot();
  const connected=()=>{setOnline(true);void sync();};const disconnected=()=>setOnline(false);
  window.addEventListener('online',connected);window.addEventListener('offline',disconnected);
  const timer=setInterval(()=>{if(navigator.onLine&&current.current)void sync();},30000);
  if('serviceWorker'in navigator&&process.env.NODE_ENV==='production')void navigator.serviceWorker.register('/sw.js').then(()=>navigator.serviceWorker.ready).then(registration=>{registration.active?.postMessage({type:'CACHE_SHELL',urls:performance.getEntriesByType('resource').map(resource=>resource.name)});}).catch(()=>{});
  return()=>{clearInterval(timer);window.removeEventListener('online',connected);window.removeEventListener('offline',disconnected);};
 },[fetchCamp,sync]);
 const unlockDevice=async(passphrase:string)=>{
  let fresh:Camp|undefined;
  if(navigator.onLine){try{fresh=await fetchCamp();}catch(err){if(!(err instanceof TypeError))throw err;setOnline(false);}}
  const actor=fresh?.user.id||deviceActor;if(!actor)throw Error('Sign in online before setting up this device.');
  if(await hasVault(actor))await unlockVault(actor,passphrase);else{if(!fresh)throw Error('Connect to set up this device.');await createVault(actor,fresh.user.email,passphrase);}
  try{const data=fresh||await read<Camp>('camp');if(!data||data.user.id!==actor)throw Error('Connect and sign in to refresh this account.');
   if(!fresh&&(!data.offlineExpiresAt||Date.parse(data.offlineExpiresAt)<Date.now()))throw Error('Offline access has expired. Connect and sign in again. Your unsynced entries are still encrypted on this device.');
   current.current=data;await write('camp',data);setCamp(data);setPending(await queue());setDeviceActor(actor);setVaults(await listVaults());setGate('ready');lastActivity.current=Date.now();setError('');if(fresh)void sync();
  }catch(err){lockVault();throw err;}
 };
 const closeSession=async()=>{
  try{if(vaultActor())await write('camp',null);}finally{forget();setGate('signed-out');}
  const response=await fetch('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  if(!response.ok)throw Error('This device is locked. Connect again to finish signing out.');
  const result=await response.json() as {error?:string;message?:string;next?:string};location.assign(result.next==='/signout-with-chatgpt?return_to=/'?result.next:'/');
 };
 useEffect(()=>{const active=()=>{lastActivity.current=Date.now();};window.addEventListener('pointerdown',active);window.addEventListener('keydown',active);
  const timer=setInterval(()=>{if(current.current&&Date.now()-lastActivity.current>15*60000){void closeSession().catch(err=>setError((err as Error).message));}},15000);
  return()=>{clearInterval(timer);window.removeEventListener('pointerdown',active);window.removeEventListener('keydown',active);};
 },[forget]);
 const send=async(type:string,payload:Record<string,any>,warrior?:string)=>{
  const user=current.current?.user;if(!user||(vaultActor()&&vaultActor()!==user.id))throw Error('Sign in to your staff account first.');validate(type,payload);
  if(!current.current?.offlineExpiresAt||Date.parse(current.current.offlineExpiresAt)<Date.now())throw Error('Refresh your staff session before recording more entries.');
  const command:Command={id:crypto.randomUUID(),actor:user.id,type,warrior,payload,createdAt:new Date().toISOString()};
  const acceptsOffline=['reading','note','exception','administration','review'].includes(type);
  if((!navigator.onLine||!online)&&!acceptsOffline)throw Error('Reconnect to save this change.');
  if(!vaultActor()&&(!navigator.onLine||!online))throw Error('Reconnect to save this entry. You can enable protected offline access in Camp settings.');
  if(acceptsOffline&&vaultActor()){await enqueue(command);setPending(await queue());setNotice('Saved securely on this device. Waiting to sync.');if(navigator.onLine){await sync();if(vaultActor()&&!(await queue()).some(item=>item.id===command.id))setNotice('Synced to the camp record. The care team can now see this entry.');}return;}
  const response=await fetch('/api/command',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(command)});const result=await response.json() as {error?:string;message?:string;next?:string};if(!response.ok)throw Error(result.error||'We could not save this change. Check the details and try again.');await refresh();setNotice('Saved to the camp record.');
 };
 return {camp,loading,online,pending,syncing,syncErrors,syncProblem,error,setError,notice,setNotice,send,sync,refresh,gate,cancelOffline:()=>{if(current.current){setError('');setGate('ready');}},offlineEnabled:Boolean(vaultActor()),enableOffline:async()=>{const actor=current.current?.user.id;if(!actor)throw Error('Sign in first.');setDeviceActor(actor);setGate(await hasVault(actor)?'locked':'setup');},vaults,deviceActor,setDeviceActor,unlockDevice,closeSession,lockDevice:closeSession};
}
