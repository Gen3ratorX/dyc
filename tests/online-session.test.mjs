import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const state=[],effects=[];let cursor=0,writes=0,commands=0;
const original={fetch:globalThis.fetch,window:globalThis.window,location:globalThis.location,navigator:Object.getOwnPropertyDescriptor(globalThis,'navigator'),setInterval:globalThis.setInterval,clearInterval:globalThis.clearInterval};
globalThis.__onlineSessionTest={
 useState(initial){const index=cursor++;if(!(index in state))state[index]=initial;return [state[index],value=>{state[index]=typeof value==='function'?value(state[index]):value;}];},
 useRef(initial){const index=cursor++;return state[index]??(state[index]={current:initial});},useCallback(fn){return fn;},useEffect(fn){effects.push(fn);},
 validate(){},listVaults:async()=>[],vaultActor:()=>undefined,lockVault(){},write:async()=>{writes++;throw Error('Online sessions must not persist camp data');}
};
globalThis.window={addEventListener(){},removeEventListener(){}};globalThis.location={assign(){}};
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:true}});
globalThis.setInterval=()=>0;globalThis.clearInterval=()=>{};
const camp={user:{id:'synthetic-staff',email:'test@example.invalid'},offlineExpiresAt:new Date(Date.now()+3600000).toISOString(),warriors:[]};
globalThis.fetch=async path=>{if(path==='/api/command')commands++;return {ok:true,status:200,json:async()=>path==='/api/camp'?camp:{}};};
try{
 let source=readFileSync('lib/use-camp.ts','utf8').replace(/^import .*;$/gm,'');
 source=`const {useCallback,useEffect,useRef,useState,validate,listVaults,vaultActor,lockVault,write}=globalThis.__onlineSessionTest;\n`+source;
 const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
 const {useCamp}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
 let store=useCamp();effects[0]();await new Promise(resolve=>setTimeout(resolve,10));
 cursor=0;store=useCamp();assert.equal(store.loading,false);assert.equal(store.gate,'ready');assert.equal(store.camp.user.id,camp.user.id);assert.equal(store.offlineEnabled,false);assert.equal(writes,0);
 await store.send('reading',{value:6.2},'synthetic-warrior');assert.equal(commands,1);assert.equal(writes,0);
 navigator.onLine=false;await assert.rejects(()=>store.send('reading',{value:6.3},'synthetic-warrior'),/Reconnect/);assert.equal(commands,1);
 navigator.onLine=true;await store.closeSession();cursor=0;store=useCamp();assert.equal(store.camp,null);assert.equal(store.gate,'signed-out');assert.equal(writes,0);
 console.log('Online sessions open directly, save through the server, block offline saves without a vault, close cleanly, and persist no camp data.');
}finally{globalThis.fetch=original.fetch;globalThis.window=original.window;globalThis.location=original.location;if(original.navigator)Object.defineProperty(globalThis,'navigator',original.navigator);else delete globalThis.navigator;globalThis.setInterval=original.setInterval;globalThis.clearInterval=original.clearInterval;delete globalThis.__onlineSessionTest;}
